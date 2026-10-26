# Fase 1: a entrevista

O objetivo não é preencher um formulário. É sair com **o mapa da semana real da pessoa**, das
decisões que ela toma e das perguntas que ela quer ver respondidas sem procurar. A estrutura do
OS é uma consequência disso. Entrevista rasa produz OS genérico, e OS genérico é abandonado em
duas semanas.

## Como conduzir

- **Em rodadas, não em muro.** De 2 a 4 perguntas por rodada. Use a ferramenta de pergunta com
  alternativas (`AskUserQuestion`) sempre que a resposta cabe em opções, e pergunta aberta no
  chat quando você precisa da palavra dela. A palavra dela importa: o nome das áreas do OS vai
  sair do vocabulário que ela usar.
- **Espelhe antes de avançar.** No fim de cada bloco, uma ou duas linhas: "então hoje o teu
  tempo vai em X, Y e Z, e o que mais te trava é W. Certo?". Correção barata agora vale mais
  que reforma depois.
- **Puxe o fio.** Resposta vaga ("me organizo mal") não fecha o bloco. Pergunte o exemplo
  concreto da última vez que aconteceu.
- **Alvo:** de 5 a 8 rodadas, algo entre 25 e 40 perguntas respondidas. Se a pessoa começar a
  responder curto e seco, ela cansou: feche o bloco atual, avise que falta pouco e priorize as
  perguntas marcadas como **essencial** abaixo.
- **Nada é criado durante a entrevista.** Nem pasta, nem arquivo, nem rascunho.

---

## Bloco 0: terreno (essencial, sempre)

Definem o formato de tudo. Quatro perguntas, de preferência em uma rodada só.

1. **Este OS é para quê?** Vida pessoal · Um negócio/empresa · Os dois no mesmo lugar ·
   Um projeto ou frente específica.
   > Se for "os dois", pergunte se ela quer **uma pasta com duas áreas** ou **dois OSs
   > separados**. Recomende uma pasta só, com áreas separadas: contexto pessoal e profissional
   > se cruzam mais do que a pessoa espera (prioridade do trimestre, energia, agenda), e dois
   > OSs obrigam a manter duas identidades.
2. **Como você trabalha hoje com o Claude?** Chat solto no navegador · App/desktop · Claude
   Code no terminal · Mistura.
3. **Onde esse OS vai morar?** (ver a seção "Onde o OS mora" no `SKILL.md`.) Se ela não souber,
   recomende pasta local versionada e explique em uma linha o que ela ganha.
4. **Você quer que o Claude execute ou só prepare?** Advisor (rascunha tudo, você aprova cada
   envio) · Autonomia parcial (pode agir sozinho em coisas reversíveis, confirma o resto) ·
   Autonomia alta (age e reporta depois).
   > Recomende Advisor no dia 1 mesmo para quem pede autonomia alta. Confiança em sistema novo
   > se constrói vendo o que ele faria. Registre a preferência dela como decisão do OS.

---

## Bloco 1: identidade e rotina (essencial, sempre)

Alimenta o arquivo de identidade e mostra quais áreas existem de fato.

5. **Quem você é em duas linhas?** Papel, o que faz, para quem.
6. **Descreva uma semana normal sua.** Peça o relato, não a agenda ideal. Onde vai o tempo, em
   que dias, com quem. É a pergunta mais informativa da entrevista inteira: insista até ter
   nomes de frentes de trabalho, não categorias abstratas.
7. **Quais decisões passam por você toda semana?** Do tipo "vale contratar", "que preço",
   "faço ou terceirizo", "vale começar isso agora".
8. **Que ferramentas você usa todo dia?** CRM, gestor de tarefa, e-mail, agenda, financeiro,
   plataforma de conteúdo, plataforma de comunidade. Anote **qual sistema é dono de qual
   verdade**: isso vira a regra de fonte da verdade do OS (ver princípio 8 em
   `03-boas-praticas.md`).
9. **Como você escreve e fala?** Tom, o que você não suporta em texto, exemplo de algo que
   soa como você. Isso vira a seção de voz do arquivo de identidade e evita entregar texto que
   a pessoa vai reescrever inteiro.

> Fecho do bloco: liste em bullets as frentes de trabalho que apareceram e pergunte se falta
> alguma ou se alguma está inflada. **Essa lista é a candidata a virar as áreas do OS.**

---

## Bloco 2: ramificação por perfil

Escolha o ramo pela resposta do bloco 0 e pela semana descrita no bloco 1. Se a pessoa é dois
ramos ao mesmo tempo (comum: fundador que também cria conteúdo), rode os dois, encurtando.

### Ramo A: negócio com clientes (agência, consultoria, serviço, estúdio)

10. **Quantos clientes ativos, e o que você precisa saber de cada um em dois segundos?**
    A resposta define o que entra no contexto de cliente.
11. **Como um cliente entra e como sai?** Do primeiro contato ao encerramento. Cada etapa dessa
    é candidata a ritual.
12. **Que reuniões recorrentes você tem e o que sobra delas?** Ata, compromisso, decisão. E onde
    isso está hoje.
13. **Como é o comercial?** Etapas do funil, onde vive o estado (CRM?), o que você faz depois de
    cada call, o que costuma furar.
14. **Você tem time?** Quem, fazendo o quê, e o que você precisa acompanhar de cada um.
15. **Quais são suas ofertas e por quanto?** E onde essa informação vive hoje (proposta, site,
    contrato, sua cabeça).

### Ramo B: criador de conteúdo / audiência

10. **Em quais canais você publica, e qual é o principal?**
11. **Qual é o caminho de uma ideia até publicada?** Nomeie cada etapa com a palavra dela. Vira
    a estrutura de pastas de conteúdo.
12. **Onde a ideia costuma morrer?** Falta de ideia, roteiro, edição, publicação.
13. **Você tem números que persegue?** Seguidores, inscritos, lista, receita. E de onde eles vêm.
14. **Você monetiza como?** Produto, comunidade, patrocínio, serviço. Cada frente de receita é
    candidata a área.
15. **Tem biblioteca de referência?** Conteúdo que te inspira, formatos que funcionam, ganchos
    que você reusa.

### Ramo C: gestor ou profissional dentro de uma empresa

10. **Quais projetos você conduz hoje, e qual é o estado de cada um?**
11. **Para quem você reporta e o que essa pessoa quer ver?** Define o formato do resumo que o OS
    vai gerar.
12. **Quem são seus stakeholders e o que cada um precisa de você?**
13. **Que rituais a empresa te impõe?** 1:1, weekly, planejamento trimestral, review. O OS se
    encaixa nesses horários, não cria concorrentes deles.
14. **Que informação você reconstrói do zero toda vez?** Status, histórico de decisão, número.
    É o que o estado compilado resolve.
15. **O que é confidencial e não pode entrar em arquivo?**

### Ramo D: uso pessoal / vida

10. **Que frentes da sua vida você quer que o OS acompanhe?** Saúde, finanças, casa, estudo,
    família, projetos pessoais, carreira.
11. **O que você mais esquece?** Compromisso, remédio, aniversário, prazo, retomar projeto.
12. **Tem alguém junto nas decisões?** Cônjuge, sócio, família. Muda a linguagem do OS.
13. **Você estuda ou aprende algo com método?** Curso, leitura, prática. Como quer registrar.
14. **Que números da sua vida você quer ver juntos?** Dinheiro, treino, sono, tempo de tela.
    E de onde eles saem.
15. **O que você quer poder responder daqui a um ano olhando esse OS?**

---

## Bloco 3: dor e fricção (essencial, sempre)

É o que separa um OS que resolve de um OS bonito.

16. **O que você perde tempo refazendo?** Procurar informação, reescrever a mesma coisa,
    reconstruir contexto.
17. **Que pergunta você gostaria de fazer e receber a resposta na hora?** Peça três. Elas viram
    o **teste de aceitação** do OS: no fim da construção, você vai responder essas três
    perguntas usando só o OS. Se não conseguir, a estrutura está errada.
18. **O que já te escapou por falta de sistema?** Follow-up perdido, prazo, promessa a cliente.
19. **Você é disciplinado em anotar?** Seja franco com ela sobre a consequência:
    - **Sim, anoto tudo:** o OS pode depender de captura e ficar mais rico.
    - **Não, esqueço:** o OS tem que ser **pull-based**, útil quando ela chega para trabalhar,
      puxando contexto de fontes que já existem (agenda, e-mail, CRM, transcrição de reunião),
      sem depender de alimentação manual. Rituais viram convite, não obrigação.
    > Essa resposta muda o desenho mais do que qualquer outra. Registre no arquivo de identidade.
20. **Que horários seus são sagrados?** Início do dia, fim do dia, um dia da semana. Os rituais
    vão morar nesses horários ou não vão acontecer.

---

## Bloco 4: limites (essencial, sempre)

21. **O que NÃO deve entrar no OS?** Dado sensível, senha, assunto que ela não quer registrado.
    Respeite sem discutir e escreva isso no roteador.
22. **Que sistema externo é a fonte da verdade de quê?** Feche a lista do bloco 1. A regra que
    você vai escrever: o OS guarda o **contexto**, o sistema externo guarda o **estado**.
    Duplicar estado cria duas verdades e a mais velha sempre ganha na hora errada.
23. **Alguém mais vai ler ou escrever nesse OS?** Sócio, assistente, time. Se sim, a linguagem
    deixa de ser primeira pessoa e ganha uma seção de quem faz o quê.

---

## Antes de passar para a fase 2

Confira que você tem, em texto, cada um destes. Faltando algum, pergunte agora:

- [ ] Escopo (pessoal, empresa, os dois) e onde o OS vai morar
- [ ] Nível de autonomia escolhido
- [ ] Identidade: papel, o que faz, para quem, tom de voz
- [ ] As frentes de trabalho reais, com o nome que **ela** dá a cada uma
- [ ] Quais entidades se repetem (cliente, projeto, canal, pessoa, área da vida)
- [ ] O que precisa ser sabido de cada entidade em dois segundos
- [ ] Fonte da verdade de cada domínio
- [ ] As três perguntas do teste de aceitação
- [ ] Nível de disciplina de captura (honesto)
- [ ] Horários dos rituais
- [ ] O que não pode entrar
