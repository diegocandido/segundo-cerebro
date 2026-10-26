# Instalar o painel

O painel é um servidor Node sem dependências que lê a pasta do segundo cérebro e mostra o grafo
(Aplicações, Rotinas, Memória e Skills) e o Mission Control (tarefas, Morning Brief e cobranças).
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

## 3. Subir e mostrar

```bash
node ~/MeuOS-painel/server.js
```

Abra `http://127.0.0.1:5210` (use `127.0.0.1`: em algumas máquinas `localhost` não conecta). Se a
porta estiver ocupada: `PORT=5211 node server.js`.

Confira junto com o cliente:
- O topo mostra o nome e o logo dele.
- O grafo mostra as áreas do OS como departamentos e as ferramentas no anel de Aplicações.
- Clicar num ícone de ferramenta abre o painel dela; a chave aparece como "gravada" ou "não
  encontrada".
- Tecla **M** abre o Mission Control; tecla **C** abre as cobranças (se o Asaas estiver ligado).
- Tecla **G** (ou o botão GESTÃO) abre a tela Gestão: cards com cobranças, propostas, WhatsApp,
  clientes, agenda e tarefas; clicar num card abre o detalhe dentro do painel. No painel de cada
  ferramenta, o botão "Abrir no painel" leva para a seção dela (campo `painel` do `apps.json`).
  Card de ferramenta que não está ligada aparece com o aviso de indisponível, e os outros seguem.

## 4. Deixar fácil de abrir

O servidor precisa estar rodando para o painel abrir. Ofereça ao cliente uma destas, e só faça
com o "pode":
- Um comando curto no terminal (alias) para subir o painel.
- No macOS, um app no Atalhos ou um item de login que rode `node .../server.js`.

## Notas de segurança (não remova)

- O servidor só escuta em `127.0.0.1` e recusa pedidos vindos de outros sites.
- `.env`, chaves e credenciais não abrem no leitor do painel.
- A única escrita externa do painel é criar cobrança no Asaas, em duas etapas, com confirmação.
