/**
 * Edge Function: notify-signup
 *
 * Chamada via Supabase Database Webhook sempre que um novo registro
 * é inserido na tabela `profiles`. Insere uma notificação admin
 * do tipo `new_signup` para o time OLI acompanhar em tempo real.
 *
 * Configuração do webhook (Supabase Dashboard → Database → Webhooks):
 *   Table:  profiles
 *   Events: INSERT
 *   URL:    <supabase_url>/functions/v1/notify-signup
 *   Header: x-webhook-secret: <DB_WEBHOOK_SECRET>
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── 1. Valida secret ─────────────────────────────────────────────────────
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== Deno.env.get('DB_WEBHOOK_SECRET')) {
    console.warn('notify-signup: secret inválido');
    return new Response('Unauthorized', { status: 401 });
  }

  // ── 2. Parse body (formato Supabase DB Webhook) ───────────────────────────
  let body: { type: string; record: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Só processa INSERT
  if (body.type !== 'INSERT') {
    return new Response('ok', { status: 200 });
  }

  const record = body.record;
  const professionalId = record.id as string | undefined;
  if (!professionalId) {
    return new Response('ok', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── 3. Busca e-mail do auth.users ─────────────────────────────────────────
  const { data: authUser } = await supabase.auth.admin.getUserById(professionalId);
  const email = authUser?.user?.email ?? null;

  const nome         = (record.nome          as string | null) ?? 'Sem nome';
  const crm          = (record.crm           as string | null) ?? null;
  const especialidade = (record.especialidade as string | null) ?? null;
  const plan         = (record.plan          as string | null) ?? 'BASE';

  const bodyText = [
    crm          ? `CRM ${crm}`          : null,
    especialidade                         ? especialidade : null,
    email                                 ? email         : null,
    `Plano ${plan}`,
  ].filter(Boolean).join(' · ');

  // ── 4. Insere notificação ─────────────────────────────────────────────────
  const { error } = await supabase.from('admin_notifications').insert({
    type:            'new_signup',
    professional_id: professionalId,
    title:           `Novo médico: ${nome}`,
    body:            bodyText,
    metadata:        { email, crm, especialidade, plan },
  });

  if (error) {
    console.error('notify-signup: erro ao inserir notificação', error);
    return new Response('Internal error', { status: 500 });
  }

  console.log(`[notify-signup] novo profissional ${professionalId} — ${nome}`);
  return new Response('ok', { status: 200 });
});
