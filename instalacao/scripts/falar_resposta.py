#!/usr/bin/env python3
"""falar_resposta.py: lê em voz alta a última resposta do Claude Code. É o hook Stop do OS.

Registrado no .claude/settings.json do segundo cérebro (hook Stop), roda ao fim de cada
resposta: pega o texto que o Claude acabou de escrever, tira o markdown (mesma limpeza do
bin/ouvir.py: links, tabelas, código, valores e datas por extenso), corta em até LIMITE
caracteres numa frase inteira e fala com a voz do macOS (bin/falar.py --local, VOZ_MAC): local,
na hora e sem gastar o crédito da ElevenLabs, que fica para o ritual da manhã, a assistente por voz
e o ouvir (as respostas, faladas a cada turno, esgotavam o plano). Volta na hora: a fala
segue em segundo plano. Uma resposta nova interrompe a anterior.

Fica quieta sozinha quando algum app de reunião está gravando do microfone (bin/microfone.py:
Zoom, Teams, Meet, Granola...). Para silenciar à mão, com ou sem prazo: bin/voz.py
(silenciar, silenciar 2h, falar, status).
"""
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from microfone import apps_gravando  # noqa: E402
from ouvir import linhas_faladas, pronunciavel  # noqa: E402
from voz import silenciada  # noqa: E402

FALAR = Path(__file__).resolve().parent / "falar.py"
LIMITE = 700  # caracteres por resposta (~40 s); o resto fica só na tela

DADOS = Path.home() / ".local/share/conversar"
PID = DADOS / "fala-resposta.pid"


def texto_da_resposta(entrada: dict) -> str:
    """A última resposta: do campo do hook, ou do fim do transcript até a última fala do usuário."""
    if entrada.get("last_assistant_message"):
        return entrada["last_assistant_message"]
    caminho = entrada.get("transcript_path")
    if not caminho or not Path(caminho).exists():
        return ""
    partes: list[str] = []
    for linha in reversed(Path(caminho).read_text(encoding="utf-8").splitlines()):
        try:
            item = json.loads(linha)
        except ValueError:
            continue
        conteudo = (item.get("message") or {}).get("content")
        if item.get("type") == "assistant" and isinstance(conteudo, list):
            textos = [b.get("text", "") for b in conteudo if b.get("type") == "text"]
            partes[:0] = [t for t in textos if t.strip()]
        elif item.get("type") == "user":
            # resultado de ferramenta também chega como "user"; só para numa fala de verdade
            if isinstance(conteudo, str) or any(b.get("type") == "text" for b in conteudo or []):
                break
    return "\n\n".join(partes)


def cortar(texto: str) -> str:
    if len(texto) <= LIMITE:
        return texto
    trecho = texto[:LIMITE]
    fim = max(trecho.rfind(". "), trecho.rfind("! "), trecho.rfind("? "))
    return trecho[: fim + 1] if fim > LIMITE // 3 else trecho.rsplit(" ", 1)[0] + "."


def calar_anterior() -> None:
    """A fala anterior roda num grupo de processos próprio (python, afplay ou say): mata o grupo."""
    try:
        os.killpg(int(PID.read_text()), signal.SIGTERM)
    except (OSError, ValueError):
        pass


def main() -> None:
    if silenciada() or apps_gravando():  # silêncio pedido, ou reunião em andamento
        return
    try:
        entrada = json.load(sys.stdin)
    except ValueError:
        entrada = {}
    fala = cortar(" ".join(pronunciavel(l) for l in linhas_faladas(texto_da_resposta(entrada))))
    if not fala.strip():
        return
    calar_anterior()
    DADOS.mkdir(parents=True, exist_ok=True)
    voz = subprocess.Popen([sys.executable, str(FALAR), "--local"], stdin=subprocess.PIPE, text=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           start_new_session=True)  # continua falando depois que o hook sai
    voz.stdin.write(fala)
    voz.stdin.close()
    PID.write_text(str(voz.pid))


if __name__ == "__main__":
    main()
