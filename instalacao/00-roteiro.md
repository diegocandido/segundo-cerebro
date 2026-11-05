# Roteiro de instalação

Oito fases, nesta ordem. Cada uma termina com algo que o cliente vê funcionando. Mantenha uma
lista de tarefas visível com as fases.

## Fase 0: terreno (antes de qualquer pergunta)

Confira, sem pedir nada ao cliente:
- `node --version` (precisa ser 18 ou mais; o painel não tem dependências).
- `python3 --version` (o `bin/brain.py` do segundo cérebro usa Python 3).
- Sistema operacional (macOS, Windows ou Linux): muda os comandos de abrir arquivo e de terminal.
- Quais conectores o Claude tem nesta sessão (Google Calendar, Gmail, Notion). Anote: isso vira
  resposta pronta para a pergunta de ferramentas.

Diga ao cliente, em até 5 linhas, o que vai acontecer: entrevista, diagnóstico para ele aprovar,
construção do segundo cérebro, instalação do painel, ligação das ferramentas e um primeiro teste.
Avise que a entrevista leva de 20 a 40 minutos e que nada é criado antes de ele aprovar.

Se faltar Node ou Python, diga como instalar e espere. Não instale nada sem o "pode".

### Dados do Asaas, logo no início

Antes da entrevista, pergunte se o cliente cobra pelo Asaas ou quer começar a cobrar por ele
(uma linha: boleto, Pix e cartão, avulso e recorrente, e o painel mostra e cria cobrança com
prévia). Se a resposta for sim, resolva agora o que depende dele, para a chave já estar pronta
quando o painel for ligado:

1. **Conta de teste.** Ele já tem conta no sandbox (sandbox.asaas.com)? Se não, cria agora, cadastra
   um cliente de teste e gera a chave em Integrações. Se já usa o Asaas de verdade, a conta real
   fica para depois: o kit sempre começa no sandbox.
2. **Chave pelo terminal, nunca pelo chat.** Peça que ele abra uma aba de terminal na pasta do kit e
   rode `zsh painel/bin/gravar-chave-asaas.sh sandbox` (no Windows, o arquivo
   `%USERPROFILE%\.asaas-sandbox.env` com a linha `ASAAS_API_KEY=...`). Espere ele dizer que gravou.
3. **Teste, só leitura:** `node painel/bin/testar-asaas.js`. Tem que sair `ASAAS OK (sandbox)` com o
   nome da conta. Chave recusada: ele gera outra e grava de novo.
4. **As três respostas de cobrança**, já anotadas para a config do painel: quem pode criar cobrança
   (recomende só o dono, pelo painel), o valor máximo de uma cobrança normal e as formas aceitas
   (Pix, Boleto, Cartão, cliente escolhe).

Se ele ainda não decidiu, siga em frente: a rodada 3 do bloco 5 volta ao assunto. Na rodada 3,
o que já foi respondido aqui só é confirmado.

## Fase 1: entrevista (os-builder + bloco do kit)

Siga `os-builder/SKILL.md` e `os-builder/references/01-entrevista.md` (blocos 0 a 4). Depois do
bloco 4, rode o **bloco 5 do kit**, em [01-perguntas-extras.md](01-perguntas-extras.md): marca do
painel, reuniões (tl;dv), cobrança (Asaas), WhatsApp, orçamentos (PandaDoc) e o horário do Morning
Brief.

Nada do cliente é criado nesta fase.

### Fecho da entrevista: a prévia do painel

Terminadas as perguntas, antes do diagnóstico, mostre ao cliente como o painel vai ficar. Rode,
da pasta do kit, em segundo plano:

```bash
node painel/bin/previa.js --nome "<nome que vai no topo, resposta 1>" [--logo <PNG do cliente>]
```

Ela copia o painel para uma pasta temporária, aponta para o OS de demonstração do kit
(`instalacao/demo-os/`, só dados de exemplo), confere tudo sozinha e só sobe se passar. Quando
aparecer `PRÉVIA NO AR: http://127.0.0.1:<porta>`, abra o endereço no navegador (o painel do app
do Claude ou o Chrome) e percorra com ele, em 2 minutos: o grafo, a tecla **M** (Mission Control,
com a faixa do Estúdio Social), a **G** (Gestão) e a **E** (Estúdio Social, com o carrossel de
exemplo). Diga que são dados de exemplo e que o painel dele vai mostrar o segundo cérebro dele.
Se a prévia não subir, ela mostra o erro e o conserto: corrija e rode de novo; não pule para o
diagnóstico com o painel quebrado sem dizer ao cliente.

No fim, desligue a prévia (encerre o processo; ela apaga a cópia sozinha).

## Fase 2: diagnóstico

Siga `os-builder/references/02-diagnostico.md` e acrescente ao blueprint, numa seção própria:
- **Painel:** onde vai ficar instalado, o nome e o logo, os departamentos (as áreas do OS) e as
  ferramentas que entram, cada uma com o status (`live`, `sugerido`, `a-definir`).
- **Ferramentas:** o que será ligado hoje, o que fica como sugestão e o que fica fora, com o
  motivo.
- **Rotina Morning Brief:** se entra, em que dias e horário, e de quais fontes ela lê.

Espere a aprovação explícita. Correção do cliente volta para o diagnóstico, não para a construção.

## Fase 3: construção do segundo cérebro

Siga `os-builder/references/04-arquitetura.md` à risca: espinha, áreas com os nomes do cliente,
roteadores, índices, `memory/`, rituais em `.claude/commands/`, `bin/brain.py` e o hook.

Acrescente, se o cliente aprovou:
- O comando `/reuniao` a partir de [comandos/reuniao.md.tmpl](comandos/reuniao.md.tmpl).
- O script `bin/whatsapp.py` a partir de [scripts/whatsapp.py](scripts/whatsapp.py), se o WhatsApp pelo
  Uazapi entrou.
- O script `bin/instagram.py` a partir de [scripts/instagram.py](scripts/instagram.py), se a
  publicação no Instagram entrou (pergunta 13c), pelo guia em [02-ferramentas.md](02-ferramentas.md).
- O padrão visual das peças (pergunta 13d): o card de mapa a partir de
  [templates/card-mapa.html](templates/card-mapa.html), com as cores e a fonte tiradas do exemplo
  que o cliente mandou, pelo guia [templates/card-mapa-no-os.md.tmpl](templates/card-mapa-no-os.md.tmpl).
  Um card de teste com tema real, aprovado por ele, vira o modelo.
- O carrossel de Instagram (pergunta 13e), no mesmo visual: o modelo de 5 slides a partir de
  [templates/carrossel/](templates/carrossel/) e o gerador de JPEG
  [scripts/carrossel_jpeg.py](scripts/carrossel_jpeg.py), pelo guia
  [templates/carrossel-no-os.md.tmpl](templates/carrossel-no-os.md.tmpl). Um carrossel de teste
  com tema real, aprovado por ele, vira o modelo; o slide de CTA, com a oferta dele, fica fixo.
- O carrossel vivo (pergunta 13f), só depois do carrossel de teste aprovado: o instalador
  [carrossel-vivo/instalar.sh](carrossel-vivo/instalar.sh) e o script
  [scripts/carrossel_vivo.py](scripts/carrossel_vivo.py), pelo guia em
  [02-ferramentas.md](02-ferramentas.md). Os 5 MP4 do carrossel de teste, aprovados por ele, fecham o item.
- O criador de carrosséis e o Estúdio Social (pergunta 13g): a skill
  `criador-de-carrosseis-simples` pelo instalador
  [carrossel-vivo/instalar.sh](carrossel-vivo/instalar.sh) (o mesmo do carrossel vivo), a pasta
  `{{AREA_SOCIAL}}/carrosseis/` no OS, onde cada peça vira uma subpasta, e a regra do `status.txt`
  na nota do carrossel, pelo guia "Criador de carrosséis e Estúdio Social" em
  [02-ferramentas.md](02-ferramentas.md). É o que alimenta a tela Estúdio do painel.
- Se ele publica em redes: o calendário editorial a partir de
  [templates/calendario-social.md.tmpl](templates/calendario-social.md.tmpl), que alimenta o card
  Social da tela Gestão.
- A voz (pergunta 17), o livro-caixa (18) e o agente remoto com backup (19), cada um pelo guia
  dele em [02-ferramentas.md](02-ferramentas.md).
- No ritual de abrir o dia, a seção de cobranças do Asaas (modelo no guia do Asaas em
  [02-ferramentas.md](02-ferramentas.md)), só se o Asaas estiver ligado.
- No roteador raiz (`CLAUDE.md` do OS), a linha de cada ferramenta ligada na regra de fonte da
  verdade, e a pasta do painel na seção "fora do OS".

Termine com `python3 bin/brain.py indexar` e `python3 bin/brain.py doctor` limpos.

**Carimbo da versão:** copie o conteúdo de `VERSAO.txt` do kit para `.kit-versao` na raiz do segundo
cérebro (uma linha). É por ele que um pacote de atualização sabe de que versão o cliente parte.

## Fase 4: decisões registradas

Crie, com `python3 bin/brain.py nota`, uma decisão em `memory/decisoes/` para cada escolha que
muda o rumo e que o cliente tomou na entrevista. No mínimo:
- O nível de autonomia (Advisor no dia 1).
- Cada ferramenta adotada e o que ela é dona (ex.: "o Asaas é a fonte da verdade das cobranças").
- O que ficou de fora, com o motivo (ex.: "WhatsApp ainda não ligado").

## Fase 5: painel

Siga [03-painel.md](03-painel.md): copiar `painel/` para fora do segundo cérebro, gerar as configs
a partir das respostas, aplicar a marca, **rodar `node bin/checar.js --testar` até sair 0 erro**,
subir o servidor e mostrar ao cliente, aberto no navegador, o grafo, o Mission Control, a Gestão e
o Estúdio Social funcionando. Não diga que o painel está pronto sem ter aberto a página e visto o
grafo desenhado.

## Fase 6: ferramentas

Para cada ferramenta que o cliente decidiu ligar hoje, siga o guia dela em
[02-ferramentas.md](02-ferramentas.md) até o teste passar. Ferramenta que não passou no teste
fica `sugerido` no painel, com o motivo na decisão.

## Fase 7: rotina Morning Brief

Se o cliente aprovou: crie a tarefa agendada a partir de
[templates/morning-brief.md.tmpl](templates/morning-brief.md.tmpl), trocando os caminhos e
horários. Rode o mesmo fluxo uma vez à mão nesta sessão e mostre o resultado no Mission Control.
Avise que a rotina só roda com o app do Claude aberto.

## Fase 8: primeiro voo e entrega

Siga a fase 4 de `os-builder/references/05-rituais.md` (popular uma entidade real, responder as
três perguntas de aceitação só com o OS, `doctor`, ritual de fechar o dia). Depois:
- Acrescente ao `COMO-USAR.md` do cliente a seção do painel, a partir de
  [templates/como-usar-painel.md.tmpl](templates/como-usar-painel.md.tmpl).
- **Termine no visual.** Suba o painel do cliente (se não estiver no ar), confira de novo com
  `node bin/checar.js`, abra no navegador e passe com ele pelo grafo (o OS dele, com as áreas dele),
  o Mission Control (tarefas e o Morning Brief), a Gestão e o Estúdio Social. Se ele fez o
  carrossel de teste, ele tem que aparecer no Estúdio, na coluna certa. A sessão acaba com o
  painel aberto e funcionando na tela dele.
- Diga em três linhas o que fazer amanhã.
- Liste o que ficou pendente (chave a gravar, ferramenta a decidir, produção do Asaas), cada item
  com quem faz.
