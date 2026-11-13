# Estúdio de Conteúdo dentro do painel (opcional, pergunta 13h)

O **Estúdio de Conteúdo** é um pacote à parte (skill `estudio-de-conteudo` com um programa local) que
cria, revisa, agenda e publica no Instagram e no TikTok pelo **Zernio** (grátis), com resposta
automática no direct ("comenta QUERO, recebe no direct", sem ManyChat), comentários, pauta e números.
Com esta integração, ele abre **dentro do painel** (botão ✦ ESTÚDIO ou tecla E), no visual do OS, com
as abas Semana, Pauta, Posts, Feed, Conversas, Resultados e Ajustes.

O kit **não traz o pacote do estúdio**: ele é de outro autor. O cliente precisa ter o zip
`estudio-de-conteudo-v<versão>.zip` (1.7.0 ou mais novo). Sem ele, o botão ✦ ESTÚDIO continua abrindo
o Estúdio Social (o quadro das peças), como antes.

## Instalar (uns 15 minutos)
1. **O pacote:** descompacte em `~/.claude/skills/estudio-de-conteudo` e siga o `COMECE-AQUI.md` dele
   ("instala meu estúdio"). O programa vai para `~/estudio-conteudo/app`, fora do segundo cérebro:
   posts, vídeos e a chave do Zernio não sobem para o GitHub nem para agentes remotos. Termine com
   `node --test` em `fail 0`.
2. **A marca:** a entrevista da marca do próprio estúdio (R3), com os dados que o OS já tem do cliente.
3. **A integração:** `python3 instalacao/estudio-de-conteudo/aplicar-integracao.py` (ou passe a pasta do
   app, se não for a padrão). Ele guarda os originais com `.antes-os` e pode rodar de novo.
4. **O painel:** se o estúdio não estiver em `~/estudio-conteudo/app`, grave o caminho em
   `missionControl.estudioApp` do `config/workspace.json`. Reinicie o painel.
5. **Testar:** tecla **E**. Tem que abrir a Semana do estúdio no visual do painel, com **Peças** e
   **◂ OS** no canto direito; Esc volta para o grafo. Em modo demonstração nada é publicado.
   Clique em **Peças**: abre a Produção (Em criação, Para aprovar, Aprovado, No Estúdio). Numa peça
   pronta, a Prévia mostra **Mandar para o Estúdio**; enviada, ela aparece em Posts do estúdio em
   alguns segundos, sem data.
6. **Publicar de verdade (quando o cliente quiser):** ele cria a conta no zernio.com, cola a chave em
   Ajustes → Contas (nunca no chat) e clica em Conectar no Instagram. O login abre na janela inteira e
   volta sozinho para o painel, já em Ajustes.

## Regras para escrever no Social do OS do cliente
A skill do estúdio deixa agendar sem perguntar e manda toda ideia para a Pauta dela. Combine com o
cliente e escreva no `Social/CLAUDE.md` dele o que vale, por exemplo:
- antes de agendar ou publicar, mostrar a prévia e perguntar; só seguir com o sim;
- ideias passam pela aprovação do cliente antes de entrar na Pauta;
- resposta automática no direct só liga com o texto mostrado e o sim do cliente;
- a chave do Zernio só o cliente cola, na tela.

## Atualizar o estúdio
"Atualiza meu estúdio" copia a pasta `app` nova por cima e desfaz a integração. Depois de atualizar,
rode `aplicar-integracao.py` de novo. Se ele disser que não achou o trecho esperado, a versão do
estúdio mudou: leia o script e aplique as quatro mudanças à mão.
