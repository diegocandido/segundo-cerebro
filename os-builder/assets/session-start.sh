#!/usr/bin/env bash
# SessionStart hook: injeta contexto no comeco de cada sessao do Claude Code.
#   1. as prioridades atuais
#   2. onde a pessoa parou (as pendencias do ultimo diario)
#   3. a saude do OS, e SO quando ha algo a fazer
#
# A terceira parte e silenciosa quando esta tudo limpo, de proposito: gastar contexto
# todo dia dizendo que esta tudo bem treina a pessoa a nao ler o bloco, e no dia em que
# houver problema ela tambem nao le.
#
# Instalacao: salvar em .claude/hooks/session-start.sh, dar permissao de execucao, e
# registrar em .claude/settings.json:
#   { "hooks": { "SessionStart": [ { "hooks": [
#       { "type": "command",
#         "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh\"" } ] } ] } }
# Para desativar: remover o bloco SessionStart do settings.json.

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# ---- ajustar estes tres caminhos se o OS usar outros nomes -------------------
PRIORIDADES="$ROOT/memory/PRIORIDADES.md"
DIARIO_DIR="$ROOT/memory/diario"
BRAIN="$ROOT/bin/brain.py"
# -----------------------------------------------------------------------------

if [ -f "$PRIORIDADES" ]; then
  echo "### Prioridades atuais (memory/PRIORIDADES.md)"
  # do titulo ate a secao de "nao fazer agora", sem o rodape
  sed -n '/^# /,/^## Nao fazer agora/p' "$PRIORIDADES" 2>/dev/null \
    || head -40 "$PRIORIDADES"
  echo
fi

ULTIMO=$(ls -1 "$DIARIO_DIR"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md 2>/dev/null | sort | tail -1)
if [ -n "$ULTIMO" ]; then
  echo "### Onde parei, ultimo diario ($(basename "$ULTIMO" .md))"
  awk '/^## Pend/{f=1} f' "$ULTIMO" | head -15
  echo
fi

if command -v python3 >/dev/null 2>&1 && [ -f "$BRAIN" ]; then
  (cd "$ROOT" && python3 "$BRAIN" doctor --json 2>/dev/null | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
probs = d.get("problemas") or {}
if not probs:
    sys.exit(0)     # silencioso quando esta limpo
ROTULO = {
    "link_quebrado": "link quebrado", "wikilink_ambiguo": "wikilink ambiguo",
    "orfa": "nota orfa", "tipo_invalido": "tipo fora do enum",
    "sem_frontmatter": "sem frontmatter", "indice_defasado": "indice defasado",
    "estado_defasado": "estado compilado velho",
    "placeholder_pendente": "contexto por preencher",
    "referencia_fantasma": "roteador citando o que nao existe",
    "sem_elo_com_hub": "nota sem elo com o hub",
    "nome_datado_sem_assunto": "nome datado sem assunto",
}
print("### OS: " + str(d["total_problemas"]) + " ponto(s) de atencao")
for k, v in sorted(probs.items(), key=lambda x: -len(x[1])):
    print("- " + ROTULO.get(k, k) + ": " + str(len(v)))
print("Detalhe: `python3 bin/brain.py doctor` - conserto mecanico: `python3 bin/brain.py indexar`")
')
fi
