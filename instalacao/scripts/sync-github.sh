#!/bin/bash
# sync-github.sh (opcional): commit + push automático do segundo cérebro para um repositório
# privado (backup e, se houver, leitura por um agente remoto), e traz o que o agente gravou.
# Roda pelo hook Stop do Claude Code (.claude/settings.json do segundo cérebro), em segundo plano,
# ao fim de cada resposta. Agendamento (launchd/cron) não serve no macOS se a pasta estiver na Mesa
# ou em Documentos: o sistema bloqueia.
# Configuração, uma vez, dentro da pasta do segundo cérebro:
#   git config os.syncRemote git@github.com:USUARIO/REPOSITORIO-PRIVADO.git
#   git config os.syncKey ~/.ssh/os_cofre      # chave só deste repositório (deploy key com escrita)
# Só faz algo se houver mudança. Trava: se algum arquivo sensível entrar na lista, aborta sem enviar.
# Log: ~/.local/share/os-sync.log
set -u
COFRE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$HOME/.local/share/os-sync.log"
mkdir -p "$(dirname "$LOG")"
REMOTO="$(git -C "$COFRE" config --get os.syncRemote)"
CHAVE="$(git -C "$COFRE" config --get os.syncKey)"
CHAVE="${CHAVE/#\~/$HOME}"
export GIT_SSH_COMMAND="ssh -i $CHAVE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o BatchMode=yes"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

cd "$COFRE" 2>/dev/null || { log "ERRO: sem acesso à pasta do segundo cérebro"; exit 1; }
[ -n "$REMOTO" ] && [ -f "$CHAVE" ] || { log "ERRO: falta git config os.syncRemote/os.syncKey"; exit 1; }
[ -d .git ] || { log "ERRO: cofre sem .git"; exit 1; }
# Outro git rodando (GitHub Desktop, Claude): tenta na próxima.
[ -f .git/index.lock ] && { log "pulado: index.lock presente"; exit 0; }
# Duas respostas seguidas disparam dois envios: só um roda; trava com mais de 10 min é resto de queda.
TRAVA=.git/os-sync.lock
find "$TRAVA" -maxdepth 0 -mmin +10 -exec rmdir {} \; 2>/dev/null
mkdir "$TRAVA" 2>/dev/null || exit 0
trap 'rmdir "$TRAVA" 2>/dev/null' EXIT

git add -A
if git diff --cached --quiet; then
  :  # nada novo para commitar; ainda assim traz o que o agente remoto enviou e envia commits pendentes
else
  # Trava de segurança: nada de PDF, contrato, documento da empresa, chave ou mídia.
  PROIBIDOS=$(git diff --cached --name-only | grep -iE '\.(pdf|pfx|p12|pem|key|env|docx|mp4|mov)$|^Documentos/|^Clientes/.*\.(html|json|txt)$' || true)
  if [ -n "$PROIBIDOS" ]; then
    git reset -q
    log "ABORTADO: arquivo sensível na lista, nada enviado: $(echo "$PROIBIDOS" | tr '\n' ' ')"
    exit 1
  fi
  N=$(git diff --cached --name-only | wc -l | tr -d ' ')
  git commit -q -m "auto: $(date '+%d/%m %H:%M') ($N arquivo(s))" || { log "ERRO no commit"; exit 1; }
fi

# Traz o que o agente remoto enviou (ele só escreve no inbox dele, então conflito é raro). Com
# conflito, desfaz e não envia: melhor parar do que sobrescrever o que o agente gravou.
if git fetch -q "$REMOTO" main 2>>"$LOG" && ! git merge-base --is-ancestor FETCH_HEAD HEAD; then
  if git rebase -q FETCH_HEAD >>"$LOG" 2>&1; then
    log "recebido do GitHub: $(git diff --name-only ORIG_HEAD HEAD 2>/dev/null | tr '\n' ' ')"
  else
    git rebase --abort 2>/dev/null
    log "ERRO: conflito ao trazer do GitHub; nada enviado. Resolver à mão."
    exit 1
  fi
fi

# Nada local para enviar: termina sem push nem linha no log.
git merge-base --is-ancestor HEAD FETCH_HEAD 2>/dev/null && { git update-ref refs/remotes/origin/main HEAD; exit 0; }

if git push -q "$REMOTO" HEAD:main 2>>"$LOG"; then
  git update-ref refs/remotes/origin/main HEAD   # GitHub Desktop vê que está em dia
  log "ok: $(git log -1 --format='%h %s')"
else
  log "ERRO no push (rede ou chave); tenta de novo na próxima"
  exit 1
fi
