/**
 * Edge Function: send-whatsapp-reply
 *
 * Envia texto livre da recepção numa conversa existente (lead ou paciente) —
 * usado pelo inbox /conversas do admin. Só funciona dentro da janela de 24h
 * desde a última mensagem recebida (regra da Meta); fora dela, use
 * send-patient-trigger (template) ou espere o contato mandar mensagem de novo.
 *
 * Body: { conversationId: string, texto: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { enviarTexto } from '../_shared/whatsapp.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  let body: { conversationId: string; texto: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!body.conversationId || !body.texto?.trim()) {
    return json({ error: 'conversationId e texto são obrigatórios' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: conv } = await supabase.from('conversations').select('*').eq('id', body.conversationId).maybeSingle();
  if (!conv) return json({ error: 'Conversa não encontrada' }, 404);

  if (!conv.last_inbound_at) {
    return json({ error: 'Conversa sem mensagem recebida ainda — não é possível iniciar com texto livre. Use um template.' }, 400);
  }
  const horasDesdeUltimaInbound = (Date.now() - new Date(conv.last_inbound_at).getTime()) / 3_600_000;
  if (horasDesdeUltimaInbound > 24) {
    return json({ error: 'Fora da janela de 24h da Meta — envie um template em vez de texto livre.' }, 400);
  }

  try {
    const texto = body.texto.trim();
    const { wamid } = await enviarTexto({ to: conv.phone_e164, body: texto });

    await supabase.from('messages').insert({
      conversation_id: conv.id, direction: 'outbound', sender_type: 'staff',
      body: texto, wamid, status: 'enviada',
    });

    return json({ ok: true });
  } catch (err) {
    console.error('[send-whatsapp-reply] erro ao enviar:', err);
    return json({ error: String(err) }, 502);
  }
});
