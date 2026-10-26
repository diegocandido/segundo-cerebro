#!/bin/zsh
# Grava a chave do Asaas sem mostrar na tela nem deixar no histórico.
#   zsh bin/gravar-chave-asaas.sh            -> produção (~/.asaas.env)
#   zsh bin/gravar-chave-asaas.sh sandbox    -> sandbox  (~/.asaas-sandbox.env)
# Recusa chave do ambiente errado: produção começa com $aact_prod_, sandbox com $aact_hmlg_.
if [[ "$1" == "sandbox" ]]; then
  arq=~/.asaas-sandbox.env; prefixo='$aact_hmlg_'; nome="SANDBOX"
else
  arq=~/.asaas.env; prefixo='$aact_prod_'; nome="PRODUÇÃO"
fi
read -rs "k?Cole a chave de $nome do Asaas e tecle Enter: "
echo
if [[ -z "$k" ]]; then echo "Nada colado. Nada foi gravado."; exit 1; fi
if [[ "$k" != ${~prefixo}* ]]; then
  echo "Essa chave não parece de $nome (deveria começar com $prefixo). Nada foi gravado."
  unset k; exit 1
fi
umask 077
printf 'ASAAS_API_KEY=%s\n' "$k" > "$arq"
chmod 600 "$arq"
unset k
echo "Chave de $nome gravada em $arq. Pode voltar para o chat."
