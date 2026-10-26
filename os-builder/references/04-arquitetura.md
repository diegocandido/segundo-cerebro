# Fase 3: a arquitetura e a construção

A forma é sempre a mesma; o conteúdo é sempre da pessoa. O que segue é o esqueleto, não o
gabarito: os nomes entre chaves saem da entrevista.

## A espinha, igual em todo OS

```
{raiz-do-os}/
├── CLAUDE.md              roteador raiz: mapa de áreas, regras de ouro, anti-padrões
├── CONVENCOES.md           nomes, frontmatter, links, camada gerada
├── COMO-USAR.md            manual da pessoa: o que existe, como operar, o que ainda não faz
├── memory/                 a camada de contexto pessoal que os rituais leem
│   ├── CLAUDE.md
│   ├── memory.md               índice da área
│   ├── SOBRE-MIM.md            identidade, tom, como quer ser ajudado, disciplina de captura
│   ├── PRIORIDADES.md          documento vivo, revisado no ritual semanal
│   ├── aprendizados.md         um bullet por aprendizado, com a regra que ele gerou
│   ├── decisoes/               um arquivo por decisão que muda o rumo
│   └── diario/                 log leve por dia, escrito pelo ritual de fechamento
├── inbox/                  captura crua, zero triagem, esvaziada no ritual semanal
├── bin/
│   └── brain.py            camada determinística: doctor, indexar, nota, bench
├── .claude/
│   ├── commands/           os rituais como comandos de barra
│   ├── hooks/
│   │   └── session-start.sh    injeta prioridades + onde parei + saúde do OS
│   └── settings.json
├── .gitignore
└── {areas derivadas da entrevista}/
```

Nada acima é opcional, com uma exceção: `bin/brain.py` e o hook só entram se o OS morar em
pasta local (ver `SKILL.md`). O resto é o que faz um conjunto de notas virar um OS.

## Anatomia de uma área

```
{area}/
├── CLAUDE.md          roteador: o que vive aqui, as regras, o tom, a fonte da verdade
├── {area}.md          índice (MOC): a lista do que existe, uma frase por item, com bloco AUTO
├── directives/        SOPs reutilizáveis desta área (opcional, quando houver processo repetido)
└── {conteúdo}
```

O par roteador + índice é o que sustenta o princípio 1. Área sem índice força varredura de pasta.

## Anatomia de uma entidade que se repete

Vale para cliente, projeto, canal, aluno, imóvel, área da vida: qualquer substantivo que
apareceu no plural na entrevista.

```
{entidades}/
├── CLAUDE.md              regras que valem para todas as entidades + a estrutura padrão
├── {entidades}.md         índice canônico: a lista de quem existe (curadoria, não gerado)
├── _templates/            a fábrica: um arquivo por peça da tríade
├── _arquivados/           entidade encerrada, movida inteira, sem alteração interna
└── {Nome}/
    ├── CLAUDE.md          entrada rápida: uma linha, pessoas-chave, tom, regras específicas
    ├── {Nome}.md          HUB: alvo canônico de [[Nome]] + índice de tudo dela (bloco AUTO)
    ├── contexto/          o que é: o estável. Um arquivo por dimensão que a entrevista pediu
    ├── estado.md          o estado compilado + o timeline (as duas camadas do princípio 4)
    ├── eventos/           reuniões, sessões, marcos: AAAA-MM-DD-{nome}-{assunto}.md
    └── outputs/           entregas que valem guardar
```

Três coisas aqui merecem atenção porque são as que mais se erram:

1. **`CLAUDE.md` e `{Nome}.md` são arquivos diferentes com papéis diferentes.** O primeiro é
   instrução operacional (como falar com essa pessoa, o que não fazer), lido pelo modelo. O
   segundo é o hub de correlação, alvo de todo `[[Nome]]` que vier de outra área, e o índice do
   que existe dentro. Juntar os dois faz o roteador crescer e o wikilink perder alvo.
2. **`contexto/` é estável, `estado.md` é volátil.** Se você se pegar atualizando um arquivo de
   `contexto/` toda semana, aquilo era estado.
3. **`_templates/` é a fábrica.** Semeie nele o padrão certo (frontmatter, marcadores AUTO,
   as duas camadas do estado). Template errado produz acervo desalinhado (princípio 12).

## Frontmatter

O enum de `tipo:` é fechado e validado. Derive-o das entidades e áreas reais da pessoa, escreva
a lista no `CONVENCOES.md` **e** na configuração do script, e não aceite valor fora dela.

```yaml
---
tipo: {enum fechado, derivado do OS dela}
{entidade}: {Nome}          # quando a nota pertence a uma entidade
area: {area}                # quando ajuda a filtrar
status: ativo | pausado | entregue | arquivado
atualizado: AAAA-MM-DD      # obrigatório onde há estado (principio 5)
resumo: uma frase do que esta nota responde   # é o que aparece nos índices (princípio 1)
tags: []
relacionados: [[nome-unico]]
---
```

`resumo:` é o campo de maior retorno por caractere digitado em todo o OS. Insista nele.

## Ordem de construção

Construa nesta ordem, porque cada passo depende do anterior:

1. **Pastas e `.gitignore`.** Segredos, temporários, lixo de sistema operacional, arquivos
   grandes de mídia. Se for usar git, inicialize agora.
2. **`CONVENCOES.md`** a partir de `templates/CONVENCOES.md.tmpl`, com o enum de tipos real.
   Primeiro, porque tudo depois obedece a ele.
3. **`memory/SOBRE-MIM.md`** com o que a entrevista deu. Este arquivo é a diferença entre um OS
   e uma pasta de notas: é onde mora quem a pessoa é, como ela escreve, como quer ser ajudada e
   o quanto ela captura de fato.
4. **`memory/PRIORIDADES.md`** com o foco do trimestre e as metas que ela nomeou. Se ela não
   tiver metas formuladas, escreva o que ela disse que importa agora e marque a data.
5. **As áreas**, cada uma com roteador e índice.
6. **As entidades**, com `_templates/` primeiro (a fábrica antes do acervo) e depois as que
   existem hoje, populadas com dado real.
7. **`bin/brain.py` + configuração**, se aplicável. Copie de `assets/`, ajuste a configuração
   para as áreas e tipos reais, rode `doctor`.
8. **Os rituais** em `.claude/commands/`, e o hook de início de sessão. Ver `05-rituais.md`.
9. **`CLAUDE.md` da raiz, por último.** É o único arquivo que precisa saber o que realmente
   existe. Escrever antes garante promessa falsa (princípio 3).
10. **`COMO-USAR.md`**, o manual dela: o que existe, os comandos, as boas práticas do dia a dia
    e uma seção honesta de **no que este OS ainda não ajuda**. Essa seção evita frustração e
    vira a lista de próximas ondas.

## O roteador raiz

É o arquivo mais lido do OS, então ele é curto e é mapa. Ver
`templates/raiz-CLAUDE.md.tmpl`. Ele carrega, na ordem:

1. Quem é a pessoa em duas linhas e para que serve este OS.
2. **Como navegar:** a hierarquia de índice primeiro, arquivo depois.
3. **Mapa de áreas:** tabela com pasta, o que vive lá, entrada rápida.
4. Os rituais que existem.
5. A camada determinística e como chamá-la.
6. **Regras de ouro:** de 4 a 6 linhas, incluindo o nível de autonomia e a fonte da verdade.
7. **Anti-padrões:** pares `❌ isso → ✅ aquilo`. Formato de altíssimo retorno: ensina o certo
   mostrando o errado, e o errado é o que o modelo faria por default.

Ele **não** carrega: detalhe de área (desce para o roteador da área), conteúdo (mora nas notas),
histórico (mora no timeline).

## Encerramento da fase

Antes de declarar pronto:

- [ ] `doctor` roda limpo, ou o que sobrou está justificado em texto para a pessoa
- [ ] Nenhum arquivo tem placeholder onde a entrevista deu resposta
- [ ] Nenhum roteador cita algo que não existe
- [ ] As três perguntas do teste de aceitação foram respondidas usando só o OS
- [ ] A pessoa sabe rodar os rituais e sabe o que o OS ainda não faz
