# Guia das ferramentas do kit

Cada ferramenta tem: o que resolve, como ligar, como testar e como fica no painel. O painel de
cada ferramenta (o que abre ao clicar no ícone no grafo) vem de `config/apps.json` no painel
instalado, campo `detalhes`. Troque todo `*(preencher)*` pelo que o cliente respondeu.

---

## Google Calendar e Gmail

- **Ligar:** conectores do Claude (no app, em Conectores). Não usam chave na máquina.
- **Testar:** liste os eventos de hoje e os e-mails não lidos dos últimos 3 dias. Mostre ao
  cliente.
- **No painel:** `live` quando o teste passou. Sem conector, tire do `apps.json`.

---

## tl;dv (reuniões)

- **O que resolve:** a reunião vira nota do cliente ou do prospect no OS (quem é, o que disse,
  o que foi combinado, próximos passos) sem ninguém escrever ata.
- **Ligar:**
  1. O cliente cria a conta em tldv.io e conecta a agenda. A gravação entra sozinha nas reuniões
     com link.
  2. Defina a fonte do `/reuniao` (resposta 5 do bloco 5): transcrição colada no chat, página do
     Notion (integração do tl;dv com o Notion) ou link da reunião.
  3. Crie o comando a partir de [comandos/reuniao.md.tmpl](comandos/reuniao.md.tmpl), com os
     caminhos e a fonte do cliente.
- **Testar:** com uma reunião real (ou a transcrição de uma), rode `/reuniao` e confira a nota
  criada, o estado atualizado e o `doctor` limpo.
- **Plano gratuito:** a gravação é arquivada em 2 dias e a transcrição deixa de abrir. Escreva
  isso nas regras do comando e no `COMO-USAR.md`.
- **No painel:** `live` depois do teste; antes, `sugerido`.

---

## Asaas (cobranças)

- **O que resolve:** cobrança avulsa por Pix, boleto ou cartão, criada pelo painel com prévia e
  confirmação; visão de vencidas, a vencer e recebidas na tecla C.
- **Ligar, sempre nesta ordem:**
  0. **Se a fase 0 já resolveu** (conta, chave gravada e `testar-asaas.js` com `ASAAS OK`), pule
     para o passo 3.
  1. **Sandbox.** O cliente cria a conta de teste em sandbox.asaas.com, cadastra um cliente de
     teste e gera a chave em Integrações.
  2. O cliente grava a chave **pelo terminal** (nunca no chat):
     `zsh <pasta-do-painel>/bin/gravar-chave-asaas.sh sandbox`
     (no Windows, peça para criar o arquivo `%USERPROFILE%\.asaas-sandbox.env` com a linha
     `ASAAS_API_KEY=...` num editor de texto). O script recusa chave do ambiente errado.
     Rode o comando numa aba de terminal, não pelo "!" do chat: o `read` precisa de teclado.
     Confira, só lendo: `node <pasta-do-painel>/bin/testar-asaas.js` (tem que sair `ASAAS OK`).
  3. Em `config/asaas.json`: `"ambiente": "sandbox"`, `valorMaximo` (resposta 9) e `formas`
     (resposta 10: `PIX`, `BOLETO`, `CREDIT_CARD`, `UNDEFINED`).
  4. **Teste no sandbox:** o cliente abre o Mission Control, clica em Nova cobrança, revisa e
     confirma uma cobrança pequena. Confira pela API que ela existe. Depois, tecla C.
  5. **Produção, só se o cliente pedir:** ele grava a chave de produção
     (`zsh <pasta-do-painel>/bin/gravar-chave-asaas.sh`), você muda `"ambiente": "producao"` e
     registra a decisão no OS. Confira só lendo (tecla C) que o painel enxerga a conta real.
- **No ritual de abrir o dia** (se o Asaas estiver ligado), acrescente:
  > **Cobranças (Asaas):** abra `http://127.0.0.1:5210/api/asaas/cobrancas` (só leitura) e traga
  > vencidas e não pagas, o que vence nos próximos 3 dias e o que entrou nos últimos 2. Cobrança
  > vencida vira recomendação (lembrete ao cliente, rascunhado para aprovação). Este ritual nunca
  > cria, cancela nem cobra nada: cobrança nova só pelo botão do Mission Control.
- **No painel:** `live` depois do teste no sandbox, com `"acoes": ["cobrancas", "nova-cobranca"]`.

---

## WhatsApp pelo Uazapi

- **O que resolve:** o OS lê as conversas do WhatsApp (quem falou, o que pediu, o que ficou
  combinado) e manda mensagem com a confirmação do dono. Com isso o ritual de abrir o dia e o
  `/reuniao` deixam de depender de o cliente lembrar o que foi falado no WhatsApp.
- **O que NÃO faz neste kit:** atendimento automático, resposta sem confirmação e disparo em
  massa. Um número por vez, sempre com o "pode mandar".
- **Risco, dito antes (resposta 13 do bloco 5):** o Uazapi não é a API oficial da Meta; simula o
  WhatsApp Web. Uso automatizado demais pode bloquear o número. Sem o "sim" do cliente para esse
  risco, não ligue: fica `a-definir` com a necessidade registrada numa decisão.
- **Ligar:**
  1. **Instância.** No painel do uazapiGO (quem tem o servidor, resposta 13), crie uma instância
     para o cliente, com o nome dele. **Cada número conectado ocupa um dispositivo do plano**: se o
     plano já estiver no máximo, a instância nova não conecta e nem o QR nem o código aparecem.
     Confira o limite antes da sessão com o cliente e nunca desconecte a instância de outra pessoa
     para abrir vaga. O **Admin Token** do servidor fica com
     quem administra o servidor e **nunca** vai para a máquina do cliente nem para o chat.
  2. **Token da instância, pelo terminal** (nunca no chat), numa aba de terminal e não pelo "!":
     `zsh <pasta-do-painel>/bin/gravar-chave-uazapi.sh`. Ele pede a URL do servidor e o token
     da instância e grava em `~/.uazapi.env`. Confira depois que o token gravado **não** é o Admin
     Token (compare só o começo, sem exibir o token).
     - **Plano B, quando o token da instância não aparece no painel:** quem administra o servidor
       grava o Admin Token pelo mesmo script, digitando ele mesmo, e na sequência roda
       `python3 bin/whatsapp.py trocar-token` (lista as instâncias, sem tokens) e
       `trocar-token --instancia <nome>`. O script troca o Admin Token pelo token da instância no
       mesmo minuto, e o Admin Token sai da máquina do cliente. Não use a instância de outra pessoa:
       confira nome, status e perfil na lista antes de escolher.
  3. **Script no OS:** copie [scripts/whatsapp.py](scripts/whatsapp.py) para `bin/whatsapp.py`
     do segundo cérebro.
  4. **Conectar o número:** `python3 bin/whatsapp.py conectar --telefone 55DDDNUMERO` devolve um
     código de 8 caracteres; no celular: WhatsApp > Aparelhos conectados > Conectar aparelho >
     "Conectar com número de telefone". Sem `--telefone`, o QR code é salvo em PNG e aberto.
     Não repita o comando enquanto o `status` disser `connecting`. Se o número já foi conectado
     pelo painel do Uazapi, pule este passo.
  5. **Regras e decisão no OS:** use [templates/whatsapp-no-os.md.tmpl](templates/whatsapp-no-os.md.tmpl):
     o trecho do roteador raiz, a decisão (com o risco aceito) e, se a proposta sai pelo WhatsApp,
     a regra de proposta com registro no estado do cliente.
  6. **No ritual de abrir o dia:** os três trechos do mesmo modelo (coleta, formato e regra). O
     ritual só lê e sugere; nunca responde.
- **Testar, nesta ordem, com o cliente olhando:**
  1. `python3 bin/whatsapp.py status`: conectado, com o perfil dele.
  2. `conversas --limite 5` e `mensagens <numero>` de uma conversa real.
  3. Mensagem para o próprio número do cliente: `enviar <numero dele> --texto "..."` (prévia), e
     com `--confirmo` só depois do "pode mandar". Confira com `mensagens <numero dele>`.
  4. Se a proposta sai pelo WhatsApp: um PDF de teste para o próprio número com `enviar-arquivo`,
     do mesmo jeito, e o cliente confirma no celular que o arquivo chegou.
- **Nono dígito:** muitos celulares brasileiros estão no WhatsApp sem o 9 (55 DD XXXXXXXX). O
  script procura a conversa nas duas formas; para enviar, use o número como o cliente digita.
- **Comandos do script:**
  - `status`: o número está conectado?
  - `conectar [--telefone 55...]`: liga o número (código de pareamento ou QR code).
  - `conversas [--limite 20] [--nao-lidas] [--busca nome]`: conversas mais recentes.
  - `mensagens <numero> [--limite 20]`: as últimas mensagens de uma conversa.
  - `enviar <numero> --texto "..." [--confirmo]`: sem `--confirmo` só mostra a prévia.
  - `enviar-arquivo <numero> --arquivo proposta.pdf [--texto legenda] [--confirmo]`: manda PDF,
    DOCX, XLSX ou imagem (até 15 MB), com a mesma regra de prévia e confirmação. Serve para
    proposta, se o cliente decidir que proposta sai pelo número dele.
- **Dados pessoais (LGPD):** no OS guarde o que foi combinado (decisão, valor, prazo, próximo
  passo) no estado do cliente, não a conversa inteira.
- **Receber em tempo real** (webhook do Uazapi) precisa de um endereço público, e o painel só
  escuta na própria máquina. Não faz parte deste kit; se o cliente precisar, é um projeto à parte
  (n8n ou servidor recebendo o webhook).
- **No painel:** `live` depois do teste, com `chave` em `~/.uazapi.env`.

---

## Instagram (API oficial da Meta)

- **O que resolve:** o OS publica carrossel no Instagram do cliente pela API oficial, depois do
  "pode postar" dele para aquele post, e guarda o histórico do que saiu, para a mesma legenda não
  sair duas vezes.
- **O que NÃO faz neste kit:** agendar sozinho (a API não agenda; o agendamento é uma tarefa do
  Claude que roda o comando no dia), apagar, editar, responder comentário ou mandar direct.
  Publicar sem o "pode postar" também não.
- **Antes, com o cliente (resposta 13c do bloco 5):**
  - A conta do Instagram é **profissional** (Criador ou Empresa) e **pública**? No app: Configurações
    > Tipo de conta.
  - Ela está **ligada a uma Página do Facebook**? No app: Central de Contas, ou nas configurações da
    Página. Sem Página, ligue primeiro; sem isso a API não alcança a conta.
  - Ele tem (ou pode criar) um **app na Meta**, em developers.facebook.com? Se já usa uma ferramenta
    de atendimento com app próprio na Meta, esse app costuma servir, se tiver a permissão de
    publicar aprovada.
- **Ligar (o cliente faz os cliques e cola o token; o Claude não cria conta nem digita token):**
  1. **App.** Em [developers.facebook.com/apps](https://developers.facebook.com/apps), **Criar app**,
     caso de uso **Outro**, tipo **Empresa**, ligado ao portfólio empresarial do cliente. Nome
     sugerido: "OS" e o nome da empresa. Com o app em modo de desenvolvimento, quem administra o app
     publica nas contas dele sem passar por revisão da Meta.
  2. **Token de usuário.** Em [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/),
     escolha o app, "Token do usuário", e marque as permissões `instagram_basic`,
     `instagram_content_publish`, `pages_show_list` e `pages_read_engagement`. **Generate Access
     Token** e marque a Página ligada ao Instagram.
  3. **Estender.** Ícone ⓘ ao lado do token > **Abrir na Ferramenta de Token de Acesso** >
     **Estender token de acesso**. Copie o token estendido. **Nunca cole no chat.**
  4. **Script no OS:** copie [scripts/instagram.py](scripts/instagram.py) para `bin/instagram.py`
     do segundo cérebro.
  5. **Gravar, pelo terminal** (numa aba de terminal, não pelo "!"):
     `python3 bin/instagram.py gravar-token --conta <usuario.do.instagram>`, e o cliente cola o
     token. Ele não aparece na tela. O script troca pelo **token da Página**, que não vence, grava em
     `~/.instagram.env` só com permissão do usuário e descarta o token colado. Sem `--conta`, só
     grava se o token alcançar uma conta só; se alcançar várias, lista e pede para escolher.
     Se o cliente já tem um token de Página guardado, o mesmo comando aceita ele direto.
  6. **Regras e decisão no OS:** use [templates/instagram-no-os.md.tmpl](templates/instagram-no-os.md.tmpl):
     o trecho do roteador raiz, a decisão e o passo a passo de publicação.
- **Testar, com o cliente olhando:**
  1. `python3 bin/instagram.py status`: a conta certa, "Token: não vence" e a cota do dia.
  2. Prévia sem publicar: `publicar --imagens <2 links https de JPEG> --legenda-arquivo legenda.txt`.
     Ela confere se as imagens abrem, se são JPEG e se a legenda cabe, e não publica nada.
  3. Publicar de verdade só se o cliente quiser um post de teste agora, com `--confirmo`, depois do
     "pode postar". Ele confere no app e apaga, se quiser, pelo próprio Instagram.
- **O que a API exige:** imagens **só em JPEG**, até 8 MB, em **link público https** (a Meta busca
  a imagem pelo endereço; arquivo no computador não serve). De 2 a 20 slides, no formato do
  primeiro (carrossel do Instagram costuma ser 1080×1350). Legenda de até 2.200 caracteres, 30
  hashtags e 20 menções. Até 3 colaboradores por post e 100 posts pela API em 24 horas.
- **De onde vêm os slides:** do modelo de carrossel do cliente (pergunta 13e), em JPEG pelo
  `bin/carrossel_jpeg.py`, pelo guia [templates/carrossel-no-os.md.tmpl](templates/carrossel-no-os.md.tmpl).
- **Onde hospedar as imagens:** qualquer endereço público que o cliente já tenha (site, Vercel,
  Netlify, armazenamento em nuvem com link público). Subir imagem é publicação: só com o ok dele.
- **Comandos do script:**
  - `gravar-token [--conta usuario]`: grava o token, escondido.
  - `status`: conta, validade do token e cota do dia.
  - `publicar --imagens URL1 URL2 ... --legenda-arquivo legenda.txt [--colaborador conta]
    [--marcar conta] [--titulo nome] [--confirmo] [--repetir]`: sem `--confirmo` só mostra a
    prévia; `--colaborador` convida outra conta como coautora (ela aceita no app); `--marcar`
    marca a conta no slide 01; `--repetir` deixa sair de novo uma legenda que já consta no histórico.
- **Histórico:** cada post publicado entra em `Social/instagram/publicados-instagram.jsonl` do segundo
  cérebro, com data, conta, link e uma assinatura da legenda. Se a área de redes sociais do cliente
  tiver outro nome, o arquivo continua nesse caminho; cite-o no índice da área.
- **No painel:** `live` depois do `status` passar, com o item `app:instagram` do
  `config/apps.json.example`.

---

## Carrossel vivo (opcional, pergunta 13f)

- **O que resolve:** o carrossel aprovado vira um carrossel de vídeos. Cada slide sai em MP4 em
  loop (1080x1350, 30 fps, 6 ou 8 segundos, música a -14 LUFS), com o quadro 0 igual ao JPEG e a
  emenda do loop sem pulo. O texto nunca some: o movimento é carimbo, pulso, deslize curto e linha
  que se redesenha.
- **De quem é o motor:** da skill **criador-de-carrosseis-simples**, do Felpborges
  ([github.com/Felpborges/criador-de-carrosseis-simples](https://github.com/Felpborges/criador-de-carrosseis-simples)).
  O repositório não tem licença declarada, então o Kit **não leva cópia** dela: o instalador
  baixa a skill direto do repositório do autor, numa versão fixa testada com o Kit, e aplica por
  cima três ajustes do Kit ([carrossel-vivo/ajustar-skill.py](carrossel-vivo/ajustar-skill.py)).
  O que é do Kit é a ponte entre o modelo de carrossel e o motor
  ([carrossel-vivo/vivo.js](carrossel-vivo/vivo.js)) e o script `carrossel_vivo.py`.
- **Pré-requisitos:** Mac ou Linux, git, Node 18+, Python 3 e ffmpeg (no Mac, `brew install
  ffmpeg`; o instalador faz isso sozinho se o Homebrew existir). Uns 400 MB livres.
- **Ligar:**
  1. Da pasta do Kit, numa aba de terminal: `bash instalacao/carrossel-vivo/instalar.sh`. Ele
     instala a skill em `~/.claude/skills/`, o Python dela (`.venv` com numpy, scipy e Pillow), o
     motor de renderização em `~/.carrossel-vivo/motor` (Playwright e o Chromium dele) e a ponte
     em `~/.carrossel-vivo/ponte`. Nada disso entra no segundo cérebro. Pode rodar de novo: o que
     já existe fica.
  2. Copie [scripts/carrossel_vivo.py](scripts/carrossel_vivo.py) para o `bin/` do segundo cérebro.
  3. Acrescente na nota do carrossel (`{{AREA_SOCIAL}}/carrossel.md`) a seção "Versão viva" do guia
     [templates/carrossel-no-os.md.tmpl](templates/carrossel-no-os.md.tmpl).
- **Testar, com o cliente olhando:** com o carrossel de teste já aprovado em JPEG,
  `python3 bin/carrossel_vivo.py <pasta-do-carrossel>`. Leva de 3 a 6 minutos. Só vale se terminar
  com **"TODOS OS LOOPS E QUADROS 0 FECHAM"**. Os MP4 saem em `<pasta>/mp4/`; o `preview.html` do
  projeto (o caminho aparece no fim) mostra os 5 tocando lado a lado. Mostre e ajuste até o "aprovado".
- **Coreografia:** a padrão já conhece o modelo do Kit (capa, slides de conteúdo e CTA). Para uma sob
  medida num post, rode com `--so-montar`, escreva a coreografia no `VIVO.iniciar({...})` de cada
  `src/slides/slide-NN.html` do projeto (em `~/.carrossel-vivo/projetos/<nome>/`, regras no topo do
  `vivo.js`) e rode de novo sem opção. Se o texto dos slides mudar depois, `--refazer`.
- **Publicar:** com o "pode postar", os MP4 sobem pelo app do Instagram, na ordem, sem música do
  Instagram por cima (o vídeo já tem a dele). O `bin/instagram.py` ainda não publica vídeo.
- **Atualizar a skill:** não atualize sozinho. Uma versão nova do autor só entra no Kit depois de
  testada; aí muda a versão fixa no `instalar.sh`.
- **No painel:** os MP4 aparecem no Estúdio Social (tecla E), no detalhe da peça, tocando em loop.

---

## Criador de carrosséis e Estúdio Social (opcional, pergunta 13g)

- **O que resolve:** o Claude cria o carrossel inteiro com a skill **criador-de-carrosseis-simples**
  (do Felpborges, a mesma do carrossel vivo): estratégia, estrutura, copy slide a slide com
  legenda, capa, design em código (PNG 1080x1350), crítica com nota e, se pedido, a versão viva.
  O cliente acompanha tudo no **Estúdio Social** do painel: um quadro com uma coluna por etapa (Em
  criação, Para aprovar, Aprovado, Publicado), a capa de cada peça, os slides, os vídeos e a
  legenda. Com a tela aberta, ela relê as pastas a cada 8 segundos: a peça que o Claude está
  fazendo aparece com o selo "fazendo agora".
- **Ligar:**
  1. Da pasta do Kit, numa aba de terminal: `bash instalacao/carrossel-vivo/instalar.sh` (se a 13f
     já instalou, pule). Ele baixa a skill do autor em `~/.claude/skills/` e o motor de
     renderização. Confira: `ls ~/.claude/skills/criador-de-carrosseis-simples/SKILL.md`.
  2. Crie no OS a pasta das peças, `{{AREA_SOCIAL}}/carrosseis/` (o padrão do painel é
     `Social/carrosseis`). Outra pasta vai em `config/workspace.json`, em
     `missionControl.carrosseisDirs` (lista; aceita caminho relativo ao OS, absoluto ou com `~`).
     Ponha `carrosseis` em `excludeDirs` para o grafo não ler os arquivos de trabalho das peças.
  3. Na nota do carrossel do OS (`{{AREA_SOCIAL}}/carrossel.md`), acrescente a seção "Estúdio
     Social" do guia [templates/carrossel-no-os.md.tmpl](templates/carrossel-no-os.md.tmpl): cada
     peça é uma subpasta `AAAA-MM-DD-tema` criada com
     `python3 ~/.claude/skills/criador-de-carrosseis-simples/scripts/novo-projeto.py {{AREA_SOCIAL}}/carrosseis/AAAA-MM-DD-tema`,
     e a etapa fica no `status.txt` da peça.
- **O `status.txt` de cada peça** (o Claude escreve; o painel só lê):
  ```
  etapa: para aprovar        (criando | para aprovar | aprovado | publicado)
  data: 08/01/2026           dia previsto ou da publicação
  rede: Instagram
  link: https://...          o post publicado, quando houver
  ```
  Sem `status.txt`, o painel deduz: sem imagem é "Em criação", com imagem é "Para aprovar".
  "Aprovado" e "Publicado" só aparecem quando o Claude escreve, depois do "aprovado" e do "pode
  postar" do cliente.
- **Testar, com o cliente olhando:** com o painel aberto na tecla E, peça um carrossel de teste com
  tema real. A peça aparece em Em criação assim que a pasta nasce e passa para Para aprovar quando
  os PNGs saem. Clique nela: os slides aparecem em tamanho de celular, com a legenda. Depois do
  "aprovado", o Claude escreve `etapa: aprovado` e o cartão muda de coluna.
- **Entende os dois formatos:** projeto da skill (`resultados/estatico/slide-NN.png`,
  `resultados/slide-NN.mp4`) e o carrossel do modelo de 5 slides do Kit (`jpeg/`, `mp4/`). Os dois
  aparecem no mesmo quadro.
- **No painel:** botão ✦ ESTÚDIO e tecla **E**; faixa "Estúdio Social" no alto do Mission Control
  com as peças em produção; card na tela Gestão. Só leitura: aprovar e postar continuam no Claude.

---

## PandaDoc (orçamentos automatizados)

- **O que resolve:** orçamento ou proposta montada a partir de um modelo com campos (cliente,
  itens, valores, prazo), preenchida pelo OS a partir do estado do cliente e da tabela de preços,
  com assinatura eletrônica e aviso de leitura.
- **Pré-requisitos:** tabela de preços ou pacotes do cliente no OS (resposta 15). Sem tabela, o
  orçamento automatizado vira pendência.
- **Ligar (quando o cliente decidir):**
  1. Conta no PandaDoc e um modelo de orçamento com os campos nomeados.
  2. Chave da API gravada pelo terminal em `~/.pandadoc.env` (`PANDADOC_API_KEY=...`), nunca no
     chat.
  3. Um comando do OS (ex.: `/orcamento`) que monta o documento como **rascunho** a partir do
     modelo; o envio é do dono, depois do "pode mandar", e fica registrado no estado do cliente.
- **Hoje no kit:** não há script do PandaDoc pronto. Registre a ferramenta como `sugerido` e o
  comando como pendência no `COMO-USAR.md` ("no que ainda não ajuda").

---

## Voz: conversar com o segundo cérebro (opcional, só Mac com chip Apple)

- **O que resolve:** perguntar ao OS falando ("Oi, {nome}, o que tenho hoje?") e ouvir a
  resposta, pelo botão 🎙 do painel, pelo terminal ou em modo mãos livres. Só consulta.
- **Ligar:**
  1. Copie para o `bin/` do segundo cérebro: [scripts/conversar.py](scripts/conversar.py),
     [scripts/falar.py](scripts/falar.py), [scripts/ouvir.py](scripts/ouvir.py) e, se o cliente
     quiser ouvir toda resposta do Claude, [scripts/falar_resposta.py](scripts/falar_resposta.py).
  2. Copie [scripts/assistente.json.example](scripts/assistente.json.example) para
     `bin/assistente.json` e preencha com as respostas da pergunta 17 (nome, ativação sem acento,
     como chamar o dono, siglas que o Whisper costuma errar em `vocabulario_extra`).
  3. Ambiente de voz, com o "pode" do cliente: `ffmpeg` (Homebrew) e um venv em
     `~/.local/share/conversar/.venv` com `mlx-whisper sounddevice numpy` (Python 3.11 ou mais).
     O modelo do Whisper baixa na primeira transcrição.
  4. ElevenLabs (se escolhida): o cliente grava `ELEVENLABS_API_KEY=...` em `~/.elevenlabs.env`
     pelo terminal; a voz vai em `voz_elevenlabs`. Sem chave, fala com a voz do macOS.
  5. Opcional: o alias `cerebro` (`python3 .../bin/conversar.py --maos-livres`) e, para ouvir
     cada resposta do Claude, o hook Stop com `falar_resposta.py` no `.claude/settings.json`.
- **Testar:** `python3 bin/falar.py --checar`; `python3 bin/conversar.py --listar-mics`; uma
  pergunta pelo walkie-talkie (`python3 bin/conversar.py`, Enter grava, Enter para) e uma pelo
  botão 🎙 do painel no Chrome ou Safari.
- **Privacidade:** o áudio é transcrito no Mac e apagado; só o texto da pergunta vai ao Claude e,
  com ElevenLabs, o texto da resposta vai à ElevenLabs.

---

## Livro-caixa (opcional)

- **O que resolve:** despesas e recebimentos do dia a dia num lugar só, lançados pelo Claude
  ("lança R$ 89 do ChatGPT de hoje") e vistos no painel (tecla L).
- **Ligar:** copie [scripts/livro_caixa.py](scripts/livro_caixa.py) para o `bin/` do segundo
  cérebro e crie a pasta `Financeiro/comprovantes/` **ao lado** do segundo cérebro (fora dele,
  para não ir a backup nem a agente). O primeiro uso cria o `livro-caixa.csv`.
- **Regra para o OS:** no roteador, "lançar só depois do ok do dono"; o Claude nunca estima valor.
- **Testar:** `python3 bin/livro_caixa.py lancar --data AAAA-MM-DD --natureza despesa --quem Teste
  --valor 1 --categoria outros`, depois `mes` e a tecla L no painel. Apague a linha de teste do CSV.

---

## Agente remoto e backup no GitHub (opcional)

- **O que resolve:** um agente fora do computador (Telegram, servidor) que sabe a agenda do dia e
  anota despesas, recebimentos, pedidos de cobrança e de proposta, para o dono aprovar no ritual
  da manhã. Nada sai sem o "pode mandar".
- **Ligar:**
  1. Repositório **privado** no GitHub para o segundo cérebro, com `.gitignore` que tira PDFs,
     contratos, `.env` e chaves.
  2. Chave só para ele: `ssh-keygen -t ed25519 -f ~/.ssh/os_cofre`; o cliente cola a parte
     pública em Settings → Deploy keys do repositório, com escrita.
  3. Copie [scripts/sync-github.sh](scripts/sync-github.sh) para `bin/` e configure, dentro do
     segundo cérebro: `git config os.syncRemote git@github.com:USUARIO/REPO.git` e
     `git config os.syncKey ~/.ssh/os_cofre`.
  4. Hook Stop no `.claude/settings.json`: `nohup bash "$CLAUDE_PROJECT_DIR/bin/sync-github.sh"
     >/dev/null 2>&1 & exit 0`. Envia e traz ao fim de cada resposta do Claude.
  5. Crie o `AGENTS.md` do segundo cérebro a partir de
     [templates/agente-remoto.md.tmpl](templates/agente-remoto.md.tmpl) e a pasta
     `inbox/agente/` (com `financeiro/` e `propostas/`).
  6. No ritual de abrir o dia, ligue os passos opcionais do agente (agenda em `memory/hoje.md`,
     lançamentos e pedidos do agente).
  7. No painel, aponte `missionControl.propostasDir` para `inbox/agente/propostas` e
     `agenteFinanceiroDir` para `inbox/agente/financeiro`.
  8. O agente precisa de chave própria para enviar ao repositório (outra deploy key com escrita).
- **Testar:** mande ao agente uma despesa de teste; confira que o arquivo chegou ao `inbox/` do
  computador e apareceu no ritual; descarte.
- **Cuidado:** o agente não roda scripts do `bin/` (o livro-caixa, por exemplo, não existe no
  servidor e responderia "zero").
