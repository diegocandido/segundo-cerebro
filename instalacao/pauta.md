# Pauta de conteúdo (opcional, junto com a 13g)

Cada sugestão de post é uma nota no segundo cérebro (`Social/pauta/`, uma por ideia), criada pelo
`bin/pauta.py`. O cliente aprova, descarta ou dá prazo onde estiver:

- **no painel:** o quadro da Produção (botão Peças do Estúdio, ou a tecla E sem o Estúdio de Conteúdo) ganha
  as colunas **Sugeridas** e **Aprovadas** antes de Em criação, com os botões Aprovar, Prazo e Descartar;
- **no Notion** (se ele usa): um banco "Pauta de conteúdo" recebe a cópia de cada ideia, e o status mudado lá
  volta para o OS pelo `/pauta-notion`, que roda no ritual da manhã;
- **pela conversa:** "aprova a 2", "descarta a do GIF", "essa sai quinta".

Aprovada, a ideia vira peça (ela sai da coluna Aprovadas quando a peça leva `pauta: <id>` no `status.txt`),
segue o quadro e, com o Estúdio de Conteúdo, vai para a agenda pelo "Mandar para o Estúdio".

## Instalar (uns 10 minutos)
1. **Script:** copie `instalacao/scripts/pauta.py` para `bin/pauta.py` do OS.
2. **Config:** copie `templates/pauta-config.json.example` para `bin/pauta-config.json` do OS (sem o
   `.example`). Pasta padrão `Social/pauta`; troque se a área de redes do cliente tiver outro nome.
3. **Tipo de nota:** acrescente `"pauta"` em `tipos_validos` do `bin/brain-config.json` e no enum do
   `CONVENCOES.md` do OS. Depois `python3 bin/brain.py indexar`.
4. **Regras:** no `CLAUDE.md` da área de redes, escreva que toda sugestão entra pelo `pauta.py nova`
   (com gancho, tese, ponte com o tema do cliente, formato e fontes), que só o cliente aprova, e os comandos
   `status`, `prazo` e `ligar` (roteiro, peça, publicado). Se ele tem o Estúdio de Conteúdo: nunca usar a
   Pauta do estúdio (`pauta-add`); a pauta é esta.
5. **Ritual:** inclua o bloco "Pauta de conteúdo" do comando da manhã (`os-builder/templates/comandos/abrir.md.tmpl`).
6. **Notion (só se ele usa e o conector está ligado):** crie no Notion dele um banco **Pauta de conteúdo**
   com o título **Ideia** e um **Status** com Sugerida, Aprovada, Em produção, Publicada e Descartada. Grave
   o `collection://` em `data_source`, ponha `ativo: true` e copie `instalacao/comandos/pauta-notion.md` para
   `.claude/commands/` do OS. Se ele já tem um banco de ideias, use o dele: ajuste `titulo`, `campo_status`
   e o `mapa` para os nomes que existem lá (e acrescente um status Descartada, se faltar).
7. **Testar:** `python3 bin/pauta.py nova --titulo "Teste da pauta" --gancho "..."`, abra o quadro da
   Produção e veja o cartão em Sugeridas; clique em Aprovar e em Voltar. Com Notion, rode o `/pauta-notion`
   e confira a página. Apague a nota de teste no fim (e a página no Notion, pela lixeira, com o ok dele).

## Atualizar quem já tem o OS
É um recurso novo: siga os passos acima só se o cliente quiser. Nada do que ele já tem muda.
