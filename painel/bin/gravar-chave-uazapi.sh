#!/bin/zsh
# Grava a URL do servidor e o token da INSTÂNCIA do Uazapi em ~/.uazapi.env, sem mostrar o
# token na tela nem deixar no histórico. Não use o Admin Token aqui: ele administra o servidor
# inteiro e não deve morar nesta máquina.
#   zsh bin/gravar-chave-uazapi.sh
read -r "u?URL do servidor Uazapi (ex.: https://seuservidor.uazapi.com): "
u="${u%/}"
if [[ "$u" != https://* ]]; then echo "A URL precisa começar com https://. Nada foi gravado."; exit 1; fi
read -rs "t?Cole o token da INSTÂNCIA (não o Admin Token) e tecle Enter: "
echo
if [[ -z "$t" ]]; then echo "Nada colado. Nada foi gravado."; exit 1; fi
umask 077
printf 'UAZAPI_URL=%s\nUAZAPI_TOKEN=%s\n' "$u" "$t" > ~/.uazapi.env
chmod 600 ~/.uazapi.env
unset t
echo "Gravado em ~/.uazapi.env. Teste com: python3 bin/whatsapp.py status"
