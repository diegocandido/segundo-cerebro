# Versões do Kit OS do Cara da IA

Cada versão nova entra no topo. `VERSAO.txt` diz qual versão é este kit; o segundo cérebro
de quem instalou guarda a dele em `.kit-versao`, e é por ela que um pacote de atualização
sabe de onde partir.

## 1.14 (2026-11-13)
Para quem tem o Estúdio de Conteúdo, os dois estúdios viraram um só. A tecla E abre o Estúdio de Conteúdo, o único lugar com agenda, posts, feed e publicação. O botão Peças abre a Produção: o quadro das peças que o Claude faz (Em criação, Para aprovar, Aprovado, No Estúdio). Numa peça pronta, Mandar para o Estúdio leva os slides, ou os vídeos do carrossel vivo, e a legenda para lá, e ela aparece em Posts sem data, para você agendar. Sem o Estúdio de Conteúdo, nada muda.

## 1.13 (2026-11-13)
O ritual da manhã agora organiza os e-mails. Com o Gmail ligado, o briefing separa as conversas não lidas em cinco grupos: responder hoje, responder na semana, esperando o outro, só ler e pode arquivar. Continua só de leitura: nada é respondido nem arquivado sem o seu ok.

## 1.12 (2026-11-13)
Novo, opcional para quem tem o Estúdio de Conteúdo: gestão do LinkedIn pelo Zernio. A tela LinkedIn do painel (tecla I, no MENU e no anel) mostra seguidores, posts agendados e publicados e os números de cada post. O Claude publica e agenda texto, imagens ou PDF em carrossel pelo bin/linkedin.py, sempre com prévia e a sua confirmação. No perfil pessoal, comentários e mensagens não passam pela API do LinkedIn.

## 1.11 (2026-11-13)
As telas do painel agora ficam no MENU do topo, na seção Funcionalidades, cada uma com a sua tecla: Tarefas, Mission Control, Gestão, Estúdio, Cobranças, Livro-caixa e Falar com o OS. Os botões do canto inferior direito saíram, e o de voz só aparece enquanto grava. O anel de Aplicações ganhou o atalho do Livro-caixa, e o modelo de aplicações passou a pedir só ferramentas que têm tela, uma por tela.

## 1.10 (2026-11-13)
Quando uma camada (como Aplicações) ou uma área do grafo está desligada na legenda, o painel agora mostra um aviso embaixo, com o que está escondido e o botão Mostrar tudo. O filtro fica guardado no navegador e no app instalado, e antes parecia que as aplicações tinham sumido.

## 1.9 (2026-11-12)
Clicar num ícone do anel de Aplicações agora leva direto para a tela daquela ferramenta no painel: Tarefas abre o quadro, Instagram abre o Estúdio Social, WhatsApp, agenda e cobranças abrem a seção certa da Gestão. Alt+clique abre a ficha da ferramenta, com chave, regras e links. Novos ícones de Tarefas, Granola e Instagram, e a ferramenta Tarefas no modelo de aplicações.

## 1.8 (2026-11-12)
O painel agora pode ser instalado como app pelo Chrome: clique no ícone de instalar da barra de endereço e ele ganha janela própria, ícone no Dock ou na barra de tarefas, com o nome e o logo da sua marca, e atalhos para Tarefas, Mission Control e Gestão. Novo passo opcional no macOS: o painel liga sozinho quando você entra no computador e volta se cair.

## 1.7 (2026-11-12)
Quadro de Tarefas no painel (tecla T): um projeto por cliente ou frente e três colunas, A fazer, Fazendo e Feito. Digite e Enter para criar, arraste o cartão para mudar de coluna e clique para editar prazo, prioridade, projeto e descrição. As tarefas ficam no próprio painel, junto com as do Mission Control, e funcionam sem internet. O Claude também lê e cria tarefas pelo bin/tarefas.py, sempre com a sua confirmação antes de criar ou mover. O briefing da manhã pode trazer as tarefas atrasadas e as de hoje.

## 1.6 (2026-11-09)
Estúdio de Conteúdo dentro do painel (opcional, pergunta 13h): quem tem o pacote Estúdio de Conteúdo abre pela tecla E, no visual do painel, a semana, a pauta, os posts com prévia de celular, o feed, as conversas com resposta automática no direct sem ManyChat, os resultados e os ajustes, publicando no Instagram e no TikTok pelo Zernio. Sem o pacote, a tecla E segue abrindo o Estúdio Social. Carrossel vivo: os vídeos agora podem ser publicados pelo bin/instagram.py, além do app do Instagram.

## 1.5 (2026-11-09)
O verificador do painel (bin/checar.js) não para mais quando uma nota do apps.json vem com título e caminho: aceita os dois formatos e só avisa se a nota não existir no OS.

## 1.4 (2026-11-06)
O Estúdio Social ganhou visual novo: fundo escuro com brilho na cor da sua marca, topo com abas e ícones, cartões de vidro e números grandes. A aba Semana abre com a saudação, o próximo post com a capa grande e quanto falta para ele sair, e a agenda com a capa de cada dia. A cor vem do config/workspace.json (estudioCor).

## 1.3 (2026-11-06)
Para atualizar, basta o link do repositório: não precisa de conta nem de login no GitHub. Sem git no computador, o Claude baixa as versões em zip direto pelo link.

## 1.2 (2026-11-06)
Atualizar ficou mais simples: quem já tem o OS recebe o link do repositório do kit e diz ao Claude "confere se meu OS precisa atualizar". Ele compara a sua versão com a mais nova, explica o que muda, faz backup e só aplica com o seu ok. O passo a passo está no novo ATUALIZAR.md, e o README.md mostra por onde começar.

## 1.1 (2026-11-06)
O Estúdio Social (tecla E) ganhou 4 abas: Quadro, Semana, Posts e Feed. A aba Semana mostra o próximo post, os números e os 7 dias, com o seu dia fixo de postar marcado. A aba Posts mostra cada peça numa tela de celular, como vai sair no Instagram, com slides, carrossel vivo e legenda. A aba Feed mostra como o perfil fica com as próximas peças. O @ da prévia e o dia de postar ficam no config/workspace.json (estudioConta e estudioDiaPost).

## 1.0 (2026-11-04)
Primeira versão numerada. Entram o controle de versão (VERSAO.txt, este CHANGELOG e o carimbo .kit-versao no segundo cérebro) e os pacotes de atualização para quem já tem o OS. Desde a instalação de 03/11: Estúdio Social no painel (tecla E), com peça descartada fora do quadro e título pelo status.txt; tela Gestão e Mission Control revistos; verificador do painel (bin/checar.js); prévia do painel no fim da entrevista; carrossel vivo opcional; capa do carrossel com a imagem oficial do que a notícia anuncia; passo opcional que sobe o painel no briefing da manhã.

## Antes da 1.0
Versões sem número, chamadas pela data e hora do zip (AAAA-MM-DD-HHMM).
