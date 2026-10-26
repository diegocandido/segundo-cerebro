# Os rituais e o primeiro voo

Ritual é o que transforma o OS de arquivo consultado em sistema que trabalha. Sem ritual, a
pessoa lembra do OS quando já perdeu a informação.

## Os quatro que valem para qualquer pessoa

Os nomes e os horários saem da entrevista (bloco 3, pergunta 20). Os papéis não mudam.

| Papel | Nome típico | Quando | O que faz |
|---|---|---|---|
| **Abrir** | `/bom-dia` | No horário que a pessoa disse ser o de começar | Lê prioridades + último diário, puxa agenda e as fontes externas dela, devolve uma tela escaneável em 30 segundos |
| **Fechar** | `/fim-de-dia` | Fim do expediente | Escreve o diário do dia: o que rolou, o que foi decidido, o que fica pendente. É a memória entre sessões |
| **Revisar** | `/revisao-semanal` | O dia da semana que ela apontou | Fecha a semana: estado das metas, o que travou, esvazia o inbox item por item, reescreve as prioridades |
| **Capturar** | `/capturar` | Qualquer hora | Joga a ideia no `inbox/` sem triar. Zero decisão, zero elaboração |

Adicione `/decidir` (registra decisão que muda o rumo) sempre que a entrevista mostrar que a
pessoa toma decisões relevantes toda semana, o que é quase sempre. Templates dos cinco em
`templates/comandos/`.

Além desses, todo processo que a pessoa **repete e faz de cabeça** é candidato a ritual próprio:
entidade nova entrando, evento terminando, ciclo fechando. Não crie de especulação. Crie o que
ela descreveu no bloco 2 como "sempre que acontece X, eu faço Y".

## O par que carrega o sistema

`/fim-de-dia` escreve, `/bom-dia` lê. Esse ciclo é a única coisa que dá continuidade entre
sessões, e é o que faz a pessoa sentir que o OS a conhece. Se ela só for adotar dois rituais,
que sejam esses dois.

## Como escrever um ritual que funciona

Um comando bom tem quatro partes, nesta ordem:

1. **O papel em uma frase.** "Você é o chefe de gabinete dela. Monte o briefing da manhã."
   Papel define postura melhor que instrução.
2. **O que coletar, em paralelo, com o caminho exato.** Arquivo por arquivo, fonte por fonte.
   Nomeie o arquivo (`memory/PRIORIDADES.md`), não a intenção ("as prioridades").
3. **O formato do output, literal, em bloco de código.** Ritual sem formato fixo devolve coisa
   diferente todo dia, e o valor do ritual é justamente a pessoa saber onde olhar.
4. **As regras.** Nível de autonomia, o que fazer quando uma fonte falhar, e a proibição de
   inventar. Esta é a regra que mais importa: **fonte que falhou é fonte que falhou.** Diga que
   falhou, preserve o último valor conhecido marcado como velho, nunca estime nem zere.

Duas regras transversais que todo ritual carrega:

- **Priorize sinal.** Se está tudo tranquilo, diga em uma linha e siga. Ritual que inventa
  urgência para parecer útil ensina a pessoa a ignorá-lo.
- **Se cria arquivo, fecha o índice no mesmo passo** (princípio 10).

## O hook de início de sessão

Se o OS mora em pasta local aberta no Claude Code, o maior ganho por linha de código do sistema
inteiro: um hook que injeta contexto no começo de toda sessão, sem a pessoa pedir nada.

Ele entrega três coisas: as prioridades atuais, onde a pessoa parou (as pendências do último
diário) e a saúde do OS.

**A regra que faz ele valer a pena: silencioso quando está tudo limpo.** A parte de saúde só
aparece quando há algo a fazer. Gastar contexto todo dia dizendo que está tudo bem treina a
pessoa a não ler o bloco, e aí o dia em que houver problema ela também não lê.

Script pronto em `assets/session-start.sh`, com a configuração de `.claude/settings.json`.

## Rotinas agendadas

Se a plataforma da pessoa oferecer execução agendada, os candidatos naturais são o passe
semanal de manutenção e o preparo do briefing. Duas advertências, as duas de casos reais:

- **Rotina agendada é a maior fábrica de notas do OS**, e a mais fácil de esquecer quando uma
  convenção muda. Convenção nova só vale quando desce até as rotinas (princípio 12).
- **Lista fechada dentro de rotina envelhece em silêncio** (princípio 26). Derive a lista do
  estado real, ou escreva na própria rotina o aviso de que ela envelhece.

---

## Fase 4: o primeiro voo

O OS nasce vazio, e vazio ele não convence. Feche a construção com dado real e com uma prova.

1. **Popule uma entidade de verdade, junto com a pessoa.** Escolha a mais viva. Preencha
   contexto e estado com o que ela souber de cabeça, sem inventar nada. Ela vai ver a estrutura
   fazendo sentido e vai corrigir o que estiver estranho.
2. **Traga contexto de fora, se houver de onde.** Site da empresa, transcrição da última
   reunião, e-mail, exportação do CRM: qualquer fonte que já exista poupa a pessoa de digitar e
   mostra o OS trabalhando no primeiro dia.
3. **Rode a prova.** Responda, usando **só** o OS, as três perguntas do teste de aceitação que
   ela deu na entrevista. Mostre de onde saiu cada resposta, citando o caminho do arquivo. Se
   alguma não fechar, a estrutura está errada: conserte agora, não depois.
4. **Rode `doctor` e mostre a saída.** Limpo, ou com o que sobrou explicado.
5. **Rode um ritual de verdade.** De preferência o `/fim-de-dia` do próprio dia da construção:
   assim o primeiro `/bom-dia` dela já tem de onde ler.
6. **Entregue o `COMO-USAR.md`** e diga em três linhas o que fazer amanhã: rodar o ritual de
   abrir, capturar sem triar, e não tentar preencher tudo de uma vez.
7. **Combine a primeira revisão.** Uma ou duas semanas. O que a pessoa não usou nesse período é
   candidato a ser cortado, e cortar cedo é o que mantém o OS honesto.
