#!/bin/bash
# instalar.sh: prepara o carrossel vivo (cada slide do carrossel em MP4 em loop, com música) no
# computador do cliente. Roda uma vez, de dentro da pasta do Kit:
#
#     bash instalacao/carrossel-vivo/instalar.sh
#
# O que faz, na ordem (o que já existe fica como está, então pode rodar de novo):
#   1. Confere git, Node 18+, Python 3 e ffmpeg (instala o ffmpeg pelo Homebrew, se houver).
#   2. Instala a skill criador-de-carrosseis-simples DIRETO DO REPOSITÓRIO DO AUTOR
#      (github.com/Felpborges/criador-de-carrosseis-simples), na versão testada com o Kit.
#      O Kit não leva cópia da skill: ela é do autor.
#   3. Aplica os ajustes do Kit na skill (ajustar-skill.py).
#   4. Cria o Python da skill (.venv com numpy, scipy e Pillow), para a música e os testes.
#   5. Monta o motor de renderização em ~/.carrossel-vivo/motor (Playwright e o Chromium dele).
#   6. Copia a ponte do Kit (vivo.js) para ~/.carrossel-vivo/ponte.
# Ocupa uns 400 MB no total (o Chromium e o Python com scipy são a maior parte). Nada vai para o OS.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
SK="$HOME/.claude/skills/criador-de-carrosseis-simples"
BASE="$HOME/.carrossel-vivo"
REPO="https://github.com/Felpborges/criador-de-carrosseis-simples.git"
VERSAO="0c0323d44ecdf69c501145a27af0796763efaff5"   # versão testada com o Kit (13/10/2026)
PLAYWRIGHT="1.64.1"
PYBASE="${PYBASE:-python3}"

passo() { printf '\n== %s\n' "$1"; }
falta() { printf '\nFALTA: %s\n' "$1"; exit 1; }

passo "1/6 Conferindo as ferramentas"
command -v git >/dev/null || falta "git. No Mac: xcode-select --install"
command -v node >/dev/null || falta "Node.js 18 ou mais (nodejs.org)"
NODE_MAIOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAIOR" -ge 18 ] || falta "Node.js 18 ou mais (este é o $(node -v))"
command -v "$PYBASE" >/dev/null || falta "Python 3 (python.org)"
if ! command -v ffmpeg >/dev/null; then
  if command -v brew >/dev/null; then echo "instalando o ffmpeg pelo Homebrew..."; brew install ffmpeg
  else falta "ffmpeg. No Mac: instale o Homebrew (brew.sh) e rode: brew install ffmpeg"; fi
fi
echo "git, node $(node -v), $($PYBASE --version), ffmpeg: ok"

passo "2/6 Skill criador-de-carrosseis-simples (do autor)"
if [ -f "$SK/SKILL.md" ]; then
  echo "já instalada em $SK (mantida como está)"
else
  mkdir -p "$HOME/.claude/skills"
  git clone -q "$REPO" "$SK"
  git -C "$SK" -c advice.detachedHead=false checkout -q "$VERSAO"
  echo "instalada em $SK (versão ${VERSAO:0:7})"
fi

passo "3/6 Ajustes do Kit na skill"
"$PYBASE" "$AQUI/ajustar-skill.py" "$SK"

passo "4/6 Python da skill (numpy, scipy, Pillow)"
if ! "$SK/.venv/bin/python" -c "import numpy, scipy.signal, PIL" 2>/dev/null; then
  rm -rf "$SK/.venv"
  "$PYBASE" -m venv "$SK/.venv"
  "$SK/.venv/bin/python" -m pip install -q --upgrade pip
  "$SK/.venv/bin/python" -m pip install -q numpy scipy pillow
fi
"$SK/.venv/bin/python" -c "import numpy, scipy.signal, PIL; print('numpy', numpy.__version__, '· scipy', scipy.__version__, '· Pillow', PIL.__version__)"

passo "5/6 Motor de renderização (Playwright + Chromium)"
mkdir -p "$BASE/motor"
if [ ! -f "$BASE/motor/node_modules/playwright/package.json" ]; then
  cd "$BASE/motor"
  [ -f package.json ] || echo '{"name":"motor-carrossel-vivo","private":true}' > package.json
  npm install --silent --no-audit --no-fund "playwright@$PLAYWRIGHT"
  cd "$AQUI"
fi
# só o Chromium sem janela, que é o que o motor usa (o completo ocupa uns 400 MB a mais)
( cd "$BASE/motor" && npx --yes playwright install --only-shell chromium >/dev/null )
echo "motor em $BASE/motor (playwright $(node -p "require('$BASE/motor/node_modules/playwright/package.json').version"))"

passo "6/6 Ponte do Kit"
mkdir -p "$BASE/ponte" "$BASE/projetos"
cp "$AQUI/vivo.js" "$BASE/ponte/vivo.js"
echo "ponte em $BASE/ponte/vivo.js"

printf '\nCARROSSEL VIVO INSTALADO.\nTeste: python3 bin/carrossel_vivo.py <pasta-de-um-carrossel>\n'
