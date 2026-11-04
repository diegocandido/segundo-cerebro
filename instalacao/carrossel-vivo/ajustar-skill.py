#!/usr/bin/env python3
"""ajustar-skill.py: aplica na skill criador-de-carrosseis-simples os 3 ajustes que o Kit precisa.

A skill é do autor dela (github.com/Felpborges/criador-de-carrosseis-simples) e é instalada direto do
repositório dele pelo instalar.sh. O Kit não leva cópia da skill: leva só estes ajustes, que rodam por
cima e podem rodar quantas vezes for preciso (o que já está aplicado fica como está).

    python3 ajustar-skill.py [pasta-da-skill]

1. scripts/novo-projeto.py e scripts/render.mjs procuram o Playwright em ~/.carrossel-vivo/motor
   (o motor que o instalar.sh monta), e não numa pasta do computador do autor.
2. scripts/render.mjs abre o Chrome com --disable-partial-raster. Sem isso o Chrome redesenha só
   pedaços da tela, deixa resíduo nas bordas e o último quadro não bate com o primeiro (o loop emenda).
3. scripts/vivo.sh usa o Python do ambiente da skill (.venv, com numpy, scipy e Pillow), e não o
   python3 do sistema, que pode ter um scipy quebrado (comum com Anaconda).
"""
import sys
from pathlib import Path

SK = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / ".claude/skills/criador-de-carrosseis-simples").expanduser()
if not (SK / "SKILL.md").exists():
    sys.exit(f"skill não encontrada em {SK}")

MOTOR_PY = "os.path.join(HOME, '.carrossel-vivo/motor')"
MOTOR_JS = "(process.env.HOME + '/.carrossel-vivo/motor')"
VENV = ('# Python com numpy+scipy+Pillow: o .venv da skill, se existir (ajuste do Kit OS do Cara da IA)\n'
        'PY=${PY:-python3}; [ -x "$HOME/.claude/skills/criador-de-carrosseis-simples/.venv/bin/python" ] && '
        'PY="$HOME/.claude/skills/criador-de-carrosseis-simples/.venv/bin/python"\n')
mudou = []


# 1a. novo-projeto.py: pw = os.environ.get('PLAYWRIGHT_DIR') or <qualquer caminho>
p = SK / "scripts/novo-projeto.py"
linhas = p.read_text().splitlines(keepends=True)
for k, l in enumerate(linhas):
    if l.startswith("pw = os.environ.get('PLAYWRIGHT_DIR') or ") and MOTOR_PY not in l:
        linhas[k] = f"pw = os.environ.get('PLAYWRIGHT_DIR') or {MOTOR_PY}\n"
        p.write_text("".join(linhas))
        mudou.append("novo-projeto.py: Playwright em ~/.carrossel-vivo/motor")
        break

# 1b e 2. render.mjs
p = SK / "scripts/render.mjs"
s = p.read_text()
ini = "process.env.PLAYWRIGHT_DIR || "
i = s.find(ini)
if i >= 0 and not s[i + len(ini):].startswith(MOTOR_JS):
    j = s.find(", 'package.json')", i)
    if j > 0:
        s = s[:i + len(ini)] + MOTOR_JS + s[j:]
        mudou.append("render.mjs: Playwright em ~/.carrossel-vivo/motor")
if "--disable-partial-raster" not in s and "'--font-render-hinting=none'" in s:
    s = s.replace("'--font-render-hinting=none'", "'--font-render-hinting=none', '--disable-partial-raster'", 1)
    mudou.append("render.mjs: --disable-partial-raster")
p.write_text(s)

# 3. vivo.sh
p = SK / "scripts/vivo.sh"
s = p.read_text()
if "PY=${PY:-python3}" not in s:
    s = s.replace("set -e\n", "set -e\n" + VENV, 1)
    mudou.append("vivo.sh: Python do .venv da skill")
if "python3 scripts/" in s:
    s = s.replace("python3 scripts/", "$PY scripts/")
    mudou.append("vivo.sh: scripts Python pelo $PY")
p.write_text(s)

print("ajustes aplicados:" if mudou else "a skill já estava ajustada.")
for m in mudou:
    print(" -", m)
