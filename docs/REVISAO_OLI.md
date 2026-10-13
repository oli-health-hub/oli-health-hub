# Revisão OLI — modo de revisão de texto da Olivia

> Funcionalidade interna: a Cláudia manda no WhatsApp o texto que pretende
> enviar e a Olivia devolve a versão corrigida. **Nada é enviado ao
> destinatário final** — copiar e enviar continua sendo decisão humana.
> Status: implementada, **não publicada**.

## Como funciona

`whatsapp-webhook` → `processarMensagem` compara o `from` do webhook do Meta
(metadado real, validado por HMAC) com a lista de números autorizados **antes**
de `resolveConversa`. Se bater, segue para `processarRevisaoOli` e retorna;
não cria lead, não abre conversa, não grava o texto no banco, não notifica o
Admin. Se não bater, o fluxo normal da Olivia roda sem nenhuma alteração.

| O quê | Onde |
|---|---|
| Normalização/comparação de telefone, prompt do Revisor, alerta de risco | `supabase/functions/_shared/revisao-oli.ts` |
| Desvio de roteamento e chamada ao modelo (Haiku, temperatura 0,2) | `supabase/functions/whatsapp-webhook/index.ts` (`processarRevisaoOli`) |
| Testes | `supabase/functions/_shared/revisao-oli.test.ts` |

O prompt do Revisor é `SYSTEM_PROMPT_REVISOR`. O texto da Cláudia vai só como
mensagem de usuário, nunca concatenado ao system prompt, e o prompt manda
tratá-lo sempre como texto a revisar.

## Números autorizados

Padrão: `11 91998-0777` (`NUMEROS_REVISAO_PADRAO`, único lugar no código).
A comparação usa DDD + últimos 8 dígitos, então ignora formatação, `+55` e o
nono dígito (o Meta às vezes entrega celular sem ele).

- **Trocar ou acrescentar números sem mexer no código:** definir o secret
  `REVISAO_OLI_NUMEROS` da Edge Function `whatsapp-webhook`, lista separada
  por vírgula, qualquer formatação: `(11) 91998-0777, +55 21 98888-7777`.
  Quando definido, substitui o padrão (inclua a Cláudia na lista).
- Mudou o padrão no código: precisa de novo deploy da função.

## Três níveis

1. **Correção** e 2. **Clareza**: o modelo devolve só o texto corrigido.
3. **Risco**: desconto, preço, reembolso, contrato/jurídico, LGPD, reclamação
   ou incidente. Resposta no formato `Texto revisado: … ⚠️ Essa mensagem
   envolve [motivo]. Recomendo validar com a gestão antes do envio.` Além do
   prompt, `garantirAlerta` aplica uma rede de segurança por palavras-chave:
   se o texto original tiver o sinal e o modelo não alertar, o alerta é
   acrescentado. Não nomeia aprovador (nenhuma regra existente define quem é).

## Comportamento e limites (MVP)

- Só texto. Áudio, imagem, documento, botão/interativo, encaminhada: a Olivia
  responde pedindo para colar o texto. Mensagem respondida (quote) chega como
  texto normal; o trecho citado não é lido.
- Log (`console`): `revisao_oli ok remetente=***0777 sensivel=true|false`, erros
  e tipo não suportado. Nunca registra o conteúdo nem o número completo.
- Falha do modelo: avisa a Cláudia ("Não consegui revisar agora…"). Falha de
  envio só é logada (retornar erro faria o Meta reenviar e duplicar).
- Dedupe de reenvio do Meta é em memória (por instância), melhor esforço: a
  revisão não grava no banco.
- A janela de 24h do WhatsApp vale: como a Cláudia escreve primeiro, a
  resposta livre é permitida.

## Evolução futura (fora do MVP)

- Revisar transcrição de áudio (já existe `transcreverAudio`, hoje restrito a
  lead; aumentaria escopo e custo).
- Ler o trecho citado em mensagens respondidas.
- Dedupe persistente por `wamid` e histórico das revisões (hoje não se grava
  nada por privacidade).
- Lista de números e regras de risco em tabela editável no Admin.
- Definir com a gestão quem valida cada tipo de alerta.

## Testes

`node --test --experimental-strip-types supabase/functions/_shared/revisao-oli.test.ts`
(ou `deno test`). Os 3 testes "modelo real" exigem `ANTHROPIC_API_KEY` e
chamam a API de verdade.
