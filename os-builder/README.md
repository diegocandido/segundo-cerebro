# os-builder

Uma skill do Claude que **projeta e constrói o segundo cérebro de uma pessoa** como um OS de
arquivos markdown: entrevista profunda primeiro, diagnóstico aprovado depois, e só então a
estrutura, os roteadores, os índices, os rituais e a camada determinística que mantém tudo
honesto.

Não é um template de pastas. É o método: cada OS sai particular, derivado da rotina real de quem
vai usar.

## Instalar

Descompacte a pasta em `~/.claude/skills/` e reinicie o Claude Code (ou rode `/reload-plugins`
para carregar na hora):

```bash
unzip os-builder.zip -d ~/.claude/skills/
```

Confira que carregou:

```bash
claude plugin list
```

Deve aparecer **`os-builder@skills-dir`** com status `loaded`. A pasta traz um manifesto
(`.claude-plugin/plugin.json`), então ela é reconhecida como plugin de verdade: tem versão,
descrição, e dá para ligar e desligar com `claude plugin disable os-builder@skills-dir`.

> **Onde NÃO instalar:** dentro da pasta de outro plugin (por exemplo dentro de
> `anthropic-skills/skills/`). Ali ela herda o nome do plugin hospedeiro e passa a se chamar
> `outro-plugin:os-builder`, o que quebra a chamada por `/os-builder`.

### Para ter `/os-builder` no menu de barra

A skill dispara sozinha pela descrição (basta pedir em linguagem natural) e você também pode
digitar `/os-builder`. Se quiser que ela **apareça na lista** que abre ao digitar `/`, copie o
comando que vem junto:

```bash
mkdir -p ~/.claude/commands && cp ~/.claude/skills/os-builder/extras/os-builder.md ~/.claude/commands/
```

Isso vale para o seu usuário inteiro. Para deixar disponível só num projeto, copie para
`.claude/commands/` dentro dele.
## O que acontece quando você usa

1. **Entrevista** de 5 a 8 rodadas: escopo (pessoal ou empresa), sua semana real, as decisões
   que passam por você, suas ferramentas, sua dor, e três perguntas que você gostaria de ver
   respondidas na hora. Nada é criado nesta fase.
2. **Diagnóstico:** o retrato do que foi entendido e o blueprint do OS proposto, em uma tela,
   para você aprovar ou corrigir. Inclui o que deliberadamente **não** vai ser criado.
3. **Construção:** pastas, roteadores, índices, contexto pessoal, rituais, e a camada
   determinística.
4. **Primeiro voo:** popula uma entidade real, responde as suas três perguntas usando só o OS, e
   te entrega o manual com uma seção honesta de "no que este OS ainda não ajuda".

## O que você recebe

- **Hierarquia de roteamento** que permite ao modelo achar a resposta sem varrer pasta, porque
  todo índice traz uma frase do que cada nota responde.
- **Estado compilado separado do histórico**, para responder "como está isso?" sem ler trinta
  atas.
- **Rituais** de abrir, fechar, revisar, capturar e decidir, nos seus horários.
- **`bin/brain.py`**: quatro comandos que diagnosticam links quebrados, índices defasados, notas
  que ninguém cita e estado velho, sem gastar um token de modelo.
- **Hook de início de sessão** que injeta prioridades e "onde eu parei" em toda sessão, e fica
  silencioso quando não há nada a reportar.

## O que tem dentro

```
os-builder/
├── .claude-plugin/plugin.json        manifesto: faz a pasta carregar como plugin
├── SKILL.md                          o fluxo em quatro fases e as regras que não se negociam
├── extras/os-builder.md              o comando de barra, para copiar em ~/.claude/commands/
├── references/
│   ├── 01-entrevista.md              o questionário, em blocos, ramificado por perfil
│   ├── 02-diagnostico.md             como derivar o blueprint e calibrar o tamanho
│   ├── 03-boas-praticas.md           26 princípios, cada um com o defeito que ele previne
│   ├── 04-arquitetura.md             a forma das pastas e a ordem de construção
│   ├── 05-rituais.md                 como escrever um ritual que funciona, e o primeiro voo
│   └── 06-camada-deterministica.md   o que o script checa e por quê
├── templates/                        roteadores, índices, hub, estado, memória, comandos
└── assets/
    ├── brain.py                      a camada determinística, dirigida por configuração
    ├── brain-config.json             a configuração de exemplo
    └── session-start.sh              o hook de início de sessão
```

## Companheira

A skill `manutencao-os` mantém um OS que já existe, tenha ele sido construído por esta ou não.
Ela reconhece a estrutura antes de julgar, então funciona em qualquer formato.

## Créditos

Os princípios de `03-boas-praticas.md` saíram de um OS em produção, e a maioria saiu de um
defeito que custou semanas antes de ser isolado. Por isso cada princípio vem com o caso concreto
que o gerou: regra sem motivo não sobrevive ao primeiro atrito.
