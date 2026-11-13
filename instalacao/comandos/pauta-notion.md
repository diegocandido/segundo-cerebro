---
description: Espelha a pauta de conteúdo (Social/pauta) no Notion, nos dois sentidos, pelo conector do Notion
---

A pauta mora no OS (`Social/pauta/`, uma nota por ideia, criada e mudada pelo `bin/pauta.py` ou pelos botões
do quadro da Produção no painel). O Notion guarda uma cópia, para consultar e mudar o status fora do painel.
Você é quem copia, pelo conector do Notion. O destino e o mapa de status estão em `bin/pauta-config.json`
(chave `notion`); se `ativo` for falso, diga que o espelho está desligado e pare.

## 1. Do OS para o Notion
1. `python3 bin/pauta.py notion-pendentes`: a lista do que mudou no OS desde a última cópia.
2. Para cada item:
   - **criar:** crie uma página no `data_source` do destino. Título no campo `titulo` do destino; status no
     campo `campo_status`, com o valor de `status_notion`; os campos de `fixos` (ou `fixos_dono`, quando
     `origem` é `dono`). Conteúdo: o `corpo` da nota (gancho, tese, ponte, notas e fontes), sem inventar nada.
   - **atualizar:** abra a página em `notion` e troque o título, o status e o prazo se mudaram. Não reescreva o
     conteúdo que o dono editou no Notion.
   - Depois de cada um: `python3 bin/pauta.py notion-marcar <id> <url-da-pagina>`.
3. Ideia com `roteiro` no Notion: confira que a página da ideia aponta para ele (a coluna
   que liga a ideia ao roteiro, se o banco tiver uma).

## 2. Do Notion para o OS
1. `python3 bin/pauta.py notion-lista`: as ideias que já têm página, com o status que o Notion deve mostrar.
2. Leia o status de cada página no Notion (uma consulta no banco, filtrando pelas URLs).
3. Se o status no Notion é diferente do esperado e `os_mudou_desde_a_copia` é falso, quem mudou foi o dono no
   Notion: traga com `python3 bin/pauta.py status <id> <novo> --de-notion`, usando o `mapa` ao contrário. Quando
   dois status do OS dão o mesmo valor no Notion (ex.: producao e publicada viram "Roteiro pronto"), mantenha o
   do OS se ele já for um dos dois.
4. Se mudou nos dois lados desde a última cópia, não escolha sozinho: mostre os dois e pergunte.
5. Página nova criada direto no Notion (sem nota no OS): crie a nota com `python3 bin/pauta.py nova
   --origem dono ...` e marque com `notion-marcar`.

## No fim
Uma linha: quantas foram para o Notion, quantas vieram de lá e o que ficou para o dono decidir. Nada é publicado
e nenhuma página é apagada: ideia descartada só muda de status.
