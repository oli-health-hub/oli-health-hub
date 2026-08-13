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
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);

/** SHA-256 hex — usado para lookup de subscription sem expor asaas_id_plain */
async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  // Asaas envia GET para validar o endpoint na configuração do webhook
  if (req.method === 'GET') {
    return new Response('ok', { status: 200 });
  }

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
  const subscriptionId = payment.subscription as string | undefined;

  // ── 2b. Confirma resgate de cupom + incrementa uso ───────────────────────
  // O resgate é gravado como 'pending' na criação da cobrança/assinatura,
  // referenciado por asaas_id (paymentId p/ módulo/pacote, subscriptionId p/ plano).
  {
    const refs = [paymentId, subscriptionId].filter(Boolean) as string[];
    const { data: redemption } = await supabase
      .from('coupon_redemptions')
      .select('id, coupon_id')
      .in('asaas_id', refs)
      .eq('status', 'pending')
      .maybeSingle();

    if (redemption) {
      await supabase.from('coupon_redemptions').update({ status: 'confirmed' }).eq('id', redemption.id);
      const { data: c } = await supabase.from('coupons').select('usos').eq('id', redemption.coupon_id).single();
      await supabase.from('coupons').update({ usos: (c?.usos ?? 0) + 1 }).eq('id', redemption.coupon_id);
      console.log(`[webhook] cupom resgate ${redemption.id} confirmado`);
    }
  }

  // ── 3. Assinatura de plano ────────────────────────────────────────────────
  if (subscriptionId) {
    const hashKey = await sha256hex(subscriptionId);

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, professional_id, plan_id')
      .eq('asaas_id_hash', hashKey)
      .maybeSingle();

    if (sub) {
      const { data: plan } = await supabase
        .from('plans')
        .select('name')
        .eq('id', sub.plan_id)
        .single();

      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', sub.professional_id)
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
            plan:        plan?.name ?? 'BASE',
          })
          .eq('id', sub.professional_id),

        supabase.from('admin_notifications').insert({
          type:            'plan_activated',
          professional_id: sub.professional_id,
          title:           `Plano ativado: ${plan?.name ?? 'BASE'}`,
          body:            `${profile?.nome ?? 'Médico'} ativou o plano ${plan?.name ?? 'BASE'}`,
          metadata:        { plan: plan?.name, subscription_id: sub.id, payment_id: paymentId },
        }),
      ]);

      console.log(`[webhook] assinatura ${sub.id} ativada — profissional ${sub.professional_id}`);
      return new Response('ok', { status: 200 });
    }
  }

  // ── 4. Compra de pacote de horas ─────────────────────────────────────────
  const externalRef = payment.externalReference as string | undefined;

  if (externalRef?.startsWith('hour_package::')) {
    const parts     = externalRef.split('::');
    const userId    = parts[1];
    const packageId = parts[2];

    if (userId && packageId) {
      const { data: pkg } = await supabase
        .from('hour_packages')
        .select('horas, bonus_horas, validade_dias')
        .eq('id', packageId)
        .maybeSingle();

      if (pkg) {
        const expiraEm = new Date();
        expiraEm.setDate(expiraEm.getDate() + (pkg.validade_dias ?? 365));
        const horasTotais = pkg.horas + (pkg.bonus_horas ?? 0);

        await Promise.all([
          supabase.from('hour_balance').insert({
            professional_id: userId,
            package_id:      packageId,
            minutos_total:   horasTotais * 60,
            minutos_usados:  0,
            expira_em:       expiraEm.toISOString(),
            asaas_charge_id: paymentId,
          }),

          supabase.from('admin_notifications').insert({
            type:            'hour_package_activated',
            professional_id: userId,
            title:           `Pacote de horas ativado: ${horasTotais}h`,
            body:            `Pacote de ${pkg.horas}h + ${pkg.bonus_horas ?? 0}h bônus ativado via pagamento confirmado`,
            metadata:        { package_id: packageId, payment_id: paymentId, horas: pkg.horas, bonus_horas: pkg.bonus_horas ?? 0 },
          }),
        ]);

        console.log(`[webhook] pacote ${packageId} ativado — profissional ${userId} — ${horasTotais}h (${pkg.horas}h + ${pkg.bonus_horas ?? 0}h bônus)`);
        return new Response('ok', { status: 200 });
      }
    }
  }

  // ── 5. Compra avulsa de módulo ────────────────────────────────────────────
  const { data: userModule } = await supabase
    .from('user_modules')
    .select('id, professional_id, module_id')
    .eq('asaas_id_plain', paymentId)
    .maybeSingle();

  if (userModule) {
    const { data: module } = await supabase
      .from('modules')
      .select('nome')
      .eq('id', userModule.module_id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', userModule.professional_id)
      .single();

    await Promise.all([
      supabase
        .from('user_modules')
        .update({
          status:       'active',
          activated_at: new Date().toISOString(),
        })
        .eq('id', userModule.id),

      supabase.from('admin_notifications').insert({
        type:            'module_activated',
        professional_id: userModule.professional_id,
        title:           `Módulo ativado: ${module?.nome ?? 'Módulo'}`,
        body:            `${profile?.nome ?? 'Médico'} ativou ${module?.nome ?? 'módulo'} via pagamento confirmado`,
        metadata:        { module_id: userModule.module_id, payment_id: paymentId },
      }),
    ]);

    console.log(`[webhook] módulo ${userModule.id} ativado — profissional ${userModule.professional_id}`);
    return new Response('ok', { status: 200 });
  }

  console.warn(`[webhook] pagamento ${paymentId} não encontrado (externalRef: ${externalRef ?? 'none'})`);
  return new Response('ok', { status: 200 });
});
