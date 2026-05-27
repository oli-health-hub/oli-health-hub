/**
 * Edge Function: accept-consent
 *
 * Recebe o token de consentimento LGPD do paciente, valida e grava a aceitação.
 * Pública — não requer autenticação Supabase (paciente não tem conta).
 *
 * GET  /accept-consent?token=UUID  → retorna info do paciente para exibir na página
 * POST /accept-consent             → { token: UUID } → grava consentimento
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Service role — necessário para atualizar patients sem auth do paciente
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);

  // ── GET: retorna nome do paciente e do médico para exibir na página ──────────
  if (req.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'token obrigatório' }, 400);

    const { data, error } = await supabase
      .from('patients')
      .select('nome, consentimento_timestamp, profiles(nome)')
      .eq('consentimento_token', token)
      .single();

    if (error || !data) return json({ error: 'Token inválido ou expirado' }, 404);

    return json({
      pacienteNome:   data.nome,
      medicoNome:     (data.profiles as { nome: string } | null)?.nome ?? 'seu médico',
      jaConsentiu:    !!data.consentimento_timestamp,
    });
  }

  // ── POST: grava consentimento ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    let token: string;
    try {
      const body = await req.json();
      token = body.token;
    } catch {
      return json({ error: 'Body inválido' }, 400);
    }
    if (!token) return json({ error: 'token obrigatório' }, 400);

    // Verifica se token existe e consentimento ainda não foi dado
    const { data: patient, error: fetchErr } = await supabase
      .from('patients')
      .select('id, consentimento_timestamp')
      .eq('consentimento_token', token)
      .single();

    if (fetchErr || !patient) return json({ error: 'Token inválido ou expirado' }, 404);
    if (patient.consentimento_timestamp) {
      return json({ ok: true, jaConsentiu: true }); // idempotente
    }

    // Captura IP e User-Agent para audit trail LGPD
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? req.headers.get('cf-connecting-ip')
             ?? 'desconhecido';
    const ua = req.headers.get('user-agent') ?? '';

    const { error: updateErr } = await supabase
      .from('patients')
      .update({
        consentimento_timestamp: new Date().toISOString(),
        consentimento_ip:        ip,
        consentimento_ua:        ua,
      })
      .eq('consentimento_token', token);

    if (updateErr) {
      console.error('Erro ao gravar consentimento:', updateErr.message);
      return json({ error: 'Erro interno' }, 500);
    }

    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
});
