/**
 * Edge Function: whatsapp-nudge-silencio
 *
 * Reengajamento de lead que parou de responder no meio de uma conversa com
 * a IA — só DENTRO da janela de 24h desde a última mensagem recebida da
 * pessoa (mensagem livre fora dessa janela exige template aprovado pela
 * Meta, que ainda não temos — ver docs/IA_ATENDIMENTO_WHATSAPP.md e
 * pendências do HANDOFF §33). Chamada por cron via pg_net, não pelo Meta —
 * `verify_jwt: true`.
 *
 * Um único reengajamento por silêncio: `conversations.last_nudge_at` marca
 * que já tentamos, e só tenta de novo se a pessoa mandar mensagem nova
 * (o que atualiza `last_inbound_at` e libera outro ciclo).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { enviarTexto } from '../_shared/whatsapp.ts';

const SYSTEM_PROMPT_NUDGE = `Você é a responsável comercial do WhatsApp do OLI Health Hub. Avalie se há
um assunto comercial concreto que ficou genuinamente aberto. Só nesse caso
escreva UMA frase curta que facilite o próximo passo, sem saudação, resumo ou
repetição do que a pessoa já disse. Não refaça a pergunta anterior e não abra
um assunto novo.

Se a conversa já tinha chegado a um fim natural (a pessoa se despediu,
agradeceu e encerrou, já foi transferida pra equipe, ou pediu explicitamente
pra não ser mais contatada), se houve apenas a abertura padrão de anúncio, se
a última entrada é mídia/reação sem conteúdo interpretável, ou se não existe
um próximo passo específico, responda só com a palavra SILENCIO, sem mais nada.
Nunca mencione conversa, histórico, transcrição, formato de mensagem ou
limitação técnica.

Formatação do WhatsApp: negrito é *um asterisco*, nunca **dois**. Português
formal, sem gírias ou contrações informais.`;

const JANELA_MIN_MS = 2  * 60 * 60 * 1000; // silêncio mínimo antes de cutucar
const JANELA_MAX_MS = 22 * 60 * 60 * 1000; // não passa perto da janela de 24h

const ABERTURA_PADRAO_ANUNCIO = /^olá!?\s*posso ter mais informações sobre isso\??$/i;
const MARCADOR_SEM_CONTEUDO = /^\[(?:mensagem tipo|áudio recebido)/i;
const ENCERRAMENTO_EXPLICITO = /\b(?:não,?\s*tudo bem|agora não|não faz sentido|obrigad[oa](?: pela atenção)?|pode encerrar|não tenho interesse)\b/i;
const DESPEDIDA_DA_OLIVIA = /\b(?:é só chamar|fica(?:mos)? por aqui|sucesso com|abraços|até mais|qualquer coisa)\b/i;

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const agora = Date.now();
  const desde = new Date(agora - JANELA_MAX_MS).toISOString();
  const ate = new Date(agora - JANELA_MIN_MS).toISOString();

  const { data: candidatas, error } = await supabase
    .from('conversations')
    .select('id, phone_e164, last_inbound_at, last_nudge_at')
    .eq('kind', 'lead')
    .eq('status', 'ia')
    .gte('last_inbound_at', desde)
    .lte('last_inbound_at', ate)
    .limit(15);

  if (error) {
    console.error('[whatsapp-nudge-silencio] erro ao buscar candidatas:', error);
    return new Response('Erro ao buscar candidatas', { status: 500 });
  }

  const paraTentar = (candidatas ?? []).filter(
    c => !c.last_nudge_at || (c.last_inbound_at && c.last_nudge_at < c.last_inbound_at),
  );

  let enviados = 0;
  for (const conv of paraTentar) {
    try {
      const { data: historico } = await supabase
        .from('messages')
        .select('direction, body')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(40);

      const mensagens = (historico ?? [])
        .filter(m => m.body)
        .map(m => ({ role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const, content: m.body as string }));

      if (mensagens.length === 0) {
        await supabase.from('conversations').update({ last_nudge_at: new Date().toISOString() }).eq('id', conv.id);
        continue;
      }

      const inbound = (historico ?? []).filter(m => m.direction === 'inbound' && m.body).map(m => (m.body as string).trim());
      const ultimaInbound = inbound.at(-1) ?? '';
      const ultimaMensagem = (historico ?? []).at(-1);
      const semContextoUtil = MARCADOR_SEM_CONTEUDO.test(ultimaInbound)
        || ENCERRAMENTO_EXPLICITO.test(ultimaInbound)
        || (inbound.length === 1 && ABERTURA_PADRAO_ANUNCIO.test(ultimaInbound))
        || (ultimaMensagem?.direction === 'outbound' && DESPEDIDA_DA_OLIVIA.test(ultimaMensagem.body ?? ''));

      if (semContextoUtil) {
        await supabase.from('conversations').update({ last_nudge_at: new Date().toISOString() }).eq('id', conv.id);
        continue;
      }

      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SYSTEM_PROMPT_NUDGE,
        messages: mensagens,
      });

      const texto = (response.content[0]?.type === 'text' ? response.content[0].text : '').trim();

      // Marca a tentativa de qualquer forma — não repete o cálculo no próximo
      // ciclo do cron, tenha decidido reengajar ou não.
      await supabase.from('conversations').update({ last_nudge_at: new Date().toISOString() }).eq('id', conv.id);

      if (!texto || texto.toUpperCase() === 'SILENCIO') continue;

      const { wamid } = await enviarTexto({ to: conv.phone_e164, body: texto });
      await supabase.from('messages').insert({
        conversation_id: conv.id, direction: 'outbound', sender_type: 'ia',
        body: texto, wamid, status: 'enviada',
      });
      enviados++;
    } catch (err) {
      console.error(`[whatsapp-nudge-silencio] erro na conversa ${conv.id}:`, err);
    }
  }

  console.log(`[whatsapp-nudge-silencio] ${paraTentar.length} candidatas, ${enviados} reengajamentos enviados`);
  return new Response(JSON.stringify({ candidatas: paraTentar.length, enviados }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
