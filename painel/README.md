# Painel do OS do Cara da IA

Servidor local, sem dependências, que lê a pasta de um segundo cérebro em markdown e mostra:

- **O grafo:** o roteador do OS no centro e, em órbita, as áreas (Memória), os comandos (Skills),
  as tarefas agendadas (Rotinas) e as ferramentas conectadas (Aplicações). Clicar numa
  ferramenta abre o painel dela: o que faz no OS, quem usa, regras, chave e links.
- **O Mission Control (tecla M):** tarefas (manuais e puxadas das pendências do diário) e o
  Morning Brief (agenda, e-mails, follow-ups, onde parei), escrito por uma rotina em
  `state/mission.json`.
- **Cobranças do Asaas (tecla C):** vencidas, a vencer e recebidas, só leitura; e o botão Nova
  cobrança, com prévia e confirmação.
- **Gestão (tecla G):** os números da operação em cards (cobranças, propostas, WhatsApp, clientes,
  agenda, tarefas), com o detalhe aberto dentro do painel. Só leitura.
- **Estúdio Social (tecla E):** as peças de rede social (carrosséis e cards) num quadro por etapa,
  Em criação, Para aprovar, Aprovado e Publicado, com a capa, os slides, os vídeos e a legenda.
  Relê as pastas a cada 8 segundos; também aparece como faixa no Mission Control. Só leitura.

## Rodar

```bash
node server.js
```

Abra http://127.0.0.1:5210. Porta ocupada: `PORT=5211 node server.js`.

Antes, crie os `config/*.json` a partir dos `config/*.example` (o roteiro de instalação do kit,
`instalacao/03-painel.md`, diz o que vai em cada um) e confira com:

```bash
node bin/checar.js --testar
```

Ele aponta config faltando, JSON quebrado, caminho errado do segundo cérebro e porta ocupada, e
testa o servidor de verdade. Painel em branco quase sempre é algo que ele mostra.

## Arquivos

| Arquivo | Papel |
|---|---|
| `server.js` | Servidor HTTP e API (só `127.0.0.1`, recusa pedidos de outros sites) |
| `scan.js` | Lê o segundo cérebro e monta o grafo |
| `mission.js`, `ingest.js` | Tarefas e pendências do diário do Mission Control |
| `asaas.js` | Leitura das cobranças e criação de cobrança em duas etapas |
| `gestao.js` | Os números da tela Gestão (só leitura; cada fonte falha sozinha) |
| `estudio.js` | O Estúdio Social: lê as pastas das peças (`missionControl.carrosseisDirs`) e serve só as imagens e vídeos delas |
| `bin/checar.js` | Confere a instalação (configs, segundo cérebro, porta) e, com `--testar`, sobe um servidor de teste e chama as rotas |
| `bin/previa.js` | Prévia do painel com o nome do cliente, sobre o OS de demonstração do kit, para mostrar no fim da entrevista |
| `bin/testar-asaas.js` | Confere se a chave do Asaas gravada funciona (só leitura) |
| `public/vendor/` | d3 e marked guardados no painel, para abrir sem internet (licenças em `vendor/LEIA.txt`) |
| `brain.js` | CLI de memória (`recall`, `store`) |
| `bin/write-mission.js` | Grava o Morning Brief (usado pela rotina agendada) |
| `bin/gravar-chave-asaas.sh` | Grava a chave do Asaas sem passar pelo chat |
| `bin/gravar-chave-uazapi.sh` | Grava a URL e o token da instância do Uazapi (WhatsApp) sem passar pelo chat |
| `config/` | Configuração por cliente (marca, pastas, departamentos, ferramentas, Asaas) |
| `public/` | A interface |

## Crédito

O motor do grafo é derivado do "Second Brain" de Jay E / RoboNuggets, sob CC BY 4.0. Ver
`LICENSE` e `NOTICE`; os dois arquivos acompanham qualquer cópia.
