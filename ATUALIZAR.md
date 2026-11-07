# Atualizar um OS que já está instalado

Este arquivo é para o Claude de quem **já tem** o segundo cérebro e o painel do Kit OS do Cara da IA.
A pessoa manda o link deste repositório e pede "confere se meu OS precisa atualizar", "atualiza meu
OS" ou parecido. O link é sempre o mesmo: você descobre sozinho se há versão nova e o que mudou.

Instalação nova (quem ainda não tem o OS) não é aqui: siga o [CLAUDE.md](CLAUDE.md).

## Regras
1. **Dado da pessoa nunca muda.** Não sobrescreva nem apague: notas de clientes e entidades,
   `memory/`, `estado.md`, diário, decisões, `painel/config/*.json` (sem `.example`), `painel/state/`,
   chaves, arquivos `.env` e nada fora do OS e do painel.
2. **O que foi feito sob medida fica.** Comando e nota que nasceram de modelo foram adaptados para
   esta pessoa na instalação. Leve só a regra ou o passo novo, escrito no jeito dela, nunca o modelo
   inteiro por cima.
3. **Mostre antes, aplique depois.** Monte o plano, mostre e espere o "pode" da pessoa.
4. **Senha e token nunca passam pelo chat.** O login no GitHub é feito pela pessoa, no navegador ou
   no terminal dela.
5. **Nada de travessão** (em dash) nos textos que você escrever.
6. **Na dúvida, pergunte.** Arquivo que não existe no OS da pessoa é recurso que ela não adotou:
   não instale sem ela pedir.

## Passo 1. Ver se precisa atualizar
1. **Achar o OS e o painel.** Pergunte onde estão, se não souber (a pasta do segundo cérebro, com
   `CLAUDE.md` e `bin/brain.py`, e a pasta do painel, com `server.js`).
2. **Versão instalada:** leia `<OS>/.kit-versao` (uma linha, ex.: `1.1` ou `2026-11-03-1544`).
3. **Baixar o kit.** A cópia do repositório mora em `<OS>/../.kit-repo/` e é reaproveitada nas
   próximas vezes:
   - Já existe: `git -C <OS>/../.kit-repo fetch --tags --force origin && git -C <OS>/../.kit-repo checkout -q origin/main`.
   - Não existe: `git clone <link> <OS>/../.kit-repo`.
   - **Pediu login** (o repositório é privado): é a primeira vez neste computador. Veja
     "Login no GitHub" no fim e, com o login feito, rode de novo.
4. **Versão nova:** leia `<OS>/../.kit-repo/VERSAO.txt`.
5. **Igual à instalada?** Diga "Seu OS está em dia, na versão X" e pare. **Diferente?** Leia no
   `CHANGELOG.md` as notas das versões entre a dela e a nova e explique em poucas linhas, em
   português simples, o que ela ganha. Pergunte se quer atualizar agora.

## Passo 2. Ver o que mudou
A versão instalada vira uma tag do repositório:
- número (`1.0`, `1.1`): tag `v1.0`, `v1.1`;
- data (`2026-11-03-1544`, instalação anterior à 1.0): tag `legado-2026-11-03-1544`.

Confira que a tag existe (`git -C <OS>/../.kit-repo tag`). Então:
- lista do que mudou: `git -C <OS>/../.kit-repo diff --name-status <tag-dela> origin/main`;
- o que mudou num arquivo: `git -C <OS>/../.kit-repo diff <tag-dela> origin/main -- <arquivo>`;
- um arquivo como era antes: `git -C <OS>/../.kit-repo show <tag-dela>:<arquivo>`.

**Sem `.kit-versao`** (instalou antes do carimbo): pergunte quando instalou e use a tag `legado-...`
mais próxima antes dessa data. Se ninguém souber, compare o kit novo direto com o que está no OS,
arquivo por arquivo, com cuidado redobrado.

## Passo 3. Atualizar
1. **Backup.** Antes de qualquer mudança, copie a pasta do painel inteira e, do OS, `CLAUDE.md`,
   `.claude/` e `bin/` para `<OS>/../backup-os-<versão nova>/`. Diga onde ficou.
2. **Plano.** Para cada arquivo da lista, diga em uma linha o que muda para a pessoa e o que você
   vai fazer. Agrupe: o que substitui direto, o que precisa adaptar, o que só vale se ela usar o
   recurso, o que é só referência. Espere o "pode".
3. **Aplicar**, grupo por grupo:
   - **Painel** (`painel/...`): copie o arquivo novo para o mesmo lugar na pasta do painel. Os
     arquivos `LICENSE` e `NOTICE` vão sem alteração.
   - **Configs do painel** (`painel/config/*.example`): compare o `.example` novo com o `.json` da
     pessoa. Chave nova: mostre e acrescente só com o "pode", com o valor dela ou `*(preencher)*`.
     Nunca troque valor existente.
   - **Scripts** (`instalacao/scripts/`): substitua `bin/<nome>` no OS só se já existir lá. Se a
     pessoa grava algo pessoal no script (nome, voz, número), confira que continua em config e não
     no código.
   - **Comandos e notas de modelo** (`instalacao/templates/`, `os-builder/templates/`): ache o
     arquivo do OS que nasceu do modelo (o comando em `.claude/commands/`, a nota com o mesmo papel)
     e acrescente só a regra ou o passo novo, no tom e com os nomes dela. Se não achar, pergunte.
   - **Instaladores** (`instalacao/<recurso>/`): rode de novo só se a pessoa usa o recurso.
   - **Roteiros e guias** (`instalacao/*.md`, `os-builder/`, `CLAUDE.md`, `LEIA-PRIMEIRO.md`): são
     referência. Leia para entender a mudança e use o que valer para o OS dela.
4. **Testar.** `python3 bin/brain.py indexar` e `python3 bin/brain.py doctor` no OS; na pasta do
   painel, `node bin/checar.js --testar` até 0 erro. Reinicie o painel (pare e suba de novo) e abra
   a página para conferir. Se algo quebrar, volte o arquivo do backup e avise.
5. **Carimbar.** Grave a versão nova em `<OS>/.kit-versao` (uma linha).
6. **Resumo.** Diga em poucas linhas o que entrou, o que ficou de fora e por quê, e onde está o
   backup. Sugira que a pessoa avise quem entregou o kit que agora está na versão nova.

## Login no GitHub (uma vez por computador)
O repositório é privado: a pessoa precisa de uma conta no GitHub com o convite aceito (chega no
e-mail dela). Depois, um destes caminhos, feito por ela:
- **Pelo navegador (mais fácil, se o computador tem o GitHub CLI):** `gh auth login` (escolha
  GitHub.com, HTTPS e "Login with a web browser") e depois `gh auth setup-git`.
- **Com token:** ela cria um token clássico em github.com/settings/tokens/new, marcando só **repo**,
  e roda o `git clone` no terminal dela. Quando pedir, o usuário é o dela no GitHub e a senha é o
  token (o terminal não mostra o que é colado). O computador guarda e não pede de novo.

Se não der para logar, o plano B é quem entregou o kit mandar um pacote de atualização em zip, que
traz as mesmas instruções.
