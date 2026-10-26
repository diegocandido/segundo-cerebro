# Os princípios

Cada princípio aqui saiu de um OS em produção, e a maioria saiu de um defeito que custou
semanas antes de ser isolado. O motivo importa tanto quanto a regra: princípio sem motivo a
pessoa abandona no primeiro atrito.

Leia antes de escrever qualquer arquivo. Use como régua também quando for auditar um OS
existente.

---

## Navegação e custo de contexto

### 1. Índice com uma frase por item é roteador, não lista

Um índice que mostra só o nome do arquivo obriga a abrir o arquivo para saber se ele serve. Com
uma frase do que a nota responde, dá para decidir onde a resposta mora **sem abrir nada**.

> Medido num OS real com 250 notas: carregar a camada de índice e abrir uma nota certa custou
> **8,7 vezes menos token** que abrir toda nota que mencionava os termos da pergunta. É o ganho
> que justifica a disciplina de escrever a frase.

Aplicação: todo índice e todo hub lista `- [nome](caminho): a frase`. A frase vem do campo
`resumo:` do frontmatter quando existe, e da primeira frase de prosa quando não existe. Em nota
que vale ser achada, escreva o `resumo:` à mão.

### 2. Hierarquia de três degraus, cada degrau roteando para o próximo

1. **Roteador raiz** (`CLAUDE.md`): mapa de áreas, regras de ouro, anti-padrões. Roteia para a
   área e para nada mais. Se ele estiver crescendo, o detalhe pertence a um degrau abaixo.
2. **Roteador de área** (`{area}/CLAUDE.md`): o que vive na pasta, as regras dela, o tom.
3. **Índice de área** (`{area}/{area}.md`): a lista do que existe, uma frase por item.

O modelo desce os degraus e para quando encontrou. Nunca varre a pasta.

### 3. Roteador só cita o que existe

Roteador que promete um comando, uma skill ou um arquivo inexistente custa **mais** que
roteador incompleto, porque é a primeira coisa que o modelo lê: ele gasta turno procurando e
cria a ilusão de uma capacidade que não está lá.

> Caso real: um roteador de área descrevia um pipeline de 7 etapas com 6 comandos. Nenhum dos
> seis existia. Mais quatro promessas do mesmo tipo em outros arquivos.

Aplicação: a checagem entra na camada determinística e roda toda semana. E quando você
descontinuar algo, varra quem o citava no mesmo passo.

---

## Estado, verdade e frescor

### 4. Estado compilado e timeline são coisas diferentes

Toda entidade viva (cliente, projeto, frente) tem dois tipos de informação que não podem morar
juntos:

- **O estado de hoje:** como está, o que está travado, qual o próximo marco. Muda toda semana.
  **Sempre reescrito.**
- **O histórico:** o que aconteceu e quando. **Append-only, nunca reescrito.**

Misturar os dois obriga quem pergunta "como está isso?" a ler trinta atas e sintetizar sozinho.

> Caso real: os arquivos de projeto de quatro clientes estavam 32, 35, 39 e 55 dias atrás da
> última reunião. O histórico crescia toda semana; a síntese nunca era reescrita, porque não
> havia um momento definido para reescrevê-la.

Aplicação: um arquivo, duas camadas separadas por `---`. Acima, `## Estado` (um parágrafo),
`## Threads abertas` (checklist com dono e data de abertura) e o campo `atualizado:` no
frontmatter. Abaixo, `## Timeline`, mais recente primeiro, uma linha por evento que **mudou o
estado**. Thread resolvida **desce** para o timeline com a resolução, não é apagada. Template
em `templates/entidade-estado.md.tmpl`.

**Quem reescreve o topo é o ritual que registra o evento**, no mesmo passo, porque é o único
momento em que a informação está fresca. Se ninguém tem essa obrigação, a camada de cima
apodrece e você volta a ler trinta atas.

### 5. Frescor é campo declarado, nunca metadado de arquivo

A data de modificação do arquivo parece uma medida de frescor de graça, e não é.

> Caso real: uma limpeza de formatação tocou 288 arquivos, e num segundo todo o OS passou a
> "ter sido modificado hoje". Todo check de defasagem baseado em data de modificação passou a
> dizer que estava tudo em dia. E um backup feito com `cp -R` (sem `-p`) apagou o dado original
> de vez.

Aplicação: `atualizado: AAAA-MM-DD` no frontmatter de tudo que tem estado. Backup de OS é
`cp -Rp` ou `rsync -a`.

### 6. Fonte da verdade declarada por domínio

Para cada domínio, um dono. O padrão que funciona: **sistema externo guarda o estado, o OS
guarda o contexto.** O CRM sabe em que fase o negócio está; o OS sabe por que esse cliente
compra, quem decide lá e o que ficou combinado na última call. Duplicar estado cria duas
verdades, e a mais velha sempre vence na hora errada.

Escreva a regra explicitamente no roteador da área, com o nome do sistema.

### 7. Precedência quando duas coisas se contradizem

Ordem: **fala da pessoa agora > estado compilado > timeline > fonte externa.** E se o estado
compilado está velho (o `atualizado:` é anterior ao último evento registrado), **diga isso na
resposta** em vez de responder por ele. Uma resposta que avisa "isso é de três semanas atrás"
vale mais que uma resposta confiante e errada.

---

## Geração e manutenção

### 8. O que não precisa de inteligência não gasta modelo

Link quebrado, índice defasado, nota órfã, tipo fora do enum, estado velho: tudo isso é
verificável por script. Um script roda em um segundo, custa zero token e dá a mesma resposta
toda vez. Delegar isso ao modelo é caro e inconsistente.

Aplicação: `references/06-camada-deterministica.md` e `assets/brain.py`. Quatro comandos:
`doctor` (diagnostica, não escreve), `indexar` (regenera índices), `nota` (cria com metadado
válido **e** fecha o índice num passo) e `bench` (mede o ganho, para a disciplina se justificar
com número em vez de fé).

### 9. Bloco gerado versus curadoria, com fronteira explícita

Índice e hub têm um bloco delimitado:

```markdown
<!-- AUTO:conteudo -->
(gerado a partir do filesystem, sobrescrito a cada geração)
<!-- /AUTO:conteudo -->
```

Dentro dos marcadores: gerado, editar à mão é perda garantida. Fora: curadoria humana, o
gerador nunca toca. Sem essa fronteira, ou você perde a curadoria na próxima geração, ou desiste
de gerar.

### 10. Quem cria o arquivo fecha o índice

O gerador de índice existir não basta: ele tem que ser chamado **no mesmo passo** em que a nota
nasce. Índice fechado "depois" é índice que mente até alguém lembrar.

> Caso real: 26 reuniões nunca entraram no hub dos clientes porque o gerador era um comando
> separado que ninguém rodava.

Aplicação: todo ritual e todo comando que cria arquivo termina chamando o gerador. O comando
`nota` do script faz as duas coisas de uma vez, justamente para remover a chance de esquecer.

### 11. Aresta de saída não é aresta de entrada

Escrever `relacionados: [[Cliente]]` na nota liga a nota ao cliente na direção **saída**: aparece
no backlink e no grafo. Não coloca a linha na lista do hub, que é a aresta de **entrada**, a que
se lê ao abrir o cliente.

> Caso real: essa confusão apodreceu um índice por quatro semanas. Três relatórios seguidos
> acusaram o mesmo defeito sem isolar a causa, porque o diagnóstico verificava se a nota **tinha**
> link, e não quantos links **apontavam para** ela.

Aplicação: o diagnóstico conta **links de entrada por nota**. Nota com zero entrada é órfã, por
mais links que ela tenha.

### 12. Corrija a fábrica, não só o acervo

Inconsistência retroativa quase sempre nasce no template ou no ritual que gera o arquivo, não
nas notas. Conserte o gerador primeiro, depois faça o retrofit. Ao contrário, o problema volta a
acumular no dia seguinte.

Corolário: **nota gerada por rotina automática é a maior fábrica do OS e a mais fácil de
esquecer.** Convenção nova só vale quando desce até as rotinas agendadas, não só até o arquivo
de convenções.

### 13. Manutenção em duas camadas

- **Passe automático frequente** (semanal): olha só o delta, corrige o mecânico, reporta o resto.
- **Varredura profunda sob demanda** (mensal ou após mudança estrutural): pasta fora do mapa,
  duplicata, arquivo morto, contradição entre notas, deriva de fábrica.

As duas compartilham a mesma régua. Mudou a regra numa, atualize a outra.

**Falso positivo julgado vira código.** Se você concluiu que um achado não é defeito, registre
isso na configuração do script. Achado que volta toda semana ensina a pessoa a ignorar o
diagnóstico, e aí o diagnóstico inteiro morre.

---

## Nomes, metadados e links

### 14. Metadado só onde ele serve para recuperar

Frontmatter em nota que se beneficia de filtro e busca. Opcional em nota trivial, de propósito.
Melhor uma nota simples e verdadeira que metadado decorativo que ninguém mantém.

O campo de tipo tem **enum fechado e validado**. Tipo descritivo livre ("PRD (Product
Requirements Document)") quebra a busca que a convenção promete. O que é descrição vai em tags.

### 15. Link tem duas naturezas, e confundi-las quebra em silêncio

- **Wikilink `[[nome]]` resolve por nome de arquivo, não por caminho.** Use só quando o nome é
  **único** no OS: hub de entidade, oferta, nota datada. Nome genérico repetido (`perfil.md`,
  `time.md`, `estado.md`) linkaria para todos ao mesmo tempo.
- **Link relativo `[texto](caminho/arquivo.md)`** para tudo que tem nome genérico. Resolve por
  caminho, e não é ambíguo.
- Link relativo quebrado **não aparece** no grafo do Obsidian: só falha no clique. Por isso a
  checagem é do script, não do olho.
- Nunca linke, por wikilink ou caminho relativo, para algo que vive **fora** do OS. Cite como
  texto puro.

### 16. Nome de arquivo datado precisa de assunto

`AAAA-MM-DD-{entidade}-{assunto}.md`. Dois eventos da mesma entidade no mesmo dia são rotina, e
um sufixo `-2` esconde qual é qual e não resolve a colisão entre entidades diferentes. Nome
colidido é nome que não pode ser wikilinkado.

### 17. Toda renomeação em lote termina com uma varredura

Renomear quebra quem apontava para o nome antigo, e ninguém percebe na hora.

> Caso real: uma correção de nomenclatura renomeou dezenas de notas e deixou 47 links relativos
> mortos em 4 hubs, sem nenhum sintoma visível.

---

## Comportamento e uso

### 18. Nível de autonomia declarado e respeitado

Escreva no roteador, em uma linha, o que o OS pode fazer sozinho. O padrão do dia 1 é
**Advisor**: rascunha e-mail, mensagem, publicação, alteração em sistema externo, e espera o
"pode mandar". Autonomia se ganha vendo o que o sistema faria, não se presume.

### 19. Rituais são convite, não obrigação

Um OS que só funciona se a pessoa alimentar todo dia é um OS que morre na primeira semana
corrida. Dias sem entrada são normais e o sistema não pode quebrar por isso.

Para quem admitiu não ser disciplinado em captura, o desenho é **pull-based**: o valor aparece
quando a pessoa chega para trabalhar, com o OS puxando contexto de fontes que já existem
(agenda, e-mail, CRM, transcrição de reunião), não de alimentação manual.

### 20. Captura crua sem triagem

A captura tem um destino só, e zero decisão no momento de capturar: `inbox/`. Decidir para onde
vai é trabalho do ritual semanal. Fricção na captura é a razão número um pela qual a ideia não
entra.

### 21. Decisão vira registro consultável

Um arquivo por decisão que **muda o rumo** de algo, com contexto, alternativas consideradas, a
decisão em uma frase, e o **por quê incluindo o que faria mudar de ideia**. Tarefa do dia a dia
não é decisão.

O que isso compra: responder "por que decidimos X naquele mês?" seis meses depois, sem
reconstruir de memória, e reconhecer quando a premissa que sustentava a decisão caiu.

### 22. Aprendizados são densos e têm regra

Um bullet por aprendizado, adicionado quando algo se repete ou quando um erro ensina algo. Mais
denso que o diário, mais leve que uma decisão formal. Cada um carrega **o caso concreto e a
regra que ele gerou**, porque aprendizado sem regra não muda comportamento.

### 23. Consulta simples fica no chat

Só vira arquivo o que tem valor de reuso. Um OS que registra toda pergunta se enche de ruído e
o índice perde poder de roteamento.

### 24. Entregável final vai para fora, contexto fica dentro

O OS guarda contexto. O entregável final vai para onde ele é consumido (o documento
compartilhado, o CRM, o gestor de tarefas). Arquivo temporário vai para uma pasta ignorada pelo
versionamento. Entidade encerrada é **movida inteira** para uma pasta de arquivo, sem alterar
nada por dentro: preserva histórico e sai do contexto ativo.

### 25. Uma mudança só está feita quando desce por todas as camadas

Preço, prazo, nome e escopo de uma oferta vivem em várias camadas ao mesmo tempo: proposta, doc
interno, decisão registrada, contrato modelo. A negociação muda a primeira e esquece as outras.

> Caso real: uma oferta ficou um dia inteiro com preço e prazo antigos em três dos quatro
> lugares, depois de já ter sido vendida na condição nova.

Aplicação: mudou uma condição, varra as camadas no mesmo dia. E confira que o que já foi
assinado ficou intacto: condição antiga não muda retroativamente.

### 26. Lista fechada dentro de automação ganha aviso de validade

Toda tabela de referência escrita dentro de um ritual (a lista de clientes, de canais, de
membros do time) envelhece em silêncio.

> Caso real: um cliente novo não estava na tabela de uma rotina agendada, então as calls dele
> não eram registradas. Ninguém percebeu por semanas, porque a ausência não gera erro.

Aplicação: ou a lista se deriva do estado real (listar a pasta), ou ela carrega em texto o aviso
de que envelhece e a instrução de conferir a fonte antes de usar.
