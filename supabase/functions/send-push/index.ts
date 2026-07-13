/**
 * Edge Function: send-push
 *
 * Envia push notification remota (Expo Push API) para um profissional
 * específico ou para todos com token registrado.
 *
 * Body: { professionalId?: string, title: string, body: string, data?: object }
 *   - sem professionalId → broadcast pra todos os tokens
 *
 * Segurança: requer JWT válido E user_type=admin no profile
 * (mesmo padrão do admin-asaas-summary). Cron/automations futuras
 * chamam com service_role key no Authorization.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100; // limite da Expo Push API por request

interface PushMessage {
  to:    string;
  title: string;
  body:  string;
  sound: 'default';
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // service_role direto (cron/automação) pula o check de admin
  const bearer = authHeader.replace('Bearer ', '');
  if (bearer !== serviceKey) {
    const { data: { user } } = await supabase.auth.getUser(bearer);
    if (!user) return json(401, { error: 'Invalid token' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();
    if (profile?.user_type !== 'admin') return json(403, { error: 'Forbidden — admin only' });
  }

  let payload: { professionalId?: string; title?: string; body?: string; data?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { professionalId, title, body, data } = payload;
  if (!title || !body) return json(400, { error: 'title e body são obrigatórios' });

  let query = supabase.from('push_tokens').select('token');
  if (professionalId) query = query.eq('professional_id', professionalId);
  const { data: rows, error } = await query;
  if (error) return json(500, { error: error.message });
  if (!rows || rows.length === 0) return json(200, { sent: 0, detail: 'nenhum token registrado' });

  const messages: PushMessage[] = rows.map((r) => ({
    to: r.token, title, body, sound: 'default', data,
  }));

  let sent = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) continue;
    const result = await res.json() as { data?: { status: string; details?: { error?: string } }[] };
    result.data?.forEach((ticket, idx) => {
      if (ticket.status === 'ok') sent++;
      else if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(chunk[idx].to);
    });
  }

  // limpa tokens mortos (device desinstalou / revogou)
  if (invalidTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', invalidTokens);
  }

  return json(200, { sent, total: messages.length, removed: invalidTokens.length });
});
