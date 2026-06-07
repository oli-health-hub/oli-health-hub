/**
 * Edge Function: communicare-proxy
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxy server-side para a Communicare API.
 * Mantém token x-sso-api-key fora do app (nunca chega ao cliente).
 *
 * Auth: requer JWT do Supabase no header Authorization.
 * Path: ?path=/v1/patient → forwarda para https://...communicare.../v1/patient
 * Body: passa direto.
 *
 * ENV obrigatórias:
 *   CC_BASE_URL              ex: https://api-integrations-staging.communicare.com.br/api
 *   CC_API_KEY               x-sso-api-key
 *   CC_PATIENTS_BASE_URL     (opcional) ex: https://api-patients-staging...
 *
 * Roteamento:
 *   /v1/patient*       → CC_PATIENTS_BASE_URL ?? CC_BASE_URL
 *   /v1/sso/*          → CC_BASE_URL
 *   /v1/agenda*        → CC_BASE_URL
 *   /v1/health-plans   → CC_BASE_URL
 *   /v1/history        → CC_BASE_URL
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ─── Auth: valida JWT Supabase ─────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'sem auth' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: 'sessão inválida' }, 401);

  // ─── Resolve CC URL ────────────────────────────────────────────────────────
  const ccApiKey      = Deno.env.get('CC_API_KEY');
  const ccBase        = Deno.env.get('CC_BASE_URL');
  const ccPatientsBase = Deno.env.get('CC_PATIENTS_BASE_URL') ?? ccBase;

  if (!ccApiKey || !ccBase) {
    return json({ error: 'CC não configurado no servidor' }, 503);
  }

  const url     = new URL(req.url);
  const ccPath  = url.searchParams.get('path');
  if (!ccPath) return json({ error: 'path obrigatório' }, 400);

  const base = ccPath.startsWith('/v1/patient') ? ccPatientsBase : ccBase;
  const ccUrl = `${base}${ccPath}`;

  // ─── Forward ──────────────────────────────────────────────────────────────
  const fwdHeaders: Record<string, string> = {
    'x-sso-api-key': ccApiKey,
    'Content-Type':  'application/json',
  };

  // Se o profile tem JWT CC, manda também
  const { data: profile } = await supabase
    .from('profiles')
    .select('communicare_jwt')
    .eq('id', user.id)
    .single();
  if (profile?.communicare_jwt) {
    fwdHeaders['Authorization'] = `Bearer ${profile.communicare_jwt}`;
  }

  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    body = await req.text();
  }

  try {
    const ccRes = await fetch(ccUrl, {
      method:  req.method,
      headers: fwdHeaders,
      body,
    });

    const text = await ccRes.text();
    return new Response(text, {
      status:  ccRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': ccRes.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (e) {
    console.error('CC proxy error:', e);
    return json({ error: 'erro ao chamar CC', detail: String(e) }, 502);
  }
});
