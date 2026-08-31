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

    // Guarda uma cópia própria pra prévia no /conversas — o media id da Meta
    // não dá pra buscar de volta sem token, e expira em ~30 dias. Falha aqui
    // não pode derrubar o envio: a mensagem já foi entregue no WhatsApp.
    let mediaUrl: string | null = null;
    try {
      const extensao = imagem.type === 'image/png' ? 'png' : 'jpg';
      const caminho = `${conv.id}/${crypto.randomUUID()}.${extensao}`;
      const { error: uploadErro } = await supabase.storage
        .from('whatsapp-media')
        .upload(caminho, imagem, { contentType: imagem.type });
      if (!uploadErro) {
        const { data: assinada } = await supabase.storage
          .from('whatsapp-media')
          .createSignedUrl(caminho, 60 * 60 * 24 * 365); // 1 ano — uso interno só de prévia
        mediaUrl = assinada?.signedUrl ?? null;
      } else {
        console.error('[send-whatsapp-image] falha ao guardar cópia da imagem:', uploadErro.message);
      }
    } catch (err) {
      console.error('[send-whatsapp-image] falha ao gerar prévia da imagem:', err);
    }

    await supabase.from('messages').insert({
      conversation_id: conv.id, direction: 'outbound', sender_type: 'staff',
      body: caption || '[imagem enviada pela equipe]', wamid, status: 'enviada',
      media_url: mediaUrl,
    });

    return json({ ok: true });
  } catch (err) {
    console.error('[send-whatsapp-image] erro ao enviar:', err);
    return json({ error: String(err) }, 502);
  }
});
