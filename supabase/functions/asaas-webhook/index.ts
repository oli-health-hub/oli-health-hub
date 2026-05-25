/**
 * Edge Function: asaas-webhook
 *
 * Recebe notificações de pagamento do Asaas e atualiza o banco.
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED / PAYMENT_RECEIVED
 *     → assinatura de plano  → ativa subscriptions + profiles.pre_paid_ok
 *     → compra de módulo     → ativa user_modules
 *
 * Validação: header `asaas-access-token` deve bater com ASAAS_WEBHOOK_TOKEN.
 *
 * NÃO tem CORS — só o Asaas chama este endpoint, não o app.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── 1. Valida token ──────────────────────────────────────────────────────
  const token = req.headers.get('asaas-access-token');
  if (token !== Deno.env.get('ASAAS_WEBHOOK_TOKEN')) {
    console.warn('asaas-webhook: token inválido');
    return new Response('Unauthorized', { status: 401 });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const event   = body.event   as string | undefined;
  const payment = body.payment as Record<string, unknown> | undefined;

  // Ignora eventos que não são de pagamento confirmado
  if (!event || !CONFIRMED_EVENTS.has(event) || !payment?.id) {
    return new Response('ok', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const paymentId      = payment.id           as string;
  const subscriptionId = payment.subscription as string | undefined; // presente em cobranças recorrentes

  // ── 3. Assinatura de plano ────────────────────────────────────────────────
  // Na cobrança recorrente, payment.subscription = ID da assinatura no Asaas
  if (subscriptionId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, professional_id, plan_id')
      .eq('asaas_id_plain', subscriptionId)
      .maybeSingle();

    if (sub) {
      // Busca o nome do plano para atualizar profiles.plan
      const { data: plan } = await supabase
        .from('plans')
        .select('name')
        .eq('id', sub.plan_id)
        .single();

      await Promise.all([
        supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('id', sub.id),

        supabase
          .from('profiles')
          .update({
            pre_paid_ok: true,
            plan_id:     sub.plan_id,
            plan:        plan?.name ?? 'BASE',   // ex: 'BASE', 'PRO', 'VIP'
          })
          .eq('id', sub.professional_id),
      ]);

      console.log(`[webhook] assinatura ${sub.id} ativada — profissional ${sub.professional_id}`);
      return new Response('ok', { status: 200 });
    }
  }

  // ── 4. Compra avulsa de módulo ────────────────────────────────────────────
  // Cobrança única: payment.id = ID do pagamento no Asaas
  const { data: userModule } = await supabase
    .from('user_modules')
    .select('id, professional_id')
    .eq('asaas_id_plain', paymentId)
    .maybeSingle();

  if (userModule) {
    await supabase
      .from('user_modules')
      .update({
        status:       'active',
        activated_at: new Date().toISOString(),
      })
      .eq('id', userModule.id);

    console.log(`[webhook] módulo ${userModule.id} ativado — profissional ${userModule.professional_id}`);
    return new Response('ok', { status: 200 });
  }

  // Pagamento não reconhecido — loga mas responde 200 para Asaas não retentar
  console.warn(`[webhook] pagamento ${paymentId} não encontrado nas tabelas`);
  return new Response('ok', { status: 200 });
});
