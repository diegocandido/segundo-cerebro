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
  1. **Sandbox.** O cliente cria a conta de teste em sandbox.asaas.com, cadastra um cliente de
     teste e gera a chave em Integrações.
  2. O cliente grava a chave **pelo terminal** (nunca no chat):
     `zsh <pasta-do-painel>/bin/gravar-chave-asaas.sh sandbox`
     (no Windows, peça para criar o arquivo `%USERPROFILE%\.asaas-sandbox.env` com a linha
     `ASAAS_API_KEY=...` num editor de texto). O script recusa chave do ambiente errado.
     Rode o comando numa aba de terminal, não pelo "!" do chat: o `read` precisa de teclado.
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
