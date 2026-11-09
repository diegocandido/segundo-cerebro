# Bloco 5 do kit: painel e ferramentas

Roda depois do bloco 4 da entrevista do os-builder, no mesmo estilo: rodadas de 2 a 4 perguntas,
espelhando no fim. Pule a pergunta que o bloco 1 (ferramentas e fonte da verdade) já respondeu e
só confirme.

As ferramentas abaixo são **sugestões do Cara da IA**. Apresente cada uma em uma linha (o que
resolve) e deixe o cliente decidir. "Não quero" é resposta válida e vira decisão registrada.

## Rodada 1: painel

1. **Que nome aparece no topo do painel?** Padrão: "Cara da IA OS" com o subtítulo "segundo
   cérebro · {empresa}". Pode ser o nome da empresa do cliente.
2. **Tem logo?** Se tiver, peça o arquivo (PNG quadrado). Sem logo, fica o do Cara da IA.
3. **O painel fica em qual computador?** É o mesmo onde o Claude Code roda e onde o segundo
   cérebro mora. O painel só abre nessa máquina (endereço local).

## Rodada 2: reuniões (gravador)

4. **Você grava as reuniões com clientes?** Com o quê?
   - Se não grava: sugira o **tl;dv** (grava Google Meet, Zoom e Teams, transcreve em português e
     resume) ou o **Granola** (grava pelo computador, sem robô entrando na chamada). Avise do plano
     gratuito do tl;dv: a gravação é arquivada em 2 dias, então a reunião precisa entrar no OS
     antes disso. O nome do gravador entra no `{{GRAVADOR}}` do `/reuniao`.
5. **Depois da reunião, para onde vai o que foi combinado hoje?** Isso define a fonte do
   `/reuniao`: transcrição colada no chat, um banco de reuniões no Notion alimentado pelo gravador
   (com a coluna Status: Nova, No OS, Arquivada), ou o link.
6. **Que tipo de reunião importa guardar?** Venda, cliente ativo, interna. Define onde a nota cai
   no OS (prospect, cliente, decisão).

## Rodada 3: cobrança (Asaas)

> Se o Asaas foi resolvido na fase 0 ("Dados do Asaas, logo no início", em
> [00-roteiro.md](00-roteiro.md)), aqui só confirme as respostas 7 a 10 e siga. A chave já está
> gravada e testada.

7. **Como você cobra hoje?** Boleto, Pix, cartão, recorrência. Em que sistema.
   - Se não tem sistema ou está insatisfeito: sugira o **Asaas** (boleto, Pix e cartão, cobrança
     avulsa e recorrente, avisa o cliente sozinho). O painel mostra vencidas, a vencer e
     recebidas na tecla C e cria cobrança com prévia e confirmação.
8. **Quem pode criar cobrança?** Recomende: só o dono, pelo painel. Nem o Claude nem rotina
   criam cobrança.
9. **Qual o valor máximo de uma cobrança normal sua?** Vira o limite de segurança do painel.
10. **Quais formas de pagamento você aceita?** Pix, Boleto, Cartão, "cliente escolhe".

## Rodada 4: WhatsApp

11. **O WhatsApp é onde seus clientes falam com você?** Número pessoal, WhatsApp Business ou
    API oficial? Quantas pessoas atendem?
12. **O que você quer que o OS faça com o WhatsApp?** Ver conversas e combinados, rascunhar
    respostas e mandar mensagem com a sua confirmação. Atendimento automático e disparo em massa
    **não** entram neste kit.
    - A sugestão é o **Uazapi**: conecta o número por QR code e deixa o OS ler conversas e mandar
      mensagem confirmada, pelo script `bin/whatsapp.py`.
13. **Qual número vai ser conectado, e você aceita o risco?** Explique antes de ele responder: o
    Uazapi não é a API oficial do WhatsApp (simula o WhatsApp Web). Para conversa normal costuma
    funcionar, mas uso automatizado demais pode fazer o WhatsApp bloquear o número. Recomende não
    conectar um número que a empresa não pode perder sem pensar nisso, e nunca disparar em lote.
    - Quem tem o servidor Uazapi: o cliente (conta própria) ou o Cara da IA (instância criada para
      ele)? Isso define quem cria a instância e quem guarda o Admin Token, que **nunca** fica na
      máquina do cliente.
    > Sem "sim" para o risco, o WhatsApp fica `a-definir` no painel, com a necessidade registrada.

## Rodada 5: orçamentos (PandaDoc)

13b. **Se o WhatsApp entrar: a proposta sai pelo seu número?** O OS pode mandar o PDF da proposta
    com a mensagem, pelo WhatsApp dele, sempre com prévia e "pode mandar", e registrar o envio no
    estado do cliente. Contrato continua no canal de assinatura (PandaDoc, e-mail ou o que ele usa).
13c. **Quer que o OS publique no seu Instagram?** Carrossel pronto, publicado pela API oficial
    da Meta só depois do seu "pode postar" para aquele post. Para ligar: conta profissional e
    pública, ligada a uma Página do Facebook, e um app na Meta (o guia em
    [02-ferramentas.md](02-ferramentas.md) mostra os cliques). As imagens precisam ficar num link
    público. Sem a Página ou sem o app, fica `sugerido`, com o que falta registrado.
13d. **Quer que o OS monte as imagens dos seus posts no seu padrão visual?** Duas peças saem do
    mesmo visual: o card de mapa (um tema no centro e 8 pontos em volta, uma imagem só, 1080x1350,
    para LinkedIn e Instagram) e o carrossel de Instagram (5 slides, pergunta 13e). **Peça um
    exemplo:** uma ou duas imagens de post que ele já usa ou gosta, o logo e, se souber, as cores e a
    fonte da marca. Pergunte também onde ele quer ver as peças prontas, todas juntas (um canvas de
    design, uma pasta). Sem exemplo, fica `a definir`, com os modelos como estão. Guia em
    [templates/card-mapa-no-os.md.tmpl](templates/card-mapa-no-os.md.tmpl).
13e. **Você posta carrossel no Instagram?** O modelo tem 5 slides: capa com gancho, três de
    conteúdo numerados e um fechamento fixo com a sua oferta. Se sim, peça: a **foto** de quem
    assina (e uma sem fundo, se tiver, para o fechamento), o **@** que vai nos slides, a **oferta** do
    fechamento (ex.: uma conversa de 30 minutos, um guia) e a **palavra** que o público comenta para
    receber (ex.: QUERO). Sem foto ou sem oferta, o slide sai sem elas e fica `a definir`. Funciona
    com ou sem a publicação pela API (13c): sem ela, ele posta os JPEGs pelo app. Guia em
    [templates/carrossel-no-os.md.tmpl](templates/carrossel-no-os.md.tmpl).
13f. **Se o carrossel entrar: quer também a versão animada?** Cada slide vira um vídeo curto em
    loop (6 a 8 segundos, com música), no mesmo visual do JPEG: o texto não some, só ganha
    movimento (números que carimbam, destaques que pulam, o botão do CTA que pulsa). Sobe no
    Instagram como carrossel de vídeos. Avise antes do sim: pede uns 400 MB no computador (Node,
    ffmpeg, Python e um Chromium) e, por enquanto, a publicação dos vídeos é pelo app do Instagram,
    não pela API. Só Mac ou Linux. Guia em [02-ferramentas.md](02-ferramentas.md), "Carrossel vivo".
13g. **Quer acompanhar as suas peças de rede social num quadro visual?** O Claude cria carrosséis
    com a skill **criador-de-carrosseis-simples** (estratégia, copy slide a slide, design em código,
    crítica com nota até ficar bom e, se quiser, a versão viva em vídeo) e cada peça aparece no
    **Estúdio Social** do painel (tecla E, e uma faixa no Mission Control): a capa, os slides, os
    vídeos e a legenda, em colunas Em criação, Para aprovar, Aprovado e Publicado, com a semana, a prévia em tela de celular e o feed, atualizando
    enquanto o Claude trabalha. Avise antes do sim: o instalador baixa a skill do autor e o motor de
    renderização (uns 400 MB, Mac ou Linux, o mesmo da 13f). Se ele já respondeu sim à 13f, isto vem
    junto. Pergunte também em que pasta do OS ficam as peças (padrão `Social/carrosseis`), qual é o @
    do Instagram (vai na prévia de celular e no Feed) se ele tem um dia fixo de postar (vai marcado na
    aba Semana) e qual é a cor principal da marca (acende o Estúdio). Guia em
    [02-ferramentas.md](02-ferramentas.md), "Criador de carrosséis e Estúdio Social".
13h. **Quer agendar, publicar e responder o direct das suas redes direto do painel?** Só se ele tem
    (ou vai comprar) o pacote **Estúdio de Conteúdo**, que é de outro autor e não vem no kit. Com ele,
    a tecla E abre o estúdio dentro do painel: semana, pauta, posts com prévia de celular, feed,
    conversas (o "comenta QUERO, recebe no direct" sem ManyChat), resultados e ajustes. Publica no
    Instagram e no TikTok pelo Zernio, que é grátis. Guia em
    [estudio-de-conteudo/LEIA.md](estudio-de-conteudo/LEIA.md).
14. **Como você monta um orçamento ou proposta hoje?** Modelo no Word, Canva, PDF, sistema.
    Quanto tempo leva. Quem aprova o preço.
    - Se é manual e repetitivo: sugira o **PandaDoc** (modelo com campos, preenchido
      automaticamente, assinatura eletrônica e aviso de leitura).
15. **Você tem uma tabela de preços ou pacotes?** Onde ela está. Sem tabela, orçamento
    automatizado não tem de onde tirar preço: vira pendência do OS.

## Rodada 6: rotina da manhã

16. **Quer que o painel amanheça com o resumo do dia?** Agenda, e-mails que pedem resposta,
    follow-ups e pendências de ontem. Em que dias e horário (antes do horário sagrado de abrir o
    dia, do bloco 3).

## Rodada 7: voz, livro-caixa e agente remoto (opcionais)

17. **Quer conversar com o segundo cérebro falando?** Botão 🎙 no painel (tecla V), modo mãos
    livres no terminal com palavra de ativação ("Oi, {nome}") e respostas lidas em voz alta.
    Só consulta: a voz não cria, edita nem envia nada.
    - Precisa de **Mac com chip Apple** (a transcrição roda no próprio Mac, o áudio não sai dele).
      Em Windows ou Mac Intel, a voz fica `a-definir`.
    - Qual o **nome da assistente** e a **palavra de ativação**? Como ela chama o dono?
    - Voz: a do macOS (grátis, local) ou a **ElevenLabs** (mais natural, paga, o texto falado vai
      para a ElevenLabs)?
18. **Quer um livro-caixa do dia a dia?** Despesas e recebimentos num CSV local (abre no Numbers e
    no Excel), lançados pelo Claude com o seu ok, e a tecla **L** do painel com entradas, saídas e
    saldo do mês. Não substitui contador nem o sistema de cobrança.
19. **Você usa (ou quer usar) um agente fora do computador**, por exemplo no Telegram, num
    servidor? Se sim:
    - O segundo cérebro passa a ter **backup automático num repositório privado** (GitHub), que é
      por onde o agente lê e grava.
    - O agente pode receber a **agenda do dia**, anotar **despesas, recebimentos e pedidos de
      cobrança** e pedidos de proposta, sempre no inbox, para o dono aprovar no ritual da manhã.
    - Explique antes: o que vai para o repositório fica fora do computador. Clientes e decisões
      vão; livro-caixa, PDFs, contratos e chaves não vão.

> Fecho do bloco: liste as ferramentas em três grupos, **liga hoje**, **fica sugerida** e
> **fica fora**, e confirme com o cliente. Essa lista entra no diagnóstico.
>
> Depois do fecho, antes do diagnóstico, rode a **prévia do painel** (`node painel/bin/previa.js
> --nome "..."`, passo "Fecho da entrevista" em [00-roteiro.md](00-roteiro.md)) e mostre ao cliente
> o grafo, o Mission Control, a Gestão e o Estúdio Social com os dados de exemplo.
