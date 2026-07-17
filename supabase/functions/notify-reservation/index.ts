/**
 * Edge Function: notify-reservation
 *
 * Chamada pelo trigger `trg_notify_reservation_created` (AFTER INSERT em
 * `reservations`) via net.http_post — mesmo padrão do `call_send_push`.
 *
 * Faz duas coisas quando uma reserva é criada:
 *   1. Insere notificação em `admin_notifications` (central de notificação do admin).
 *   2. Envia e-mail via Resend pros endereços em RESERVATION_ALERT_EMAILS.
 *
 * Body: { reservationId, professionalId, roomName, startTime, endTime }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const TZ = 'America/Sao_Paulo';

function formatDateTime(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return { data, hora };
}

async function sendEmail(opts: { nome: string; roomName: string; startTime: string; endTime: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = (Deno.env.get('RESERVATION_ALERT_EMAILS') ?? '').split(',').map(e => e.trim()).filter(Boolean);
  if (!apiKey || to.length === 0) {
    console.log('notify-reservation: RESEND_API_KEY ou RESERVATION_ALERT_EMAILS ausente — pulei e-mail');
    return;
  }

  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'OLI Health Hub <reservas@olihealthhub.com.br>';
  const { data: dataInicio, hora: horaInicio } = formatDateTime(opts.startTime);
  const { hora: horaFim } = formatDateTime(opts.endTime);

  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2F2F2F;margin:0 0 16px;">Nova reserva de sala</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#2F2F2F;">
        <tr><td style="padding:6px 0;color:#6B6B6B;">Profissional</td><td style="padding:6px 0;font-weight:700;">${opts.nome}</td></tr>
        <tr><td style="padding:6px 0;color:#6B6B6B;">Sala</td><td style="padding:6px 0;font-weight:700;">${opts.roomName}</td></tr>
        <tr><td style="padding:6px 0;color:#6B6B6B;">Data</td><td style="padding:6px 0;font-weight:700;text-transform:capitalize;">${dataInicio}</td></tr>
        <tr><td style="padding:6px 0;color:#6B6B6B;">Horário</td><td style="padding:6px 0;font-weight:700;">${horaInicio} – ${horaFim}</td></tr>
      </table>
    </div>
  `.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `Nova reserva — ${opts.roomName} em ${dataInicio}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error('notify-reservation: Resend respondeu erro', res.status, await res.text());
    }
  } catch (err) {
    console.error('notify-reservation: falha ao chamar Resend', err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: {
    reservationId:  string;
    professionalId: string;
    roomName:       string;
    startTime:      string;
    endTime:        string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', body.professionalId)
    .maybeSingle();
  const nome = profile?.nome ?? 'Profissional';

  const { data: dataInicio, hora: horaInicio } = formatDateTime(body.startTime);
  const { hora: horaFim } = formatDateTime(body.endTime);

  const { error } = await supabase.from('admin_notifications').insert({
    type:            'reservation_created',
    professional_id: body.professionalId,
    title:           `Nova reserva: ${nome}`,
    body:            `${body.roomName} — ${dataInicio}, ${horaInicio}–${horaFim}`,
    metadata:        { reservationId: body.reservationId, roomName: body.roomName, startTime: body.startTime, endTime: body.endTime },
  });

  if (error) {
    console.error('notify-reservation: erro ao inserir notificação', error);
  }

  await sendEmail({ nome, roomName: body.roomName, startTime: body.startTime, endTime: body.endTime });

  console.log(`[notify-reservation] reserva ${body.reservationId} — ${nome} — ${body.roomName}`);
  return new Response('ok', { status: 200 });
});
