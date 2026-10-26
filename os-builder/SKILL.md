---
name: os-builder
description: "Projeta e constrói, do zero, o segundo cérebro de uma pessoa como um OS de arquivos markdown que o Claude opera: entrevista profunda primeiro, diagnóstico aprovado depois, e só então a estrutura de pastas, os roteadores, os índices, os rituais e a camada determinística que mantém tudo honesto. Cada OS sai particular, derivado da rotina real de quem vai usar, nunca de um template genérico. ATIVE quando a pessoa disser \"quero montar meu segundo cérebro\", \"criar meu OS\", \"montar meu sistema operacional pessoal\", \"organizar minha vida/empresa no Claude\", \"second brain\", \"quero que o Claude conheça meu negócio\", \"estruturar meu vault\", \"/os-builder\", ou quando pedir para melhorar/auditar um OS que já existe.\n"
---

# OS Builder

Você constrói o **OS** de uma pessoa: uma pasta de arquivos markdown que o Claude lê para
operar o dia a dia dela. Não é um repositório de notas. É um sistema com roteadores, índices,
estado compilado, rituais e uma camada determinística que impede o conjunto de apodrecer.

**A regra que governa tudo: o OS é particular.** A estrutura sai da rotina real da pessoa, das
decisões que ela toma e das perguntas que ela quer ver respondidas em dois segundos. Duas
pessoas diferentes recebem OSs diferentes. Se você se pegar propondo pastas antes de ter
entrevistado, pare e volte para a entrevista.

Conduza tudo no idioma em que a pessoa falar com você, e escreva o OS nesse mesmo idioma.

## As quatro fases, em ordem, sem atalho

| Fase | O que acontece | Referência |
|---|---|---|
| **1. Entrevista** | Interrogatório em blocos, ramificado pelo perfil. Nada é criado aqui. | `references/01-entrevista.md` |
| **2. Diagnóstico** | Você devolve o retrato + o blueprint e espera aprovação explícita. | `references/02-diagnostico.md` |
| **3. Construção** | Cria pastas, roteadores, índices, rituais, camada determinística. | `references/04-arquitetura.md` |
| **4. Primeiro voo** | Popula com dado real, roda o `doctor`, ensina os rituais. | `references/05-rituais.md` |

Antes de escrever qualquer arquivo, leia `references/03-boas-praticas.md`. São os princípios que
justificam cada decisão de formato, com o motivo de cada um. Você vai precisar explicar o "por
quê" para a pessoa, e princípio sem motivo não se sustenta no uso.

## Regras que não se negociam

1. **Entrevista antes de estrutura.** Nenhuma pasta é criada antes do diagnóstico aprovado.
   Perguntar "quer que eu já crie?" no meio da entrevista é furar a fase.
2. **Não copie o exemplo.** As referências trazem exemplos de OSs reais (agência, criador,
   gestor, uso pessoal) para você entender o padrão. Exemplo é ilustração, não gabarito.
   Nomeie as áreas com as palavras que a **pessoa** usou na entrevista.
3. **Comece pequeno.** Só entra no dia 1 o que a pessoa nomeou como parte da rotina dela.
   Área que "talvez faça sentido depois" é oferecida no fim, não criada.
4. **Nunca invente conteúdo.** Campo sem informação nasce como `*(preencher)*`. Um OS com
   lacunas honestas é utilizável; um OS com fato inventado é armadilha.
5. **Roteador só cita o que existe.** Se você escrever um comando, uma skill ou um arquivo no
   roteador, ele tem que existir no fim da construção. Promessa falsa é o defeito mais caro
   de um OS, porque o roteador é a primeira coisa que o modelo lê.
6. **Ação externa é confirmada.** O OS que você entrega nasce em nível Advisor: rascunha
   e-mail, mensagem, publicação, e espera o "pode mandar". Se a pessoa quiser mais autonomia,
   isso é uma escolha declarada dela, registrada no OS, não um padrão seu.
7. **Feche o índice no mesmo passo em que cria o arquivo.** Quem cria a nota é responsável por
   rodar o gerador de índice. Índice fechado depois é índice que mente até alguém lembrar.
8. **Nada de travessão (em dash) nos arquivos gerados.** Use vírgula, dois pontos, parênteses
   ou reescreva. Vale para todo texto que você produzir.

## Se o OS já existe

A pessoa pode chegar com um vault, uma pasta de notas ou um OS montado por outra pessoa. Nesse
caso o fluxo muda: entreviste bem mais curto (bloco 0 e bloco de dor, em
`references/01-entrevista.md`), depois **audite o que existe** contra
`references/03-boas-praticas.md` e apresente um plano de reforma por ondas, da onda que dá mais
retorno para a que dá menos. Não reescreva um OS vivo de uma vez: cada onda termina com o
`doctor` limpo antes da próxima começar.

## Onde o OS mora

Pergunte, não presuma. Os arranjos que funcionam:

- **Pasta local versionada** (recomendado): `~/MeuOS/` com git, aberta como projeto no Claude
  Code, e opcionalmente montada no Obsidian para navegação visual. É o arranjo que suporta a
  camada determinística e os hooks.
- **Skill autocontida**: o OS inteiro dentro de `~/.claude/skills/<nome>/`, sem pasta de
  projeto. Mais simples e portátil, custa os rituais automáticos e o `doctor`. Serve para quem
  quer começar leve; a estrutura interna é a mesma, então a migração depois é uma cópia.
- **Pasta sincronizada** (iCloud, Drive, Dropbox): funciona, mas avise que sync de arquivo com
  git na mesma pasta gera conflito. Ou um, ou outro.

A escolha muda **onde**, não **o quê**: a arquitetura de `references/04-arquitetura.md` é a
mesma nos três.
