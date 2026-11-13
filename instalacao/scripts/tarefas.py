#!/usr/bin/env python3
"""tarefas.py: as tarefas do painel (tela Tarefas, tecla T) pelo terminal.

O painel é o dono das tarefas de execução: projetos e quadro (A fazer, Fazendo, Feito), guardados
no state/todos.json dele. Este script só repassa para o bin/tarefas.js do painel, que é quem lê e
grava. Leitura é livre. Escrita só roda com --confirmo, e o Claude só passa --confirmo depois do
"pode" no chat (nível Advisor).

    python3 bin/tarefas.py projetos                     # projetos e quantas tarefas abertas
    python3 bin/tarefas.py listar [PROJETO] [--todas]   # tarefas abertas (PROJETO: nome, pedaço do nome ou id)
    python3 bin/tarefas.py pendentes [--dias N]         # abertas atrasadas ou vencendo em N dias (padrão 0)
    python3 bin/tarefas.py criar "título" [--projeto NOME] [--prazo AAAA-MM-DD] [--descricao "..."] [--prioridade high] --confirmo
    python3 bin/tarefas.py mover ID open|doing|done --confirmo
    python3 bin/tarefas.py concluir ID --confirmo
    python3 bin/tarefas.py criar-projeto "nome" --confirmo
    (leitura aceita --json)
"""
import os
import shutil
import sys
from pathlib import Path

OS_ROOT = Path(__file__).resolve().parent.parent
# o painel fica numa pasta ao lado do OS (qualquer nome) ou, em último caso, dentro dele
CANDIDATOS = sorted(d for d in OS_ROOT.parent.iterdir() if d.is_dir() and d != OS_ROOT) + [OS_ROOT / "painel"]


def main() -> None:
    script = next((c / "bin" / "tarefas.js" for c in CANDIDATOS if (c / "bin" / "tarefas.js").exists()), None)
    if not script:
        sys.exit("Não achei o painel: nenhuma pasta ao lado de " + str(OS_ROOT) + " tem bin/tarefas.js.")
    node = shutil.which("node")
    if not node:
        sys.exit("O painel precisa do Node.js instalado (comando node).")
    os.execv(node, [node, str(script), *sys.argv[1:]])


if __name__ == "__main__":
    main()
