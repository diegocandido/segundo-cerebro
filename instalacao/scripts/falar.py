#!/usr/bin/env python3
"""falar.py: lê um texto em voz alta.

Voz principal: ElevenLabs, com a voz de `voz_elevenlabs` em bin/assistente.json.
O texto vai para a API da ElevenLabs e volta como MP3, tocado pelo afplay e apagado em seguida.
A chave mora em ~/.elevenlabs.env (ELEVENLABS_API_KEY=...), nunca no OS nem no chat; no mesmo
arquivo dá para trocar a voz (ELEVENLABS_VOICE_ID=...) e o modelo (ELEVENLABS_MODEL=...).

Reserva, 100% local: sem chave, sem internet, sem crédito ou com qualquer erro da API, fala com
a voz do macOS de `voz_mac` (assistente.json), pelo `say`. Com `voz_mac` vazio, a reserva vira o
Piper, na pasta de `piper_dir`.

    python3 bin/falar.py <<'TEXTO'
    Bom dia. ...
    TEXTO
    python3 bin/falar.py "Texto curto"
    python3 bin/falar.py --checar      # confere a ElevenLabs (chave e crédito) e a voz de reserva
    python3 bin/falar.py --local "..." # força a voz de reserva
    python3 bin/falar.py --rapido "..." # modelo Flash: começa mais rápido e gasta metade do crédito
"""
from __future__ import annotations  # permite `dict | None` no Python 3.9 do Mac
import json
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ELEVEN_ENV = Path.home() / ".elevenlabs.env"
ELEVEN_API = "https://api.elevenlabs.io/v1"


def _config() -> dict:
    try:
        return json.loads((Path(__file__).resolve().parent / "assistente.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


CFG = _config()
ELEVEN_VOZ = CFG.get("voz_elevenlabs") or "KHmfNHtEjHhLK9eER20w"  # padrão: Fernanda - Natural Conversations (biblioteca)
ELEVEN_MODELO = "eleven_multilingual_v2"   # o de melhor pt-BR; eleven_flash_v2_5 gasta metade e responde mais rápido
ELEVEN_MODELO_RAPIDO = "eleven_flash_v2_5"  # usado nas respostas do Claude (bin/falar_resposta.py)
ELEVEN_TIMEOUT = 30                        # segundos; passou disso, cai na reserva

VOZ_MAC = CFG.get("voz_mac", "Luciana (Enhanced)")  # reserva local; "" usa o Piper
PIPER_DIR = Path(CFG.get("piper_dir") or "~/.local/share/piper").expanduser()
PIPER = PIPER_DIR / ".venv/bin/piper"
VOZ = PIPER_DIR / "voices/pt_BR-faber-medium.onnx"
LIMITE = 2000  # caracteres; voz é para resumo, não para ler documento (para isso, bin/ouvir.py)
TIMEOUT = 60   # segundos para o Piper gerar o áudio


# ---------- ElevenLabs ----------

class ElevenFalhou(Exception):
    pass


def eleven_config() -> dict | None:
    """Lê ~/.elevenlabs.env. None quando não há chave: aí a fala vai direto para a reserva."""
    if not ELEVEN_ENV.exists():
        return None
    cfg = {}
    for linha in ELEVEN_ENV.read_text().splitlines():
        if "=" in linha and not linha.lstrip().startswith("#"):
            k, v = linha.split("=", 1)
            cfg[k.strip()] = v.strip().strip("\"'")
    return cfg if cfg.get("ELEVENLABS_API_KEY") else None


def eleven_pedir(cfg: dict, caminho: str, corpo: dict | None = None) -> bytes:
    req = urllib.request.Request(
        ELEVEN_API + caminho, method="POST" if corpo is not None else "GET",
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={"xi-api-key": cfg["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=ELEVEN_TIMEOUT) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        try:
            detalhe = json.loads(e.read()).get("detail", {})
            motivo = detalhe.get("message") or detalhe.get("status") if isinstance(detalhe, dict) else str(detalhe)
        except (ValueError, AttributeError):
            motivo = None
        raise ElevenFalhou(f"HTTP {e.code}" + (f", {motivo}" if motivo else "")) from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise ElevenFalhou(f"sem conexão ({getattr(e, 'reason', e)})") from None


def eleven_mp3(texto: str, cfg: dict, anterior: str = "", seguinte: str = "",
               modelo: str | None = None) -> bytes:
    """Texto -> MP3. anterior/seguinte mantêm a entonação contínua quando a nota vai em trechos."""
    corpo = {"text": texto, "model_id": modelo or cfg.get("ELEVENLABS_MODEL") or ELEVEN_MODELO}
    if "flash" in corpo["model_id"] or "turbo" in corpo["model_id"]:
        corpo["language_code"] = "pt"  # só esses modelos aceitam fixar o idioma
    if anterior:
        corpo["previous_text"] = anterior
    if seguinte:
        corpo["next_text"] = seguinte
    voz = cfg.get("ELEVENLABS_VOICE_ID") or ELEVEN_VOZ
    return eleven_pedir(cfg, f"/text-to-speech/{voz}?output_format=mp3_44100_128", corpo)


def tocar_mp3(mp3: bytes) -> None:
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        f.write(mp3)
        f.flush()
        subprocess.run(["afplay", f.name], check=False)


def avisar_reserva(erro: Exception) -> None:
    print(f"(ElevenLabs indisponível: {erro}. Usando a voz de reserva.)", file=sys.stderr)


# ---------- reserva local ----------

def checar() -> None:
    """Confere a voz de reserva, a que tem de funcionar sempre."""
    global VOZ_MAC
    if VOZ_MAC:
        vozes = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
        instalada = lambda v: any(linha.startswith(v + " ") for linha in vozes.splitlines())
        if instalada(VOZ_MAC):
            return
        # Sem a versão Enhanced (Mac novo), usa a comum, que vem com o macOS, em vez de calar tudo
        comum = VOZ_MAC.split(" (")[0]
        if comum != VOZ_MAC and instalada(comum):
            print(f"(Voz {VOZ_MAC} não instalada; a reserva usa {comum}. Para a melhor, baixe em Ajustes do "
                  "Sistema > Acessibilidade > Conteúdo Falado > Voz do Sistema > Gerenciar Vozes.)", file=sys.stderr)
            VOZ_MAC = comum
            return
        sys.exit(f"Voz {VOZ_MAC} não instalada. Baixe em Ajustes do Sistema > Acessibilidade > "
                 "Conteúdo Falado > Voz do Sistema > Gerenciar Vozes.")
    faltando = [str(p) for p in (PIPER, VOZ, VOZ.with_suffix(".onnx.json")) if not p.exists()]
    if faltando:
        sys.exit("Piper incompleto, falta: " + ", ".join(faltando))


def falar_local(texto: str) -> None:
    if VOZ_MAC:
        r = subprocess.run(["say", "-v", VOZ_MAC], input=texto, text=True, capture_output=True)
        if r.returncode not in (0, -2):  # -2: interrompido com Ctrl+C
            sys.exit("say falhou: " + (r.stderr.strip() or "sem detalhe"))
        return
    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        gerar = subprocess.run(
            [str(PIPER), "-m", str(VOZ), "-f", wav.name],
            input=texto, text=True, capture_output=True, timeout=TIMEOUT,
        )
        if gerar.returncode != 0:
            sys.exit("Piper falhou: " + (gerar.stderr.strip().splitlines() or ["sem detalhe"])[-1])
        subprocess.run(["afplay", wav.name], check=False)


def falar(texto: str, local: bool = False, modelo: str | None = None) -> None:
    """Fala o texto e só volta quando terminar: ElevenLabs se der, reserva local se não."""
    cfg = None if local else eleven_config()
    if cfg:
        try:
            mp3 = eleven_mp3(texto, cfg, modelo=modelo)
        except ElevenFalhou as e:
            avisar_reserva(e)
        else:
            tocar_mp3(mp3)
            return
    falar_local(texto)


def checar_tudo() -> None:
    checar()
    print(f"Reserva: {VOZ_MAC or 'Piper pt_BR-faber-medium'} ok.")
    cfg = eleven_config()
    if not cfg:
        print(f"ElevenLabs: sem chave em {ELEVEN_ENV}, falando só com a reserva.")
        return
    voz = cfg.get("ELEVENLABS_VOICE_ID") or ELEVEN_VOZ
    try:
        info = json.loads(eleven_pedir(cfg, f"/voices/{voz}"))
        print(f"ElevenLabs: chave ok, voz \"{info.get('name', voz)}\".")
    except ElevenFalhou as e:
        dica = " Se for voz da biblioteca, adicione-a em My Voices no site." if "HTTP 4" in str(e) and "401" not in str(e) else ""
        print(f"ElevenLabs: falhou ao consultar a voz {voz} ({e}). Vai falar com a reserva.{dica}")
        return
    try:
        plano = json.loads(eleven_pedir(cfg, "/user/subscription"))
        print(f"Crédito: {plano['character_count']} de {plano['character_limit']} caracteres usados no mês.")
    except (ElevenFalhou, KeyError, ValueError):
        print("Crédito: a chave não tem permissão para ler o plano (tudo bem, a fala funciona).")


def main() -> None:
    args = sys.argv[1:]
    local, rapido = "--local" in args, "--rapido" in args
    args = [a for a in args if a not in ("--local", "--rapido")]
    if args == ["--checar"]:
        checar_tudo()
        return
    checar()
    texto = " ".join(args) if args else sys.stdin.read()
    texto = " ".join(texto.split())
    if not texto:
        sys.exit("Nada para falar.")
    if len(texto) > LIMITE:
        texto = texto[:LIMITE].rsplit(" ", 1)[0]
    falar(texto, local, ELEVEN_MODELO_RAPIDO if rapido else None)


if __name__ == "__main__":
    main()
