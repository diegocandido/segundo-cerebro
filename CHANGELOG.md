# Versões do Kit OS do Cara da IA

Cada versão nova entra no topo. `VERSAO.txt` diz qual versão é este kit; o segundo cérebro
de quem instalou guarda a dele em `.kit-versao`, e é por ela que um pacote de atualização
sabe de onde partir.

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
