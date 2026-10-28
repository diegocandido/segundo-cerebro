# Kit OS do Cara da IA

Instala, num cliente que ainda não tem segundo cérebro, o mesmo sistema do OS do Cara da IA:
o segundo cérebro em markdown (construído pela skill os-builder, a partir de uma entrevista) e o
painel visual com grafo, Mission Control, a tela Gestão (os números da operação), cobranças do
Asaas e o painel de cada ferramenta. Opcionais: conversa por voz com o segundo cérebro, livro-caixa
e um agente remoto (Telegram) com backup no GitHub.

## Como usar com um cliente

1. No computador do cliente, descompacte o zip numa pasta (ex.: `~/Kit-OS-Cara-da-IA`).
2. Abra essa pasta no Claude Code (app desktop, aba Code, ou `claude` no terminal dentro dela).
3. Diga: **"instalar o OS"**.

O Claude lê o `CLAUDE.md` do kit e conduz tudo: entrevista, diagnóstico para o cliente aprovar,
construção do segundo cérebro, instalação do painel, ligação das ferramentas e o primeiro teste.
O segundo cérebro e o painel são criados **fora** da pasta do kit, no lugar que o cliente escolher.

## Pré-requisitos no computador do cliente

- Claude Code (app desktop ou terminal), com uma conta Claude.
- Node.js 18 ou mais e Python 3.
- Conectores do Claude para Google Calendar e Gmail, se o cliente usar (para a agenda e os
  e-mails no painel).

## Ferramentas que o kit sugere

| Ferramenta | Para quê | Como entra |
|---|---|---|
| tl;dv | Gravar e transcrever reuniões; o comando `/reuniao` guarda no OS o que foi combinado | Sugerida na entrevista; ligada se o cliente adotar |
| Asaas | Cobrar por Pix, boleto ou cartão; tecla C e botão Nova cobrança no painel | Sugerido; começa sempre no sandbox |
| WhatsApp (Uazapi) | Ler conversas e mandar mensagem com confirmação, pelo `bin/whatsapp.py` | Sugerido; só liga se o cliente aceitar o risco de bloqueio (API não oficial) |
| PandaDoc | Orçamentos e propostas automatizados a partir de modelo | Sugerido; o comando de orçamento ainda não vem pronto |
| Voz (Whisper local + ElevenLabs ou voz do macOS) | Perguntar ao OS falando, pelo botão 🎙 do painel ou mãos livres | Opcional; só Mac com chip Apple |
| Livro-caixa | Despesas e recebimentos do dia a dia, tecla L no painel | Opcional; CSV local, fora do segundo cérebro |
| Agente remoto + GitHub | Agenda do dia e anotações pelo Telegram, backup automático | Opcional; repositório privado |

## O que tem dentro

```
Kit-OS-Cara-da-IA/
├── LEIA-PRIMEIRO.md        este arquivo
├── CLAUDE.md               instruções para o Claude da sessão de instalação
├── instalacao/
│   ├── 00-roteiro.md       as 8 fases da instalação
│   ├── 01-perguntas-extras.md  bloco 5 da entrevista: painel e ferramentas
│   ├── 02-ferramentas.md   guia de cada ferramenta (ligar, testar, como fica no painel)
│   ├── 03-painel.md        como copiar, configurar e subir o painel
│   ├── scripts/            whatsapp.py (Uazapi), voz (conversar, falar, ouvir, falar_resposta,
│   │                       assistente.json.example), livro_caixa.py e sync-github.sh
│   ├── comandos/reuniao.md.tmpl
│   └── templates/          rotina Morning Brief, seção do painel no COMO-USAR, o WhatsApp no OS
│                           e as instruções do agente remoto
├── os-builder/             a skill que entrevista e constrói o segundo cérebro
└── painel/                 o painel (Node, sem dependências), sem dados de nenhum cliente
```
