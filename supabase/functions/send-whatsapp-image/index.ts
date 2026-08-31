/**
 * Edge Function: send-whatsapp-image
 *
 * Envia uma foto anexada pela equipe numa conversa existente (lead ou
 * paciente) — usado pelo inbox /conversas do admin, ao lado do
 * send-whatsapp-reply (texto). Mesma janela de 24h da Meta.
 *
 * A imagem sobe direto pro Media Storage da Meta (sem depender de bucket
 * público) e é enviada por media id — ver subirMidiaWhatsApp em
 * _shared/whatsapp.ts.
 *
 * Body: multipart/form-data — conversationId, imagem (arquivo), legenda? (texto)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { subirMidiaWhatsApp, enviarImagemPorId } from '../_shared/whatsapp.ts';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5MB — limite da própria Meta pra imagem

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Corpo inválido — esperado multipart/form-data' }, 400);
  }

  const conversationId = form.get('conversationId');
  const legenda        = form.get('legenda');
  const imagem         = form.get('imagem');

  if (typeof conversationId !== 'string' || !conversationId) {
    return json({ error: 'conversationId é obrigatório' }, 400);
  }
  if (!(imagem instanceof File)) {
    return json({ error: 'imagem é obrigatória' }, 400);
  }
  if (!TIPOS_ACEITOS.includes(imagem.type)) {
    return json({ error: 'Formato não aceito — envie JPEG ou PNG.' }, 400);
  }
  if (imagem.size > TAMANHO_MAXIMO) {
    return json({ error: 'Imagem maior que 5MB — reduza o tamanho antes de enviar.' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle();
  if (!conv) return json({ error: 'Conversa não encontrada' }, 404);

  if (!conv.last_inbound_at) {
    return json({ error: 'Conversa sem mensagem recebida ainda — não é possível enviar foto livre. Use um template primeiro.' }, 400);
  }
  const horasDesdeUltimaInbound = (Date.now() - new Date(conv.last_inbound_at).getTime()) / 3_600_000;
  if (horasDesdeUltimaInbound > 24) {
    return json({ error: 'Fora da janela de 24h da Meta — não é possível enviar foto livre.' }, 400);
  }

  try {
    const { mediaId } = await subirMidiaWhatsApp(imagem, imagem.type);
    const caption = typeof legenda === 'string' ? legenda.trim() : '';
    const { wamid } = await enviarImagemPorId({ to: conv.phone_e164, mediaId, caption: caption || undefined });

    await supabase.from('messages').insert({
      conversation_id: conv.id, direction: 'outbound', sender_type: 'staff',
      body: caption || '[imagem enviada pela equipe]', wamid, status: 'enviada',
    });

    return json({ ok: true });
  } catch (err) {
    console.error('[send-whatsapp-image] erro ao enviar:', err);
    return json({ error: String(err) }, 502);
  }
});
