# Kit OS do Cara da IA: instalação para um cliente novo

Você está numa sessão aberta dentro deste kit para instalar, num cliente que **ainda não tem
segundo cérebro**, o mesmo sistema que roda no OS do Cara da IA: um segundo cérebro em arquivos
markdown operado pelo Claude, mais um painel visual (grafo + Mission Control) rodando no
computador do cliente.

Quando a pessoa disser "instalar", "começar", "montar o OS" ou parecida, siga o roteiro de
[instalacao/00-roteiro.md](instalacao/00-roteiro.md), na ordem, sem pular fase.

## O que tem aqui

| Pasta | O que é |
|---|---|
| `os-builder/` | A skill que entrevista o cliente e constrói o segundo cérebro. Leia `os-builder/SKILL.md` antes de começar: é ela que manda nas fases de entrevista, diagnóstico e construção. |
| `instalacao/` | O roteiro de instalação, as perguntas extras do kit (painel e ferramentas), o guia de cada ferramenta sugerida e os modelos de comando. |
| `painel/` | O painel (servidor Node sem dependências). Não roda daqui: na fase 5 ele é copiado para fora do kit e configurado para o segundo cérebro do cliente. |

## Regras deste kit (somam às do os-builder)

1. **Entrevista antes de tudo.** Nada é criado, nem o segundo cérebro nem o painel, antes do
   diagnóstico aprovado pelo cliente. As perguntas extras do kit entram **dentro** da entrevista
   do os-builder, como o último bloco.
2. **Ferramenta sugerida não é ferramenta adotada.** tl;dv, Asaas, PandaDoc e o WhatsApp pelo
   Uazapi são sugestões do Cara da IA. Só entram como `live` no painel as que o cliente usa ou
   decidiu adotar e que foram testadas. As outras ficam `sugerido` ou `a-definir`, ou saem.
3. **Chave nunca passa pelo chat.** Nenhuma chave de API é pedida, colada ou exibida na conversa.
   O cliente grava a chave pelo terminal com o script do painel, e você só confere se o arquivo
   existe.
4. **Asaas começa no sandbox.** Produção só depois de uma cobrança de teste no sandbox, criada
   pelo próprio cliente no painel, e de ele pedir explicitamente.
5. **Nível Advisor.** Nada sai para fora (mensagem, e-mail, cobrança, orçamento) sem o "pode
   mandar" do cliente para aquele envio.
6. **Nunca invente.** Campo sem resposta fica `*(preencher)*`. Vale para o segundo cérebro, para
   as configs do painel e para o painel de cada ferramenta.
7. **Nada de travessão** (em dash) nos arquivos gerados.
8. **Crédito do painel.** Os arquivos `painel/LICENSE` e `painel/NOTICE` vão junto na cópia, sem
   alteração (licença CC BY 4.0 do motor do grafo).
