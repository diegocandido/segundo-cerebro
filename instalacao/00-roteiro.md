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

## Fase 1: entrevista (os-builder + bloco do kit)

Siga `os-builder/SKILL.md` e `os-builder/references/01-entrevista.md` (blocos 0 a 4). Depois do
bloco 4, rode o **bloco 5 do kit**, em [01-perguntas-extras.md](01-perguntas-extras.md): marca do
painel, reuniões (tl;dv), cobrança (Asaas), WhatsApp, orçamentos (PandaDoc) e o horário do Morning
Brief.

Nada é criado nesta fase.

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
- No ritual de abrir o dia, a seção de cobranças do Asaas (modelo no guia do Asaas em
  [02-ferramentas.md](02-ferramentas.md)), só se o Asaas estiver ligado.
- No roteador raiz (`CLAUDE.md` do OS), a linha de cada ferramenta ligada na regra de fonte da
  verdade, e a pasta do painel na seção "fora do OS".

Termine com `python3 bin/brain.py indexar` e `python3 bin/brain.py doctor` limpos.

## Fase 4: decisões registradas

Crie, com `python3 bin/brain.py nota`, uma decisão em `memory/decisoes/` para cada escolha que
muda o rumo e que o cliente tomou na entrevista. No mínimo:
- O nível de autonomia (Advisor no dia 1).
- Cada ferramenta adotada e o que ela é dona (ex.: "o Asaas é a fonte da verdade das cobranças").
- O que ficou de fora, com o motivo (ex.: "WhatsApp ainda não ligado").

## Fase 5: painel

Siga [03-painel.md](03-painel.md): copiar `painel/` para fora do segundo cérebro, gerar as configs
a partir das respostas, aplicar a marca, subir o servidor e mostrar ao cliente o grafo e o Mission
Control funcionando.

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
- Diga em três linhas o que fazer amanhã.
- Liste o que ficou pendente (chave a gravar, ferramenta a decidir, produção do Asaas), cada item
  com quem faz.
