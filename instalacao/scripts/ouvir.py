#!/usr/bin/env python3
"""ouvir.py: lê uma nota do OS em voz alta, com a voz de bin/falar.py.

Limpa o markdown (frontmatter, links, tabelas, checkboxes, blocos AUTO, código), escreve
valores, datas e horários como se fala e toca a nota. Com a ElevenLabs (ou o Piper), a nota vai
em trechos: o primeiro sai em poucos segundos enquanto o resto é gerado. Se a ElevenLabs cair no
meio, o que falta segue na voz de reserva. Ctrl+C para.

A nota pode ser um caminho ou um nome. O nome procura no OS pelo nome do arquivo ou pelo fim
do caminho, com as mesmas pastas ignoradas do brain.py:

    python3 bin/ouvir.py Cliente                # hub do cliente (Clientes/Cliente/Cliente.md)
    python3 bin/ouvir.py Cliente/estado         # estado: só o topo, acima do ---
    python3 bin/ouvir.py Cliente/estado --tudo  # estado inteiro, com a timeline
    python3 bin/ouvir.py memory/PRIORIDADES.md
    python3 bin/ouvir.py conecta-chat --mostrar # só mostra o texto que seria falado
    python3 bin/ouvir.py Cliente --local          # força a voz de reserva (não gasta crédito)

Voz principal, reserva e chave: ver bin/falar.py. Cada leitura pela ElevenLabs gasta um caractere
de crédito por caractere da nota; o tamanho aparece antes de começar.
"""
import json
import os
import queue
import re
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from falar import (PIPER, VOZ, VOZ_MAC, ElevenFalhou, avisar_reserva, checar, eleven_config,
                   eleven_mp3, falar_local, tocar_mp3)

OS_DIR = Path(__file__).resolve().parent.parent
CONFIG = OS_DIR / "bin/brain-config.json"
TRECHO = 300         # caracteres por trecho no Piper; menor = primeiro áudio sai mais rápido
TRECHO_ELEVEN = 800  # na ElevenLabs, trecho maior soa mais natural e o primeiro ainda sai rápido

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
         "setembro", "outubro", "novembro", "dezembro"]


# ---------- achar a nota ----------

def achar(alvo: str) -> Path:
    for base in (Path.cwd(), OS_DIR):
        p = base / alvo
        if p.is_file():
            return p
        if p.is_dir() and (p / f"{p.name}.md").is_file():
            return p / f"{p.name}.md"  # pasta de cliente: o hub
    ignorar = set(json.loads(CONFIG.read_text())["ignore_dirs"])
    notas = [p for p in OS_DIR.rglob("*.md")
             if not ignorar.intersection(p.relative_to(OS_DIR).parts)
             and not any(parte.startswith(".") for parte in p.relative_to(OS_DIR).parts)]  # .venv etc.
    chave = alvo.lower().removesuffix(".md").strip("/")

    def rel(p: Path) -> str:
        return str(p.relative_to(OS_DIR).with_suffix("")).lower()

    for criterio in (lambda p: p.stem.lower() == chave or rel(p) == chave or rel(p).endswith("/" + chave),
                     lambda p: chave in p.stem.lower()):
        achadas = sorted(p for p in notas if criterio(p))
        if len(achadas) == 1:
            return achadas[0]
        if achadas:
            lista = "\n".join("  " + str(p.relative_to(OS_DIR)) for p in achadas[:15])
            sys.exit(f"Mais de uma nota com '{alvo}', seja mais específico:\n{lista}")
    sys.exit(f"Nenhuma nota com '{alvo}'.")


def nome(nota: Path) -> str:
    return str(nota.relative_to(OS_DIR)) if nota.is_relative_to(OS_DIR) else str(nota)


# ---------- markdown -> fala ----------

def sem_frontmatter(texto: str) -> str:
    if texto.startswith("---\n"):
        fim = texto.find("\n---", 4)
        if fim != -1:
            return texto[fim + 4:]
    return texto


def so_topo(texto: str) -> str:
    """Corta na primeira divisória ---, como manda a convenção do estado.md."""
    return re.split(r"^-{3,}\s*$", texto, maxsplit=1, flags=re.MULTILINE)[0]


def limpar_inline(linha: str) -> str:
    linha = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", linha)                 # imagem
    linha = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", linha)             # [rótulo](link)
    linha = re.sub(r"\[\[[^\]|]+\|([^\]]+)\]\]", r"\1", linha)        # [[nota|apelido]]
    linha = re.sub(r"\[\[([^\]]+)\]\]",
                   lambda m: m.group(1).split("#")[0].split("/")[-1], linha)  # [[nota]]
    linha = re.sub(r"`[^`]*`", "", linha)                              # código: IDs e comandos não se leem
    linha = re.sub(r"https?://\S+", "", linha)
    linha = re.sub(r"\(\s*\)", "", linha)                               # parêntese que ficou vazio
    linha = re.sub(r"(?<!\w)[*_~]+|[*_~]+(?!\w)", "", linha)          # negrito, itálico, riscado
    return re.sub(r"\s+", " ", linha).strip()


INICIO_DE_BLOCO = re.compile(r"#|\||[-*+]\s|\d+\.\s|-{3,}")


def juntar_paragrafos(texto: str) -> list[str]:
    """Linha quebrada no meio do parágrafo volta a ser uma só, senão o ponto de pausa cai no meio da frase."""
    linhas: list[str] = []
    anterior_continua = False
    for bruta in texto.splitlines():
        linha = re.sub(r"^>\s?", "", bruta.strip())
        if not linha:
            anterior_continua = False
            continue
        if anterior_continua and not INICIO_DE_BLOCO.match(linha):
            linhas[-1] += " " + linha
        else:
            linhas.append(linha)
        anterior_continua = not linha.startswith(("#", "|"))
    return linhas


def linhas_faladas(texto: str) -> list[str]:
    texto = re.sub(r"<!--.*?-->", "", texto, flags=re.DOTALL)
    texto = re.sub(r"^```.*?^```", "", texto, flags=re.DOTALL | re.MULTILINE)
    saida = []
    for linha in juntar_paragrafos(texto):
        if re.fullmatch(r"-{3,}|\|?[\s:|-]+\|?", linha):
            continue
        if linha.startswith("|"):
            linha = ", ".join(c.strip() for c in linha.strip("|").split("|") if re.search(r"\w", c))
        linha = re.sub(r"^#+\s*", "", linha)
        linha = re.sub(r"^[-*+]\s+\[ \]\s*", "Pendente: ", linha)
        linha = re.sub(r"^[-*+]\s+\[[xX]\]\s*", "Feito: ", linha)
        linha = re.sub(r"^([-*+]|\d+\.)\s+", "", linha)
        linha = limpar_inline(linha)
        if not linha:
            continue
        if linha[-1].isalnum() or linha[-1] in ")\"'":
            linha += "."  # pausa entre título, item e parágrafo
        saida.append(linha)
    return saida


def data_falada(dia: str, mes: str, ano: str | None = None) -> str:
    d, m = int(dia), int(mes)
    if not (1 <= d <= 31 and 1 <= m <= 12):
        return f"{dia}/{mes}" + (f"/{ano}" if ano else "")
    texto = ("primeiro" if d == 1 else str(d)) + " de " + MESES[m - 1]
    return texto + (f" de {ano}" if ano else "")


def reais(inteiro: str, centavos: str | None) -> str:
    n = int(inteiro.replace(".", ""))
    texto = f"{n} {'real' if n == 1 else 'reais'}"
    if centavos and int(centavos):
        texto += f" e {int(centavos)} centavos"
    return texto


def pronunciavel(texto: str) -> str:
    """Valores, datas e horários escritos como se fala; a voz erra nos formatos com símbolo."""
    texto = re.sub(r"R\$\s?(\d[\d.]*)(?:,(\d{2}))?", lambda m: reais(m.group(1), m.group(2)), texto)
    texto = re.sub(r"\b(\d{4})-(\d{2})-(\d{2})\b", lambda m: data_falada(m.group(3), m.group(2), m.group(1)), texto)
    texto = re.sub(r"\b(\d{2})/(\d{2})/(\d{4})\b", lambda m: data_falada(*m.groups()), texto)
    texto = re.sub(r"\b(\d{2})/(\d{2})\b", lambda m: data_falada(*m.groups()), texto)
    texto = re.sub(r"\b(\d{1,2}):(\d{2})\b",
                   lambda m: f"{int(m.group(1))} horas" + (f" e {int(m.group(2))}" if int(m.group(2)) else ""),
                   texto)
    texto = re.sub(r"\b\d{1,3}(?:\.\d{3})+\b", lambda m: m.group(0).replace(".", ""), texto)
    texto = re.sub(r"(?<=\w)-(?=\w)", " ", texto)  # nome de arquivo (conecta-chat) e palavra composta
    return texto.replace("%", " por cento")


def trechos(linhas: list[str], tamanho: int = TRECHO) -> list[str]:
    frases = [f for linha in linhas for f in re.split(r"(?<=[.!?:])\s+", linha) if f]
    saida, atual = [], ""
    for frase in frases:
        if atual and len(atual) + len(frase) > tamanho:
            saida.append(atual)
            atual = frase
        else:
            atual = f"{atual} {frase}".strip()
    return saida + ([atual] if atual else [])


# ---------- tocar ----------

def tocar(linhas: list[str], local: bool) -> None:
    cfg = None if local else eleven_config()
    try:
        if cfg:
            tocar_eleven(trechos(linhas, TRECHO_ELEVEN), cfg)
        else:
            tocar_reserva(linhas)
    except KeyboardInterrupt:
        print("\n(parado)")


def tocar_reserva(linhas: list[str]) -> None:
    if VOZ_MAC:
        falar_local(" ".join(linhas))  # o say começa a falar na hora, não precisa de trechos
    else:
        tocar_piper(trechos(linhas))


def tocar_eleven(partes: list[str], cfg: dict) -> None:
    """Uma thread busca os MP3 em ordem (até dois adiantados) enquanto o principal toca."""
    prontos: queue.Queue = queue.Queue(maxsize=2)

    def buscar():
        for i, parte in enumerate(partes):
            try:
                mp3 = eleven_mp3(parte, cfg, partes[i - 1] if i else "",
                                 partes[i + 1] if i + 1 < len(partes) else "")
            except ElevenFalhou as e:
                prontos.put((i, e))
                return
            prontos.put((i, mp3))
        prontos.put((len(partes), None))

    threading.Thread(target=buscar, daemon=True).start()
    while True:
        i, item = prontos.get()
        if item is None:
            return
        if isinstance(item, ElevenFalhou):
            avisar_reserva(item)
            tocar_reserva(partes[i:])
            return
        tocar_mp3(item)


def tocar_piper(partes: list[str]) -> None:
    """Um único processo do Piper gera os trechos em ordem; cada WAV pronto já vai para o afplay."""
    with tempfile.TemporaryDirectory() as pasta:
        piper = subprocess.Popen(
            [str(PIPER), "-m", str(VOZ), "-d", pasta],
            stdin=subprocess.PIPE, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL,
            text=True, env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        prontos: queue.Queue = queue.Queue()
        erros: list[str] = []

        def ler_log():
            for linha in piper.stderr:
                m = re.search(r"Wrote (.+\.wav)\s*$", linha)
                if m:
                    prontos.put(m.group(1))
                else:
                    erros.append(linha.strip())
            prontos.put(None)

        threading.Thread(target=ler_log, daemon=True).start()
        piper.stdin.write("\n".join(partes) + "\n")
        piper.stdin.close()

        tocador = None
        try:
            while (wav := prontos.get()) is not None:
                tocador = subprocess.Popen(["afplay", wav])
                tocador.wait()
                Path(wav).unlink(missing_ok=True)
        except KeyboardInterrupt:
            print("\n(parado)")
        finally:
            for p in (tocador, piper):
                if p and p.poll() is None:
                    p.terminate()
            piper.wait()
        if piper.returncode not in (0, -15) and erros:
            sys.exit("Piper falhou: " + erros[-1])


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if not args:
        sys.exit(__doc__.split("\n\n")[2])
    nota = achar(" ".join(args))
    texto = sem_frontmatter(nota.read_text(encoding="utf-8"))
    if nota.name == "estado.md" and "--tudo" not in flags:
        texto = so_topo(texto)
    linhas = [pronunciavel(l) for l in linhas_faladas(texto)]
    partes = trechos(linhas)
    if not partes:
        sys.exit(f"{nome(nota)} não tem texto para ler.")

    if "--mostrar" in flags:
        print("\n".join(partes))
        return
    checar()
    minutos = sum(len(p.split()) for p in partes) / 150  # ~150 palavras por minuto
    local = "--local" in flags
    custo = "" if local or not eleven_config() else f", {sum(len(p) for p in partes)} caracteres de crédito"
    print(f"Lendo {nome(nota)} (~{max(1, round(minutos))} min{custo}). Ctrl+C para parar.")
    tocar(linhas, local)


if __name__ == "__main__":
    main()
