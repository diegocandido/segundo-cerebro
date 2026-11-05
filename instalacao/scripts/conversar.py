#!/usr/bin/env python3
"""conversar.py: conversa por voz com o OS.

Três modos:
- Walkie-talkie (padrão): Enter começa a gravar, Enter de novo para.
- Mãos livres (--maos-livres, atalho `cerebro`): fica ouvindo e só responde quando a frase
  começa com "Oi, {nome}" ("Oi, {nome}, como está o cliente X?"). Percebe sozinho o fim da fala.
- Uma pergunta (--uma-vez, Atalho "Segundo Cérebro" do macOS, por Siri ou tecla): toca o pop,
  ouve uma pergunta, responde falando e fecha. Sem janela; a pergunta e a resposta também
  aparecem como notificação. Pergunta feita até 10 minutos depois da anterior continua a mesma
  conversa; "nova conversa" zera. Erros vão para ~/.local/share/conversar/uma-vez.log.

A fala vira texto no próprio Mac (Whisper via MLX), vai para o Claude Code rodando nesta pasta
(mesmo CLAUDE.md, memória e índices) e a resposta volta escrita na tela e falada pela voz
de bin/falar.py (ElevenLabs, com uma voz do macOS de reserva). O áudio do microfone nunca sai do
computador. No mãos livres, tudo o que o microfone pega é transcrito localmente, mas só o que
começa com o nome da assistente vai para o Claude; o resto é descartado.

Nome, palavra de ativação, quem fala, microfone preferido e vocabulário vêm de bin/assistente.json.

Modo só consulta: o Claude lê o OS e roda os resumos somente leitura; não edita nem envia nada.

    python3 bin/conversar.py                 # walkie-talkie, microfone preferido (assistente.json)
    python3 bin/conversar.py --maos-livres   # mãos livres
    python3 bin/conversar.py --uma-vez       # uma pergunta e fecha (é o que o Atalho chama)
    python3 bin/conversar.py --mic usb       # escolhe o microfone por parte do nome
    python3 bin/conversar.py --listar-mics   # lista os microfones disponíveis
    python3 bin/conversar.py --maos-livres --debug   # mostra o nível do microfone e o que foi ignorado
    python3 bin/conversar.py --painel --arquivo audio.webm   # usado pelo botão 🎙 do painel (responde em JSON)
    python3 bin/conversar.py --painel --texto "..."          # idem, pergunta digitada
    python3 bin/conversar.py --painel --nova                 # zera a conversa do painel

No mãos livres: Enter pausa e retoma a escuta, q sai. Por voz: "Oi, {nome}, nova conversa",
"{nome}, pausa" e "{nome}, tchau". Só "Oi, {nome}" e ela pergunta o que você quer.

Dependências fora do iCloud, de propósito: ~/.local/share/conversar/.venv (mlx-whisper,
sounddevice, numpy) e a voz de bin/falar.py. O modelo do Whisper é baixado na primeira vez.
"""
import os
import sys
from pathlib import Path

VENV_PY = Path.home() / ".local/share/conversar/.venv/bin/python"

# Roda sempre com o Python do venv, onde estão o Whisper e o acesso ao microfone
if Path(sys.prefix).resolve() != VENV_PY.parent.parent.resolve():
    if not VENV_PY.exists():
        sys.exit(f"Falta o ambiente de voz em {VENV_PY.parent.parent}.")
    os.execv(str(VENV_PY), [str(VENV_PY), __file__, *sys.argv[1:]])

import collections
import json
import queue
import re
import shutil
import subprocess
import threading
import time
import unicodedata

import numpy as np
import sounddevice as sd

OS_DIR = Path(__file__).resolve().parent.parent
FALAR = OS_DIR / "bin/falar.py"
CLAUDE = shutil.which("claude") or str(Path.home() / ".local/bin/claude")
MODELO_WHISPER = "mlx-community/whisper-large-v3-turbo"
TAXA_WHISPER = 16000

def _config() -> dict:
    try:
        return json.loads((OS_DIR / "bin/assistente.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


CFG = _config()
NOME = CFG.get("nome") or "Assistente"
USUARIO = CFG.get("usuario") or ""
MICS_PREFERIDOS = [m.lower() for m in CFG.get("mics_preferidos", [])]  # primeiro que existir; virtuais (VB-Cable, BlackHole) nunca entram sozinhos
MICS_VIRTUAIS = ["vb-cable", "blackhole", "teams", "iphone"]
TIMEOUT_CLAUDE = 180  # segundos

# Mãos livres
NOMES = set(CFG.get("ativacao") or [NOME.lower()])  # palavra de ativação, sem acento; a comparação ignora acento e pontuação
BLOCO_S = 0.1                # tamanho de cada bloco de áudio
PRE_ROLL_S = 0.4             # áudio guardado antes do início da fala, para não cortar a primeira sílaba
SILENCIO_FIM_S = 1.2         # silêncio que encerra uma fala
FALA_MIN_S = 0.6             # falas mais curtas são ruído
FALA_MAX_S = 30              # corta falas longas demais
CALIBRAGEM_S = 1.5           # escuta o ambiente antes de começar
ESPERA_PERGUNTA_S = 8        # depois de só "Oi, {nome}", quanto tempo espera a pergunta
SOM_ATIVOU = "/System/Library/Sounds/Pop.aiff"
CHECAGEM_NOME_S = 2.5        # só o começo de cada fala é transcrito para procurar o nome
PAUSA_POS_FALA_S = 0.8       # depois que a assistente fala, ignora o microfone um instante (eco da caixa de som)

# Ferramentas liberadas: ler o OS e, se configurados, resumos somente leitura (consultas_extras)
FERRAMENTAS = ["Read", "Grep", "Glob", *CFG.get("consultas_extras", [])]

PROMPT_VOZ = (
    f"Você se chama {NOME} e está em modo de conversa por voz{' com ' + USUARIO if USUARIO else ''}. "
    "A resposta será lida em voz alta: "
    "responda em português, em frases corridas, sem markdown, listas, tabelas, links nem "
    "caminhos de arquivo; no máximo 80 palavras, a menos que ele peça detalhe. Escreva "
    "horários e valores por extenso quando ajudar a pronúncia. Neste modo você só consulta: "
    "não crie, edite nem envie nada. Se ele pedir uma ação, diga o que faria e que ele "
    "confirme numa sessão normal do Claude Code."
)


def escolher_mic(nome: str | None) -> tuple[int, str]:
    entradas = [(i, d["name"]) for i, d in enumerate(sd.query_devices()) if d["max_input_channels"] > 0]
    if nome:
        for i, n in entradas:
            if nome.lower() in n.lower():
                return i, n
        sys.exit(f"Nenhum microfone com '{nome}'. Veja --listar-mics.")
    for pref in MICS_PREFERIDOS:
        for i, n in entradas:
            if pref in n.lower():
                return i, n
    for i, n in entradas:
        if not any(v in n.lower() for v in MICS_VIRTUAIS):
            return i, n
    sys.exit("Nenhum microfone físico encontrado. Veja --listar-mics.")


def reamostrar(audio: np.ndarray, taxa: int) -> np.ndarray:
    """Converte para os 16 kHz que o Whisper espera."""
    n = int(len(audio) * TAXA_WHISPER / taxa)
    return np.interp(np.linspace(0, len(audio), n, endpoint=False), np.arange(len(audio)), audio).astype(np.float32)


def gravar(mic: int) -> np.ndarray:
    taxa = int(sd.query_devices(mic)["default_samplerate"])
    blocos: list[np.ndarray] = []
    with sd.InputStream(device=mic, samplerate=taxa, channels=1, dtype="float32",
                        callback=lambda dados, *_: blocos.append(dados.copy())):
        input("  🎙  gravando... Enter para parar ")
    if not blocos:
        return np.zeros(0, dtype=np.float32)
    return reamostrar(np.concatenate(blocos)[:, 0], taxa)


def vocabulario() -> str:
    """Nomes de clientes e produtos do OS, para o Whisper acertar a grafia de siglas e marcas."""
    # O nome da assistente fica de fora: no prompt, o Whisper passa a omiti-lo do começo da fala
    pasta = OS_DIR / CFG.get("pasta_entidades", "Clientes")
    nomes = [p.name for p in pasta.iterdir() if p.is_dir() and not p.name.startswith("_")] if pasta.is_dir() else []
    nomes += CFG.get("vocabulario_extra", [])
    if not nomes:
        return ""
    return "Nomes que podem aparecer: " + ", ".join(nomes) + "."


def transcrever(audio: np.ndarray, vocab: bool = True) -> str:
    # Sem barras de download no meio da conversa; com o modelo já baixado, nem consulta a rede
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    cache = Path.home() / ".cache/huggingface/hub" / ("models--" + MODELO_WHISPER.replace("/", "--"))
    if cache.exists():
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
    import mlx_whisper
    # temperature 0 evita as novas tentativas que, em ruído, viram repetições infinitas
    r = mlx_whisper.transcribe(audio, path_or_hf_repo=MODELO_WHISPER, language="pt", temperature=0.0,
                               condition_on_previous_text=False,
                               initial_prompt=(vocabulario() or None) if vocab else None)
    return r.get("text", "").strip()


def perguntar(texto: str, sessao: str | None) -> tuple[str, str | None]:
    cmd = [CLAUDE, "-p", texto, "--output-format", "json", "--append-system-prompt", PROMPT_VOZ,
           "--allowedTools", *FERRAMENTAS]
    if sessao:
        cmd += ["--resume", sessao]
    r = subprocess.run(cmd, cwd=OS_DIR, capture_output=True, text=True, timeout=TIMEOUT_CLAUDE)
    try:
        dados = json.loads(r.stdout)
    except json.JSONDecodeError:
        return "Não consegui falar com o Claude agora. " + (r.stderr.strip()[-200:] or ""), sessao
    resultado = dados.get("result", "").strip()
    if dados.get("is_error"):
        if "authenticate" in resultado.lower() or "login" in resultado.lower():
            return "O Claude Code precisa de login de novo. Rode claude no terminal e use o comando login.", sessao
        return "O Claude respondeu com erro: " + resultado[:200], sessao
    return resultado, dados.get("session_id", sessao)


def para_fala(texto: str) -> str:
    texto = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", texto)  # [rótulo](link) -> rótulo
    return re.sub(r"[*_#`|>]+", " ", texto)


def falar(texto: str) -> None:
    r = subprocess.run([sys.executable, str(FALAR)], input=para_fala(texto), text=True,
                       capture_output=True)
    if r.returncode != 0:
        print(f"  (voz falhou: {r.stderr.strip() or 'sem detalhe'})")


def responder(pergunta: str, sessao: str | None) -> str | None:
    print("  pensando...")
    try:
        resposta, sessao = perguntar(pergunta, sessao)
    except subprocess.TimeoutExpired:
        print("  (o Claude demorou demais, tente de novo)")
        return sessao
    print(f"\n  OS: {resposta}\n")
    falar(resposta)
    return sessao


# ---------- walkie-talkie ----------

def modo_enter(mic: int, nome_mic: str) -> None:
    print(f"Conversa com o OS · microfone: {nome_mic}")
    print("Aperte só a tecla Enter para começar a gravar, fale e aperte Enter de novo para parar.")
    print("Também dá para digitar a pergunta. Para sair, digite q.\n")
    sessao = None
    while True:
        try:
            entrada = input("› Enter para gravar: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if entrada.lower() in {"q", "sair"}:
            break
        if len(entrada) > 2:  # texto curto (um "1", um espaço) conta como Enter
            pergunta = entrada
        else:
            audio = gravar(mic)
            if len(audio) < TAXA_WHISPER // 2:
                print("  (áudio curto demais, tente de novo)")
                continue
            print("  transcrevendo...")
            pergunta = transcrever(audio)
            if not pergunta:
                print("  (não entendi nada, tente de novo)")
                continue
            print(f"  você: {pergunta}")
        sessao = responder(pergunta, sessao)


# ---------- mãos livres ----------

class Segmentador:
    """Recebe blocos de áudio e devolve uma fala inteira quando ela termina (detecção por energia)."""

    def __init__(self, taxa: int, limiar: float):
        self.taxa, self.limiar = taxa, limiar
        self.pre = collections.deque(maxlen=max(1, int(PRE_ROLL_S / BLOCO_S)))
        self.reiniciar()

    def reiniciar(self) -> None:
        self.fala: list[np.ndarray] = []
        self.silencio = 0.0
        self.pre.clear()

    def alimentar(self, bloco: np.ndarray) -> np.ndarray | None:
        dur = len(bloco) / self.taxa
        alto = float(np.sqrt(np.mean(bloco ** 2))) > self.limiar
        if not self.fala:
            if alto:
                self.fala = [*self.pre, bloco]
                self.silencio = 0.0
            else:
                self.pre.append(bloco)
            return None
        self.fala.append(bloco)
        self.silencio = 0.0 if alto else self.silencio + dur
        total = sum(len(b) for b in self.fala) / self.taxa
        if self.silencio >= SILENCIO_FIM_S or total >= FALA_MAX_S:
            audio = np.concatenate(self.fala)
            self.reiniciar()
            if total - self.silencio < FALA_MIN_S:
                return None
            return audio
        return None


def normalizar(texto: str) -> list[str]:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]+", " ", sem_acento.lower()).split()


def separar_ativacao(texto: str) -> tuple[bool, str]:
    """'Oi, {nome}, como está o cliente X?' -> (True, 'como está o cliente X?'). O nome tem de vir no começo."""
    palavras = normalizar(texto)
    if not NOMES.intersection(palavras[:3]):
        return False, ""
    # Corta o texto original logo depois da palavra que é o nome
    for m in re.finditer(r"\w+", texto):
        if normalizar(m.group())[:1] and normalizar(m.group())[0] in NOMES:
            fim = re.match(r"[\s,.!?:;-]*", texto[m.end():])
            return True, texto[m.end() + fim.end():].strip()
    return True, ""


def comando(resto: str) -> str | None:
    p = " ".join(normalizar(resto))
    if p in {"tchau", "encerrar", "desligar", "sair", "ate mais", "pode desligar"}:
        return "sair"
    if p in {"pausa", "pausar", "pare de ouvir", "para de ouvir"}:
        return "pausar"
    if p in {"nova conversa", "novo assunto", "esquece", "comecar de novo"}:
        return "nova"
    return None


def calibrar(blocos: list[np.ndarray]) -> float:
    niveis = [float(np.sqrt(np.mean(b ** 2))) for b in blocos] or [0.0]
    return max(float(np.median(niveis)) * 3.5, 0.006)


def modo_maos_livres(mic: int, nome_mic: str, debug: bool, limiar_fixo: float | None) -> None:
    taxa = int(sd.query_devices(mic)["default_samplerate"])
    fila: queue.Queue = queue.Queue()
    estado = {"ouvindo": False, "pausado": False, "sair": False}

    def callback(dados, *_):
        if estado["ouvindo"] and not estado["pausado"]:
            fila.put(dados[:, 0].copy())

    def teclado():
        while not estado["sair"]:
            try:
                linha = input().strip().lower()
            except (EOFError, KeyboardInterrupt):
                estado["sair"] = True
                return
            if linha in {"q", "sair"}:
                estado["sair"] = True
            else:
                estado["pausado"] = not estado["pausado"]
                print("  ⏸  pausado. Enter retoma." if estado["pausado"] else "  👂 ouvindo de novo.")

    def esvaziar():
        while not fila.empty():
            fila.get_nowait()

    print(f"{NOME} em modo mãos livres · microfone: {nome_mic}")
    with sd.InputStream(device=mic, samplerate=taxa, channels=1, dtype="float32",
                        blocksize=int(taxa * BLOCO_S), callback=callback):
        # Calibra com o barulho do ambiente
        print("  calibrando o ambiente, fique em silêncio um instante...")
        estado["ouvindo"] = True
        amostra, fim = [], time.time() + CALIBRAGEM_S
        while time.time() < fim:
            try:
                amostra.append(fila.get(timeout=0.3))
            except queue.Empty:
                pass
        limiar = limiar_fixo or calibrar(amostra)
        if debug:
            print(f"  (limiar de fala: {limiar:.4f})")
        seg = Segmentador(taxa, limiar)
        print(f'  👂 ouvindo. Comece com "Oi, {NOME}", por exemplo: "Oi, {NOME}, o que tenho hoje?"')
        print("  Enter pausa ou retoma · q sai\n")
        threading.Thread(target=teclado, daemon=True).start()

        sessao, espera_ate = None, 0.0
        while not estado["sair"]:
            try:
                bloco = fila.get(timeout=0.2)
            except queue.Empty:
                continue
            fala = seg.alimentar(bloco)
            if fala is None:
                continue

            estado["ouvindo"] = False  # não escuta enquanto processa e fala
            audio = reamostrar(fala, taxa)
            if time.time() < espera_ate:
                # Pergunta que veio logo depois de só "Oi, {nome}": não precisa do nome
                texto = transcrever(audio)
                ativou, resto = separar_ativacao(texto)
                if not ativou and texto:
                    ativou, resto = True, texto
            else:
                # Primeiro só o começo, sem vocabulário, para achar o nome sem gastar o Mac
                texto = transcrever(audio[: int(TAXA_WHISPER * CHECAGEM_NOME_S)], vocab=False)
                ativou, resto = separar_ativacao(texto)
                if ativou and len(audio) > TAXA_WHISPER * CHECAGEM_NOME_S:
                    completo = transcrever(audio)
                    tem_nome, resto_completo = separar_ativacao(completo)
                    resto = resto_completo if tem_nome else completo
            espera_ate = 0.0

            if not ativou:
                if debug and texto:
                    print(f"  (ignorado: {texto})")
            else:
                subprocess.run(["afplay", SOM_ATIVOU], check=False)
                acao = comando(resto) if resto else None
                if not resto:
                    print(f"  você: Oi, {NOME}")
                    falar(f"Oi{', ' + USUARIO if USUARIO else ''}. Pode falar.")
                    espera_ate = time.time() + ESPERA_PERGUNTA_S
                elif acao == "sair":
                    falar("Até mais.")
                    estado["sair"] = True
                elif acao == "pausar":
                    estado["pausado"] = True
                    print("  ⏸  pausado. Enter retoma.")
                    falar("Pausado. Aperte Enter para eu voltar a ouvir.")
                elif acao == "nova":
                    sessao = None
                    print("  (nova conversa)")
                    falar("Certo, começando uma conversa nova.")
                else:
                    print(f"  você: {resto}")
                    sessao = responder(resto, sessao)

            time.sleep(PAUSA_POS_FALA_S)
            esvaziar()
            seg.reiniciar()
            estado["ouvindo"] = True


# ---------- uma pergunta (Atalho do macOS / Siri) ----------

DADOS = VENV_PY.parent.parent.parent      # ~/.local/share/conversar
SESSAO_UMA_VEZ = DADOS / "sessao-uma-vez.json"
LOG_UMA_VEZ = DADOS / "uma-vez.log"
CONTINUA_SESSAO_S = 600   # pergunta até 10 minutos depois da anterior continua a mesma conversa
ESPERA_FALA_S = 8         # depois do pop, quanto tempo espera você começar a falar
CALIBRAGEM_RAPIDA_S = 0.6


def notificar(texto: str) -> None:
    subprocess.run(["osascript", "-e", "on run argv", "-e",
                    'display notification (item 1 of argv) with title (item 2 of argv)', "-e", "end run",
                    texto[:220], NOME], check=False, capture_output=True)


def registrar(linha: str) -> None:
    with open(LOG_UMA_VEZ, "a") as log:
        log.write(time.strftime("%Y-%m-%d %H:%M:%S ") + linha + "\n")


def sessao_recente() -> str | None:
    try:
        dados = json.loads(SESSAO_UMA_VEZ.read_text())
        if time.time() - dados["quando"] < CONTINUA_SESSAO_S:
            return dados["id"]
    except (OSError, ValueError, KeyError):
        pass
    return None


def ouvir_uma_fala(mic: int) -> np.ndarray | None:
    """Calibra rápido, toca o pop e devolve a fala quando ela termina (None se ninguém falou)."""
    taxa = int(sd.query_devices(mic)["default_samplerate"])
    fila: queue.Queue = queue.Queue()
    with sd.InputStream(device=mic, samplerate=taxa, channels=1, dtype="float32",
                        blocksize=int(taxa * BLOCO_S), callback=lambda dados, *_: fila.put(dados[:, 0].copy())):
        amostra, fim = [], time.time() + CALIBRAGEM_RAPIDA_S
        while time.time() < fim:
            try:
                amostra.append(fila.get(timeout=0.3))
            except queue.Empty:
                pass
        seg = Segmentador(taxa, calibrar(amostra))
        subprocess.run(["afplay", SOM_ATIVOU], check=False)
        while not fila.empty():  # o próprio pop não conta como fala
            fila.get_nowait()
        limite, pico = time.time() + ESPERA_FALA_S, 0.0
        while True:
            try:
                bloco = fila.get(timeout=0.2)
            except queue.Empty:
                continue
            pico = max(pico, float(np.sqrt(np.mean(bloco ** 2))))
            fala = seg.alimentar(bloco)
            if fala is not None:
                return reamostrar(fala, taxa)
            if not seg.fala and time.time() > limite:
                # pico 0 = o macOS não deu o microfone a quem chamou (Atalhos, Terminal)
                registrar(f"sem fala: pico {pico:.4f}, limiar {seg.limiar:.4f}")
                return None


def modo_uma_vez(mic: int) -> None:
    import fcntl
    trava = open(DADOS / "uma-vez.lock", "w")
    try:
        fcntl.flock(trava, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return  # já tem uma pergunta em andamento (atalho apertado duas vezes)

    audio = ouvir_uma_fala(mic)
    if audio is None:
        falar("Não ouvi nada.")
        return
    texto = transcrever(audio)
    tem_nome, resto = separar_ativacao(texto)  # o nome no começo é opcional aqui
    pergunta = resto if tem_nome else texto
    if not pergunta:
        falar("Não entendi. Pode chamar de novo?")
        return
    if comando(pergunta) == "nova":
        SESSAO_UMA_VEZ.unlink(missing_ok=True)
        falar("Certo, a próxima pergunta começa uma conversa nova.")
        return

    print(f"você: {pergunta}")
    registrar(f"pergunta: {pergunta}")
    notificar(f"Você: {pergunta}")
    try:
        resposta, sessao = perguntar(pergunta, sessao_recente())
    except subprocess.TimeoutExpired:
        falar("O Claude demorou demais. Tente de novo.")
        return
    if sessao:
        SESSAO_UMA_VEZ.write_text(json.dumps({"id": sessao, "quando": time.time()}))
    print(f"OS: {resposta}")
    notificar(resposta)
    falar(resposta)


# ---------- painel do FoundersOS (botão de microfone) ----------

SESSAO_PAINEL = DADOS / "sessao-painel.json"


def ler_audio(caminho: str) -> np.ndarray:
    """Qualquer formato que o navegador gravar (webm, mp4, wav) -> 16 kHz mono, via ffmpeg."""
    ffmpeg = shutil.which("ffmpeg") or "/usr/local/bin/ffmpeg"
    r = subprocess.run([ffmpeg, "-v", "error", "-i", caminho, "-f", "f32le", "-ac", "1",
                        "-ar", str(TAXA_WHISPER), "-"], capture_output=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError("não consegui ler o áudio: " + r.stderr.decode(errors="ignore").strip()[-200:])
    return np.frombuffer(r.stdout, dtype=np.float32)


def modo_painel(args: list[str]) -> None:
    """Uma pergunta vinda do painel: áudio (--arquivo) ou texto (--texto). Responde em JSON e não fala;
    quem toca a voz é o servidor do FoundersOS, para a resposta aparecer na tela sem esperar o áudio."""
    def sair(**dados) -> None:
        print(json.dumps(dados, ensure_ascii=False))

    if "--nova" in args:
        SESSAO_PAINEL.unlink(missing_ok=True)
        return sair(ok=True)
    if "--texto" in args:
        pergunta = args[args.index("--texto") + 1].strip()
    else:
        audio = ler_audio(args[args.index("--arquivo") + 1])
        if len(audio) < TAXA_WHISPER // 2:
            return sair(erro="Áudio curto demais. Segure um pouco mais antes de soltar.")
        texto = transcrever(audio)
        tem_nome, resto = separar_ativacao(texto)  # o nome no começo é opcional
        pergunta = resto if tem_nome else texto
    if not pergunta:
        return sair(erro="Não entendi nada. Tente de novo, mais perto do microfone.")
    if comando(pergunta) == "nova":
        SESSAO_PAINEL.unlink(missing_ok=True)
        resposta = "Certo, a próxima pergunta começa uma conversa nova."
        return sair(pergunta=pergunta, resposta=resposta, fala=resposta, nova=True)

    sessao = None
    try:
        dados = json.loads(SESSAO_PAINEL.read_text())
        if time.time() - dados["quando"] < CONTINUA_SESSAO_S:
            sessao = dados["id"]
    except (OSError, ValueError, KeyError):
        pass
    try:
        resposta, sessao = perguntar(pergunta, sessao)
    except subprocess.TimeoutExpired:
        return sair(pergunta=pergunta, erro="O Claude demorou demais. Tente de novo.")
    if sessao:
        SESSAO_PAINEL.write_text(json.dumps({"id": sessao, "quando": time.time()}))
    sair(pergunta=pergunta, resposta=resposta, fala=para_fala(resposta))


def main() -> None:
    args = sys.argv[1:]
    if "--painel" in args:
        try:
            modo_painel(args)
        except Exception as e:  # o servidor sempre recebe JSON, nunca um traceback
            print(json.dumps({"erro": f"Falhou: {e}"}, ensure_ascii=False))
        return
    if "--listar-mics" in args:
        for i, d in enumerate(sd.query_devices()):
            if d["max_input_channels"] > 0:
                print(f"{i}: {d['name']}")
        return
    nome = args[args.index("--mic") + 1] if "--mic" in args else None
    limiar = float(args[args.index("--limiar") + 1]) if "--limiar" in args else None
    mic, nome_mic = escolher_mic(nome)
    if "--uma-vez" in args:
        try:
            modo_uma_vez(mic)
        except Exception:
            import traceback
            with open(LOG_UMA_VEZ, "a") as log:
                log.write(time.strftime("\n%Y-%m-%d %H:%M:%S\n") + traceback.format_exc())
            notificar(f"Deu erro. Detalhe em {LOG_UMA_VEZ}")
            raise
        return
    try:
        if "--maos-livres" in args:
            modo_maos_livres(mic, nome_mic, "--debug" in args, limiar)
        else:
            modo_enter(mic, nome_mic)
    except KeyboardInterrupt:
        pass
    print("Até mais.")


if __name__ == "__main__":
    main()
