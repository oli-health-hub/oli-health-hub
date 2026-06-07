/**
 * Edge Function: communicare-migrate-patients
 * ─────────────────────────────────────────────────────────────────────────────
 * Job admin: vincula/cria no CC os pacientes existentes do OLI.
 * Disparado manualmente pelo admin (botão no painel).
 *
 * Estratégia de dedup (LGPD — não temos CPF cleartext dos antigos):
 *   1. Se já tem communicare_id → pula
 *   2. findByFilter(externalId = oli_id) → vincula se CC já conhece
 *   3. findByFilter(email) se houver → vincula
 *   4. Senão: cria no CC com externalId = oli_id (sem CPF — antigos só têm hash)
 *
 * Auth: admin only (JWT + profiles.user_type = 'admin').
 * Idempotente: roda quantas vezes precisar.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface PatientRow {
  id:             string;
  nome:           string;
  telefone:       string | null;
  email:          string | null;
  data_nascimento: string | null;
  communicare_id: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return json({ error: 'método não suportado' }, 405);

  // ── Auth admin ───────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'sem auth' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'sessão inválida' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();
  if (profile?.user_type !== 'admin') return json({ error: 'apenas admin' }, 403);

  // ── Config CC ────────────────────────────────────────────────────────────────
  const apiKey  = Deno.env.get('CC_API_KEY');
  const baseUrl = Deno.env.get('CC_PATIENTS_BASE_URL') ?? Deno.env.get('CC_BASE_URL');
  if (!apiKey || !baseUrl) return json({ error: 'CC não configurado' }, 503);

  // ── Carrega pacientes sem vínculo ────────────────────────────────────────────
  const batchSize = 50;
  const { data: patients, error } = await admin
    .from('patients')
    .select('id, nome, telefone, email, data_nascimento, communicare_id')
    .is('communicare_id', null)
    .limit(batchSize);

  if (error)               return json({ error: error.message }, 500);
  if (!patients?.length)   return json({ ok: true, processed: 0, message: 'nada a migrar' });

  let linked  = 0;
  let created = 0;
  let failed  = 0;

  const ccHeaders = { 'x-sso-api-key': apiKey, 'Content-Type': 'application/json' };

  for (const p of patients as PatientRow[]) {
    try {
      let ccId: string | null = null;

      // 2. dedup por externalId
      const byExt = await fetch(
        `${baseUrl}/v1/patient?externalId=${encodeURIComponent(p.id)}`,
        { headers: ccHeaders },
      );
      if (byExt.ok) {
        const list = await byExt.json();
        ccId = Array.isArray(list) ? list[0]?.id : list?.id;
      }

      // 3. dedup por email
      if (!ccId && p.email) {
        const byEmail = await fetch(
          `${baseUrl}/v1/patient?email=${encodeURIComponent(p.email)}`,
          { headers: ccHeaders },
        );
        if (byEmail.ok) {
          const list = await byEmail.json();
          ccId = Array.isArray(list) ? list[0]?.id : list?.id;
        }
      }

      // 4. cria
      if (ccId) {
        linked++;
      } else {
        const createRes = await fetch(`${baseUrl}/v1/patient`, {
          method:  'POST',
          headers: ccHeaders,
          body: JSON.stringify({
            name:       p.nome,
            phone:      p.telefone ?? undefined,
            email:      p.email ?? undefined,
            birthDate:  p.data_nascimento ?? undefined,
            externalId: p.id,
          }),
        });
        if (!createRes.ok) { failed++; continue; }
        const c = await createRes.json();
        ccId = c.id;
        created++;
      }

      if (ccId) {
        await admin
          .from('patients')
          .update({
            communicare_id: ccId,
            sync_status:    'synced',
            sync_progress:  100,
            synced_at:      new Date().toISOString(),
          })
          .eq('id', p.id);
      }
    } catch (e) {
      console.error('migrate patient error', p.id, e);
      failed++;
    }
  }

  // Quantos restam
  const { count: remaining } = await admin
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .is('communicare_id', null);

  return json({
    ok: true,
    processed: patients.length,
    linked, created, failed,
    remaining: remaining ?? 0,
  });
});
