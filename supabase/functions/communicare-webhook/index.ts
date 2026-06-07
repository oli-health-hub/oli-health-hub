/**
 * Edge Function: communicare-webhook
 * ─────────────────────────────────────────────────────────────────────────────
 * Recebe webhooks do Communicare.
 * Eventos suportados hoje (Swagger): `form_response`.
 * Já preparado para eventos futuros de status de atendimento e paciente:
 *   patient.updated | patient.deleted | appointment.status_changed
 *
 * Segurança: valida header secreto compartilhado (CC_WEBHOOK_SECRET).
 * Persiste eventos em `communicare_webhook_events` para auditoria + replay.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cc-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface WebhookPayload {
  eventType?: string;
  event?:     string;
  data?:      Record<string, unknown>;
  [k: string]: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return json({ error: 'método não suportado' }, 405);

  // ── Valida segredo ─────────────────────────────────────────────────────────
  const secret   = Deno.env.get('CC_WEBHOOK_SECRET');
  const sig       = req.headers.get('x-cc-signature');
  if (secret && sig !== secret) {
    return json({ error: 'assinatura inválida' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let payload: WebhookPayload;
  try { payload = await req.json(); }
  catch { return json({ error: 'body inválido' }, 400); }

  const eventType = payload.eventType ?? payload.event ?? 'unknown';
  const data      = payload.data ?? {};

  // Persiste evento bruto (auditoria + replay)
  await supabase.from('communicare_webhook_events').insert({
    event_type: eventType,
    payload:    payload as Record<string, unknown>,
  });

  // ── Roteia por tipo de evento ────────────────────────────────────────────────
  try {
    switch (eventType) {
      case 'form_response':
        // Resposta de formulário — apenas registrado por enquanto.
        break;

      case 'patient.updated': {
        const ccId = String(data.patientId ?? data.id ?? '');
        if (ccId) {
          await supabase
            .from('patients')
            .update({
              nome:        data.name      ?? undefined,
              telefone:    data.phone     ?? undefined,
              synced_at:   new Date().toISOString(),
              sync_status: 'synced',
            })
            .eq('communicare_id', ccId);
        }
        break;
      }

      case 'patient.deleted': {
        const ccId = String(data.patientId ?? data.id ?? '');
        // Não deletamos local — apenas desvinculamos para auditoria LGPD
        if (ccId) {
          await supabase
            .from('patients')
            .update({ communicare_id: null, sync_status: 'pending' })
            .eq('communicare_id', ccId);
        }
        break;
      }

      case 'appointment.status_changed':
      case 'appointment.finalized': {
        // Atualiza reserva vinculada quando CC sinaliza mudança de status.
        const scheduleId = String(data.scheduleId ?? data.id ?? '');
        if (scheduleId) {
          await supabase
            .from('reservations')
            .update({ sync_status: 'synced' })
            .eq('communicare_schedule_id', scheduleId);
        }
        break;
      }

      default:
        // evento desconhecido — fica registrado para análise
        break;
    }
  } catch (e) {
    console.error('webhook handler error:', e);
    // Retorna 200 mesmo em erro de handler — evento já persistido, evita reenvio infinito
  }

  return json({ ok: true });
});
