# Fase 2: o diagnóstico

Antes de criar um único arquivo, você devolve o que entendeu e o que pretende construir, e
espera aprovação explícita. Duas razões: a pessoa corrige o que você entendeu errado enquanto
corrigir ainda é grátis, e ela chega na fase 3 sabendo o que cada pasta faz. OS que a pessoa não
entende ela não usa.

Entregue no chat, escaneável. Não é um documento longo: uma tela, no máximo duas.

## O formato

```
## O que eu entendi

Você é {papel em uma linha}. Sua semana gira em {frentes reais, nas palavras dela}.
As decisões que passam por você são {tipo de decisão}. O que mais te trava hoje é
{dor principal}, e você {é / não é} disciplinado em anotar, então o OS vai ser
{pull-based / alimentado por captura}.

Fonte da verdade fora do OS: {sistema} manda em {domínio}. O OS guarda o contexto,
não o estado.

## O OS que eu proponho

**Áreas** (uma pasta cada, com roteador e índice próprios)
| Pasta | O que vive lá | Por que ela existe |
|---|---|---|
| {nome que a pessoa usa} | {conteúdo} | {a dor ou a rotina que justifica} |

**Entidades que se repetem:** {cliente / projeto / canal / área da vida}. Cada uma ganha
pasta própria com um hub, um contexto e um estado compilado.

**Rituais**
| Comando | Quando | O que faz |
|---|---|---|
| /{nome} | {horário que ela disse ser sagrado} | {o que entrega} |

**Camada determinística:** {sim/não} + o que ela vai checar.

**Nível de autonomia:** {Advisor / parcial / alta}.

## Teste de aceitação

No fim, eu vou responder estas três usando só o OS:
1. {pergunta dela}
2. {pergunta dela}
3. {pergunta dela}

## O que eu deliberadamente NÃO vou criar agora
- {área especulativa}: {por que fica de fora}. Fica fácil de adicionar depois.

Pode construir assim, ou quer mexer em algo?
```

## Como derivar o blueprint das respostas

**Área** nasce de uma frente de trabalho que a pessoa **nomeou** no bloco 1 e que tem material
recorrente. Frente sem material recorrente não é pasta, é assunto de chat. Sinal de que é área:
ela produz arquivo mais de uma vez por mês.

**Entidade** é o substantivo que se repete no plural na fala dela: clientes, projetos, canais,
imóveis, alunos, turmas, times, áreas da vida. Toda entidade recebe a mesma tríade: hub (índice
de correlação), contexto (o que é, estável) e estado compilado (como está hoje, volátil). Ver
`04-arquitetura.md`.

**Ritual** nasce de dois lugares: um horário que ela disse ser sagrado, ou uma etapa de processo
que ela repete e sempre faz de cabeça. Cliente novo entrando, call terminando, semana fechando.

**Camada determinística** entra sempre que o OS tiver mais de umas 20 notas ou mais de uma
entidade. Abaixo disso, o custo de manter o script é maior que o ganho, e um checklist manual
resolve. Diga isso com honestidade em vez de instalar por padrão.

## Calibragem do tamanho

O erro mais comum é entregar demais. Um OS com 6 áreas e 40 arquivos vazios é pior que um com 3
áreas e 12 arquivos verdadeiros: o vazio ensina a pessoa a não confiar no que está escrito.

Régua prática para o dia 1:
- **3 a 5 áreas.** Mais que isso, alguma é subpasta de outra.
- **A espinha obrigatória, sempre:** roteador raiz, convenções, identidade, prioridades,
  captura crua, e um par de rituais de abrir e fechar.
- **As entidades que existem hoje**, populadas com dado real. Zero entidade de exemplo.
- **Nada de "por enquanto vazio, depois preenchemos".** Se não tem conteúdo hoje, não tem pasta
  hoje. Ofereça no fim, na lista do que ficou de fora.

## Se ela pedir muito mais do que precisa

Acontece: a pessoa vê a estrutura e quer 12 pastas. Não recuse, e não obedeça calado. Diga em
duas frases o que acontece com pasta vazia (o índice mente, o modelo gasta turno abrindo o que
não tem nada, e a pessoa para de confiar no OS), proponha começar pelas que têm conteúdo hoje, e
registre as outras numa seção "próximas áreas" do roteador. Se ela reafirmar, construa como ela
pediu: a decisão é dela, e você já disse o que precisava.
