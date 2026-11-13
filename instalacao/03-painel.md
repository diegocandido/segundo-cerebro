# Instalar o painel

O painel é um servidor Node sem dependências que lê a pasta do segundo cérebro e mostra o grafo
(Aplicações, Rotinas, Memória e Skills), o Mission Control (tarefas, Morning Brief, cobranças e,
se o cliente quis, livro-caixa e o botão de voz), a Gestão e o Estúdio Social (as peças de rede
social por etapa).
Ele só aceita acesso da própria máquina.

## 1. Copiar para fora do segundo cérebro

O painel não mora dentro do OS (não é contexto, e o grafo leria o próprio código). Copie a pasta
`painel/` do kit para o lado do segundo cérebro, por exemplo:

```
~/MeuOS/            o segundo cérebro (os-builder)
~/MeuOS-painel/     cópia de painel/ deste kit
```

Registre no roteador do OS, na seção "fora do OS", onde o painel ficou.

## 2. Gerar as configs

Na pasta copiada, para cada `config/*.example`, crie o `.json` sem o `.example` e preencha com as
respostas da entrevista:

| Arquivo | O que vai |
|---|---|
| `workspace.json` | `root` com o caminho **absoluto** do segundo cérebro; `visibleRoots` com as áreas criadas; `missionControl` com a pasta do diário, a pasta de clientes, o espelho das tarefas (`inbox/todos.md` ou onde o OS guardar) e `propostasDir`, a pasta dos registros de proposta (modelo em `templates/registro-proposta.md.tmpl`). |
| `departments.json` | Um departamento por área do OS, com o nome que o cliente usa; `pathRules` ligando cada pasta. |
| `apps.json` | Só as ferramentas do diagnóstico, com o status certo e os `detalhes` sem `*(preencher)*` sobrando onde já há resposta. As `notas` precisam existir no OS. |
| `asaas.json` | Sandbox, limite e formas de pagamento (só se o Asaas entrou). |
| `routines.json` | Override de nome e horário da rotina Morning Brief; esconda em `hidden` pastas de tarefas agendadas que não são deste OS. |
| `brand.json` | Nome, subtítulo, título da aba e logo (copie o logo do cliente para `public/` e aponte aqui). |
| `agents.json`, `access-overrides.json`, `tweaks.json` | Cópia do exemplo, sem mudança, salvo se o cliente tiver agente remoto. |

No `workspace.json`, se o Estúdio Social entrou (pergunta 13g): `missionControl.carrosseisDirs`
com a pasta das peças (padrão `["Social/carrosseis"]`) e `carrosseis` em `excludeDirs`;
`missionControl.estudioConta` com o @ do Instagram do cliente, sem a arroba (aparece na prévia de
celular e no Feed), e `missionControl.estudioDiaPost` com o dia fixo de postar, se ele tiver um
(1 = segunda ... 6 = sábado; sem dia fixo, tire a linha) e `missionControl.estudioCor` com a cor
principal da marca dele em hexadecimal (ex.: `#2952E3`), que acende o Estúdio.

## 3. Conferir antes de subir (obrigatório)

```bash
cd ~/MeuOS-painel && node bin/checar.js --testar
```

Ele confere o Node, cada `config/*.json` (se existe e se o JSON está certo), o caminho do segundo
cérebro, as pastas que as configs citam, o logo, a chave do Asaas e a porta; depois sobe um
servidor de teste numa porta livre, chama o grafo, o Mission Control, a Gestão e o Estúdio e
desliga. **Só siga com `0 erro(s)`.** Cada ERRO vem com o conserto na linha de baixo; AVISO não
impede, mas resolva o que der antes de mostrar ao cliente.

| Sintoma | Causa comum | Conserto |
|---|---|---|
| Grafo em branco, só os botões | `root` errado (pasta vazia, relativa ou o exemplo) | `checar.js` aponta; use o caminho absoluto do OS |
| "Scan failed" na tela de abertura | `config/workspace.json` com erro de JSON | corrigir a vírgula que o `checar.js` mostra |
| Ferramenta que sumiu do anel | `apps.json` com erro de JSON (o painel ignora o arquivo inteiro) | idem |
| Página não abre | servidor desligado ou porta ocupada | `node server.js` na pasta do painel; `PORT=5211` se ocupada |
| `localhost` não conecta | algumas máquinas | use `http://127.0.0.1:5210` |

## 4. Subir e mostrar

```bash
node ~/MeuOS-painel/server.js
```

Deixe rodando numa aba de terminal (ou em segundo plano pela sessão) e abra
`http://127.0.0.1:5210` **no navegador** (use `127.0.0.1`: em algumas máquinas `localhost` não
conecta). Se a porta estiver ocupada: `PORT=5211 node server.js`. Olhe você mesmo antes de chamar o
cliente: o grafo precisa estar desenhado no centro da tela e o console do navegador sem erro.

Confira junto com o cliente:
- O topo mostra o nome e o logo dele.
- O grafo mostra as áreas do OS como departamentos e as ferramentas no anel de Aplicações.
- Clicar num ícone de ferramenta vai direto para a tela dela no painel (campo `tela` do
  `apps.json`: `tarefas`, `estudio`, `mission` ou uma seção da Gestão). Ferramenta sem tela abre a
  ficha dela. **Alt+clique** abre a ficha de qualquer uma; nela a chave aparece como "gravada" ou
  "não encontrada".
- Tecla **M** abre o Mission Control; tecla **C** abre as cobranças (se o Asaas estiver ligado).
- O **☰ MENU** do topo abre com a seção Funcionalidades: cada tela do painel com a tecla dela
  (Tarefas, Mission Control, Gestão, Estúdio, Cobranças, Livro-caixa, Kit, Falar). Não há botões
  no canto inferior direito; o de voz só aparece enquanto grava ou pensa. Item de tela que não foi
  instalada não aparece.
- Tecla **T** (ou o MENU) abre o quadro de tarefas: um projeto por cliente ou frente e
  três colunas (A fazer, Fazendo, Feito). Crie com ele um projeto e uma tarefa de teste, arraste
  para Fazendo e conclua. A mesma tarefa aparece no Mission Control. Pelo terminal, a partir do
  OS: `python3 bin/tarefas.py projetos` (copie [scripts/tarefas.py](scripts/tarefas.py) para o
  `bin/` do OS; ele acha o painel na pasta ao lado). O Claude lê à vontade e só cria ou move
  tarefa com `--confirmo`, depois do "pode" do cliente.
- Tecla **G** (ou o MENU) abre a tela Gestão: cards com cobranças, propostas, WhatsApp,
  clientes, social, agenda e tarefas; clicar num card abre o detalhe dentro do painel. No painel de cada
  ferramenta, o botão "Abrir no painel" leva para a seção dela (campo `painel` do `apps.json`).
  Card de ferramenta que não está ligada aparece com o aviso de indisponível, e os outros seguem.
- O card **Social** só aparece se existir o calendário editorial (`Social/calendario.md`, modelo em
  [templates/calendario-social.md.tmpl](templates/calendario-social.md.tmpl); outro caminho vai em
  `missionControl.socialCalendar` do `config/workspace.json`). Teste com um post na tabela Publicados:
  o card conta os dos últimos 30 dias e abre o link.

- Tecla **E** (ou o MENU) abre o Estúdio Social; o Mission Control mostra a faixa
  "Estúdio Social" no alto. Ele tem 4 abas: **Quadro** (as peças por etapa), **Semana** (o próximo
  post, os números e os 7 dias, com o dia de postar marcado), **Posts** (a prévia em tela de celular,
  com slides, carrossel vivo e legenda) e **Feed** (como o perfil fica com as próximas peças). A
  data de cada peça vem da linha `data:` do `status.txt` dela. Sem nenhuma peça, ele explica onde procura. Se o carrossel de teste já
  existe, ele aparece na coluna da etapa dele (guia em 02-ferramentas.md, "Criador de carrosséis e
  Estúdio Social").

- **Estúdio de Conteúdo (se entrou a 13h):** tecla **E** abre o estúdio dentro do painel, no visual
  dele, com **Peças** (o Estúdio Social acima) e **◂ OS** no canto; Esc volta. Sem o pacote
  instalado, a tecla E continua abrindo o Estúdio Social. Guia em
  [estudio-de-conteudo/LEIA.md](estudio-de-conteudo/LEIA.md).

Se entraram os opcionais:
- **Voz:** "Falar com o OS" no MENU (tecla V); o botão de enviar aparece enquanto grava; ele só responde se o segundo cérebro tiver
  `bin/conversar.py` e `bin/assistente.json` (guia da voz em 02-ferramentas.md). Teste digitando
  uma pergunta no quadro; o navegador pede o microfone na primeira gravação (no Chrome ou Safari;
  painéis embutidos costumam bloquear o microfone).
- **LinkedIn (se entrou com o Estúdio, pergunta 13h):** copie [scripts/linkedin.py](scripts/linkedin.py)
  para o `bin/` do segundo cérebro. Tecla **I** (ou o MENU) abre a tela: seguidores, agendados,
  publicados e números. Sem o Estúdio ou sem o LinkedIn conectado no Zernio, a tela só explica o que
  falta. Teste com `python3 bin/linkedin.py status` e uma prévia (`postar --texto-arquivo` sem
  `--confirmo`, que não publica nada). Deixe a entrada `app:linkedin` no `apps.json` só se entrou.
- **Livro-caixa:** tecla **L** (ou botão Livro-caixa no Mission Control). Em `workspace.json`,
  `missionControl.livroCaixa` aponta para o CSV (relativo ao segundo cérebro) e
  `agenteFinanceiroDir` para os lançamentos do agente remoto. Sem livro-caixa, a tela só avisa
  que não encontrou o arquivo.

## 5. Deixar fácil de abrir

O servidor precisa estar rodando para o painel abrir. Ofereça ao cliente uma destas, e só faça
com o "pode":
- Um comando curto no terminal (alias) para subir o painel.
- **App do Chrome:** com o painel aberto no Chrome, o ícone de instalar no fim da barra de endereço
  (ou menu ⋮, Transmitir, salvar e compartilhar, Instalar página como app) cria um app com o nome e
  o logo da marca, janela própria e ícone no Dock ou na barra de tarefas. O botão direito no ícone
  traz os atalhos Tarefas, Mission Control e Gestão. O app é só a janela: o servidor precisa estar
  no ar. Com logo próprio, use um PNG quadrado de 512px para o ícone ficar nítido.
- **Ligar sozinho no macOS (opcional):** um item de login que sobe o servidor quando o cliente
  entra no computador e o religa se cair. Preencha
  [templates/painel-inicio-automatico.plist.tmpl](templates/painel-inicio-automatico.plist.tmpl)
  (caminho do `node`, de `which node`, e da pasta do painel), grave em
  `~/Library/LaunchAgents/com.os.painel.plist` e ligue com
  `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.os.painel.plist`. Antes, feche
  qualquer servidor do painel que esteja aberto, para a porta estar livre. Confira com
  `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5210/` (tem que dar 200). Reiniciar:
  `launchctl kickstart -k gui/$(id -u)/com.os.painel`. Desligar:
  `launchctl bootout gui/$(id -u)/com.os.painel`. Se o segundo cérebro mora em Mesa, Documentos
  ou Downloads, o macOS pode pedir permissão de acesso na primeira vez. Com isso ligado, troque
  no `.claude/launch.json` a entrada do painel por `{"name": "painel", "url": "http://localhost:5210", "port": 5210}`,
  para o app do Claude só abrir a aba no servidor que já está no ar. No Windows e no Linux, use o
  agendador do sistema para rodar `node server.js` no login.

## Notas de segurança (não remova)

- O servidor só escuta em `127.0.0.1` e recusa pedidos vindos de outros sites.
- `.env`, chaves e credenciais não abrem no leitor do painel.
- A única escrita externa do painel é criar cobrança no Asaas, em duas etapas, com confirmação.
