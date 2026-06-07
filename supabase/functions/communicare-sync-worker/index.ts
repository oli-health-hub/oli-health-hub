/**
 * Edge Function: communicare-sync-worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Processa fila de retry (`communicare_sync_queue`).
 * Rodar via cron a cada 5 min (Supabase Scheduled Function).
 *
 * Para cada job:
 *  - Carrega entidade do banco
 *  - Refaz a chamada ao CC
 *  - Sucesso → marca synced, processed_at
 *  - Falha   → re-enfileira com backoff exponencial até 5 tentativas
 *  - >5 tentativas → marca processed_at + alerta admin
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const MAX_ATTEMPTS = 5;
const BACKOFFS_MS  = [30_000, 120_000, 600_000, 3_600_000, 21_600_000];

interface QueueRow {
  id:              string;
  entity_type:     'patient' | 'reservation' | 'profile';
  entity_id:       string;
  action:          'create' | 'update' | 'delete';
  payload:         Record<string, unknown>;
  attempt_count:   number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const ccApiKey = Deno.env.get('CC_API_KEY');
  const ccBase   = Deno.env.get('CC_BASE_URL');
  const ccPatientsBase = Deno.env.get('CC_PATIENTS_BASE_URL') ?? ccBase;

  if (!ccApiKey || !ccBase) {
    return json({ error: 'CC não configurado' }, 503);
  }

  // Pega jobs pendentes
  const { data: jobs, error } = await supabase
    .from('communicare_sync_queue')
    .select('*')
    .is('processed_at', null)
    .lte('next_attempt_at', new Date().toISOString())
    .limit(50);

  if (error) return json({ error: error.message }, 500);
  if (!jobs?.length) return json({ ok: true, processed: 0 });

  let success = 0;
  let failed  = 0;

  for (const job of jobs as QueueRow[]) {
    try {
      let ok = false;

      if (job.entity_type === 'patient') {
        ok = await processPatientJob(job, ccApiKey, ccPatientsBase!, supabase);
      }
      // reservation / profile handlers conforme CC liberar

      if (ok) {
        await supabase
          .from('communicare_sync_queue')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', job.id);
        success++;
      } else {
        await scheduleRetry(supabase, job);
        failed++;
      }
    } catch (e) {
      console.error('Job error', job.id, e);
      await scheduleRetry(supabase, job, String(e));
      failed++;
    }
  }

  return json({ ok: true, processed: jobs.length, success, failed });
});

// ─── Processors ──────────────────────────────────────────────────────────────

async function processPatientJob(
  job: QueueRow,
  apiKey: string,
  baseUrl: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<boolean> {
  if (job.action === 'create') {
    const cpf = (job.payload.cpfClear ?? '') as string;
    if (!cpf) return false;

    // Dedup
    const findRes = await fetch(`${baseUrl}/v1/patient?cpf=${cpf}`, {
      headers: { 'x-sso-api-key': apiKey },
    });
    let ccId: string | null = null;
    if (findRes.ok) {
      const list = await findRes.json();
      if (Array.isArray(list) && list.length > 0) ccId = list[0].id;
      else if (list?.id) ccId = list.id;
    }

    if (!ccId) {
      const createRes = await fetch(`${baseUrl}/v1/patient`, {
        method:  'POST',
        headers: { 'x-sso-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      job.payload.nome,
          cpf:       cpf,
          birthDate: job.payload.dataNascimento,
          phone:     job.payload.telefone,
          email:     job.payload.email,
        }),
      });
      if (!createRes.ok) return false;
      const created = await createRes.json();
      ccId = created.id;
    }

    if (!ccId) return false;
    await supabase
      .from('patients')
      .update({
        sync_status:    'synced',
        sync_progress:  100,
        synced_at:      new Date().toISOString(),
        communicare_id: ccId,
        last_sync_error: null,
      })
      .eq('id', job.entity_id);
    return true;
  }

  if (job.action === 'update') {
    const ccId = String(job.payload.communicareId ?? '');
    if (!ccId) return false;
    const body: Record<string, unknown> = {};
    if (job.payload.nome      != null) body.name  = job.payload.nome;
    if (job.payload.telefone  != null) body.phone = job.payload.telefone;
    if (job.payload.email     != null) body.email = job.payload.email;
    if (job.payload.healthPlanId != null) body.healthPlanId = job.payload.healthPlanId;

    const res = await fetch(`${baseUrl}/v1/patient/${ccId}`, {
      method:  'PUT',
      headers: { 'x-sso-api-key': apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) return false;
    await supabase
      .from('patients')
      .update({ sync_status: 'synced', synced_at: new Date().toISOString(), last_sync_error: null })
      .eq('id', job.entity_id);
    return true;
  }

  if (job.action === 'delete') {
    const ccId = String(job.payload.communicareId ?? '');
    if (!ccId) return true; // nada a deletar no CC
    const res = await fetch(`${baseUrl}/v1/patient/${ccId}`, {
      method:  'DELETE',
      headers: { 'x-sso-api-key': apiKey },
    });
    // 404 = já removido → considera sucesso
    return res.ok || res.status === 404;
  }

  return false;
}

// deno-lint-ignore no-explicit-any
async function scheduleRetry(supabase: any, job: QueueRow, errorMsg?: string) {
  const attempts = job.attempt_count + 1;
  if (attempts >= MAX_ATTEMPTS) {
    // Fim das tentativas — fecha o job, sinaliza admin
    await supabase
      .from('communicare_sync_queue')
      .update({
        processed_at: new Date().toISOString(),
        attempt_count: attempts,
        last_error:    errorMsg ?? 'max attempts reached',
      })
      .eq('id', job.id);
    // patients permanece 'pending' — admin pode reprocessar manualmente
    return;
  }
  const delay = BACKOFFS_MS[Math.min(attempts, BACKOFFS_MS.length - 1)];
  await supabase
    .from('communicare_sync_queue')
    .update({
      attempt_count:   attempts,
      next_attempt_at: new Date(Date.now() + delay).toISOString(),
      last_error:      errorMsg ?? 'retry',
    })
    .eq('id', job.id);
}
