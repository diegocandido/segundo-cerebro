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

## Rodada 2: reuniões (tl;dv)

4. **Você grava as reuniões com clientes?** Com o quê?
   - Se não grava: sugira o **tl;dv** (grava Google Meet, Zoom e Teams, transcreve em português e
     resume). Avise do plano gratuito: a gravação é arquivada em 2 dias, então a reunião precisa
     entrar no OS antes disso.
5. **Depois da reunião, para onde vai o que foi combinado hoje?** Isso define a fonte do
   `/reuniao`: transcrição colada no chat, exportação do tl;dv para o Notion, ou o link.
6. **Que tipo de reunião importa guardar?** Venda, cliente ativo, interna. Define onde a nota cai
   no OS (prospect, cliente, decisão).

## Rodada 3: cobrança (Asaas)

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

> Fecho do bloco: liste as ferramentas em três grupos, **liga hoje**, **fica sugerida** e
> **fica fora**, e confirme com o cliente. Essa lista entra no diagnóstico.
