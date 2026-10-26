# A camada determinística

`assets/brain.py` mais `assets/brain-config.json`. Copie os dois para `bin/` do OS e ajuste a
configuração para as áreas, os tipos e a entidade reais da pessoa. O script não tem nada
específico de um OS: tudo que varia vem da configuração.

## Por que ela existe

Link quebrado, índice defasado, nota que ninguém cita, tipo fora do enum, estado compilado
velho: tudo isso é verificável por comparação de strings. Um script responde em um segundo, a
custo zero de token, e dá a **mesma** resposta toda vez. Pedir isso ao modelo é caro, lento e
inconsistente, e a inconsistência é o pior dos três: um diagnóstico que muda de opinião ensina a
pessoa a ignorá-lo.

O que sobra para o julgamento humano ou do modelo é o que script não alcança: fato vencido
apresentado como presente, duas notas que se contradizem, duplicação de verdade, pasta fora do
mapa, e deriva de fábrica (o mesmo defeito duas rodadas seguidas quer dizer que o gerador está
errado, não a nota).

## Os quatro comandos

```bash
python3 bin/brain.py doctor      # diagnostica, NAO escreve nada. --json para consumo por script
python3 bin/brain.py indexar     # regenera os blocos AUTO. --check só avisa, sai 1 se defasado
python3 bin/brain.py nota ...    # cria nota com frontmatter valido E fecha o indice, num passo
python3 bin/brain.py bench       # tokens do caminho ingenuo vs caminho do indice
```

### `doctor`

Quatorze checagens, cada uma de um defeito que já custou tempo em produção:

| Checagem | O que pega | Princípio |
|---|---|---|
| `link_quebrado` | wikilink e link relativo sem alvo | 15 |
| `wikilink_ambiguo` | `[[nome]]` que casa com mais de um arquivo | 15 |
| `orfa` | nota com **zero link de entrada**, não nota sem link | 11 |
| `tipo_invalido` | valor de `tipo:` fora do enum da configuração | 14 |
| `sem_frontmatter` | falta de metadado onde ele é exigido | 14 |
| `indice_defasado` | bloco AUTO diferente do que o filesystem diz | 9, 10 |
| `estado_defasado` | `atualizado:` mais velho que o último evento | 4, 5 |
| `placeholder_pendente` | esqueleto de contexto nunca preenchido | 4 |
| `referencia_fantasma` | roteador citando comando ou arquivo inexistente | 3 |
| `sem_elo_com_hub` | nota de entidade que não aponta para o hub dela | 11 |
| `nome_datado_sem_assunto` | nome só de data onde ele precisa ser único | 16 |
| `estado_incompleto` | o `estado.md` não tem as duas camadas (`## Estado`, `## Threads abertas`, `## Timeline`) | 4 |
| `thread_sem_dono` | thread aberta sem dono ou sem data, agregada por entidade | 4 |
| `resumo_ausente` | item que o índice lista sem frase útil ao lado | 1 |

> **Os três últimos são os que mais protegem o valor do OS, e os três nasceram de um defeito
> real.** `estado_incompleto` existe porque `estado_defasado` media o **frescor** de uma estrutura
> cuja **existência** ninguém verificava: num OS em produção, 8 de 13 escopos estavam verdes no
> diagnóstico e sem `## Estado`. `resumo_ausente` existe porque o ganho de token do índice depende
> de a frase ao lado de cada item ser confiável, e 10% delas eram lixo (`{`, "materiais",
> "Data: 17/06/2026") sem ninguém olhar. Regra geral: **todo check de frescor vem em par com um
> check de existência da estrutura que ele mede.**

Duas decisões de projeto que fazem a diferença entre um diagnóstico útil e um que a pessoa
ignora:

- **`doctor` nunca escreve.** Diagnóstico que conserta esconde a causa. O conserto é `indexar`,
  chamado por quem leu o diagnóstico.
- **Tolerância deliberada.** `placeholder_pendente` só acusa quando o arquivo é esqueleto de
  verdade (três lacunas, ou metade das seções). Uma lacuna em nota rica é aceitável, e acusar
  isso toda semana treina a pessoa a não ler a saída.
- **A régua olha a informação, não o formato, com uma exceção.** `thread_sem_dono` aceita
  `(Ana)` como dono e `25/05` como data: a primeira versão exigia o literal `Dono:` e produziu 91
  achados, dos quais a maioria estava certa. A exceção é `estado_incompleto`, que exige o nome
  literal da seção, porque quem reescreve o topo do arquivo é o ritual, e ele precisa **encontrar**
  a seção por nome para saber o que substituir.
- **Nunca conte o mesmo defeito duas vezes.** `thread_sem_dono` só cobra de entidade que já tem a
  estrutura: entidade sem ela já foi acusada por `estado_incompleto`, e somar os dois afoga o
  sinal em ruído.

### `indexar`

Reescreve **só** o que está entre `<!-- AUTO:chave -->` e `<!-- /AUTO:chave -->`. Fora dos
marcadores, curadoria humana, nunca tocada (princípio 9). Se o arquivo não tem o marcador, o
script avisa em vez de inventar onde escrever.

Gera dois tipos de bloco: o índice de cada área listada em `areas_indexadas`, e o hub de cada
entidade. No hub, a pasta de contexto fica de fora porque ela já está linkada à mão na curadoria
acima do bloco.

### `nota`

Existe por um motivo só: **remover a chance de esquecer de fechar o índice** (princípio 10). Ele
cria o arquivo com frontmatter válido, escreve a aresta de saída para o hub da entidade quando
há entidade, e chama `indexar` no mesmo comando.

```bash
python3 bin/brain.py nota \
  --pasta clientes/Acme/eventos --tipo evento --datado \
  --titulo "Acme weekly" --entidade Acme \
  --resumo "Weekly em que ficou decidido X" --corpo -   # - le do stdin
```

Todo ritual que cria arquivo deveria chamar este comando em vez de escrever o arquivo direto.

### `bench`

Mede o ganho do caminho do índice contra o caminho ingênuo, usando as perguntas reais do teste
de aceitação. Serve para a disciplina se justificar com número em vez de fé, e para detectar
quando a camada de índice parou de valer a pena.

**Só é informativo acima de umas 50 notas.** Num OS recém-criado o resultado fica abaixo de 1x,
porque a camada de índice custa mais que o corpus inteiro. Isso é correto, não é defeito: diga
isso à pessoa e sugira rodar de novo em um mês.

## A configuração

```jsonc
{
  "entidade_pasta": "clientes",      // null se o OS não tem entidade repetida
  "entidade_label": "cliente",       // o nome no singular, usado no frontmatter
  "entidade_estado": "estado.md",    // o arquivo de estado compilado, dentro da entidade
  "entidade_eventos": "eventos",     // a pasta de eventos datados, dentro da entidade

  "areas_indexadas": ["comercial", "conteudo", "memory"],
  "tipos_validos": ["indice", "decisao", "diario", "cliente", "evento"],

  "exige_frontmatter": ["clientes/", "memory/decisoes/"],
  "exige_preenchimento": ["/contexto/"],
  "nome_datado_escopo": ["/eventos/"],   // onde nome só-de-data é defeito
  "sem_resumo_ok": ["_arquivados", "diario"],  // série datada é fina de propósito

  "dias_defasagem_ok": 14,
  "falsos_positivos": { "caminho/nota.md": ["alvo-ja-julgado"] },
  "bench_perguntas": [{ "pergunta": "...", "termos": ["a", "b"] }]
}
```

Duas armadilhas que a configuração existe para evitar:

- **`nome_datado_escopo` precisa ser estreito.** Diário e snapshot são datados de propósito: a
  colisão de nome só machuca onde o nome precisa ser único para ser wikilinkado. Se você listar
  o OS inteiro, o diário vira ruído semanal.
- **`falsos_positivos` é para julgar uma vez.** Concluiu que um achado não é defeito? Registre
  ali. Achado que volta toda semana mata a credibilidade do diagnóstico inteiro (princípio 13).

## A camada de julgamento

O script cobre o que é comparação de string. O que exige leitura (fato vencido escrito no
presente, contradição entre notas, duplicação de verdade, duplicata de conteúdo, deriva de
fábrica) continua sendo trabalho de quem lê. Existe uma skill companheira, **`manutencao-os`**,
que faz essa varredura em qualquer OS de markdown, reconhecendo a estrutura antes de julgar. Se
a pessoa tiver as duas, mencione; se não tiver, o roteiro de manutenção mínimo é: rodar `doctor`
uma vez por semana e, uma vez por mês, ler os índices e o estado de cada entidade procurando
fato vencido e contradição.

## Quando não instalar

Abaixo de umas 20 notas, ou com uma área só e nenhuma entidade repetida, o custo de manter o
script é maior que o ganho. Diga isso com honestidade e deixe a instalação para quando o OS
crescer: os arquivos ficam aqui, e a estrutura já nasce compatível.
