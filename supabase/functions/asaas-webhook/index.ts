/**
 * Edge Function: asaas-webhook
 * Recebe notificações de pagamento do Asaas e atualiza o banco.
 * Validação: header `asaas-access-token` deve bater com ASAAS_WEBHOOK_TOKEN.
 *
 * Promoções: ao confirmar o pagamento de um plano ou de um pacote de horas, chama
 * apply_promotions (origem 'asaas', origem_ref = id do pagamento). É idempotente
 * por pagamento: o Asaas manda PAYMENT_CONFIRMED e depois PAYMENT_RECEIVED para o
 * mesmo pagamento, e a promoção só rende uma vez.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Concede as horas das promoções ativas que casam com o produto pago.
 *  Nunca derruba o webhook: a ativação do que foi pago já aconteceu. */
async function aplicarPromocoes(
  supabase:       ReturnType<typeof createClient>,
  professionalId: string,
  aplicaA:        'plano' | 'pacote_horas',
  planId:         string | null,
  ciclo:          string | null,
  packageId:      string | null,
  paymentId:      string,
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('apply_promotions', {
      p_professional_id: professionalId,
      p_aplica_a:        aplicaA,
      p_plan_id:         planId,
      p_ciclo:           ciclo,
      p_package_id:      packageId,
      p_origem:          'asaas',
      p_origem_ref:      paymentId,
    });
    if (error) {
      console.error(`[webhook] promoções: erro ao aplicar (pagamento ${paymentId}):`, error.message);
      return;
    }
    if (Number(data) > 0) {
      console.log(`[webhook] promoções: +${data} min para ${professionalId} (pagamento ${paymentId})`);
    }
  } catch (err) {
    console.error(`[webhook] promoções: exceção (pagamento ${paymentId}):`, err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response('ok', { status: 200 });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = req.headers.get('asaas-access-token');
  if (token !== Deno.env.get('ASAAS_WEBHOOK_TOKEN')) {
    console.warn('asaas-webhook: token inválido');
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const event   = body.event   as string | undefined;
  const payment = body.payment as Record<string, unknown> | undefined;

  if (!event || !CONFIRMED_EVENTS.has(event) || !payment?.id) {
    return new Response('ok', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const paymentId      = payment.id           as string;
  const subscriptionId = payment.subscription as string | undefined;

  // ── Confirma resgate de cupom + incrementa uso ──────────────────────
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

  // ── Assinatura de plano ─────────────────────────────────────────
  if (subscriptionId) {
    const hashKey = await sha256hex(subscriptionId);

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, professional_id, plan_id, ciclo')
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
        supabase.from('subscriptions').update({ status: 'active' }).eq('id', sub.id),
        supabase.from('profiles').update({
          pre_paid_ok: true,
          plan_id:     sub.plan_id,
          plan:        plan?.name ?? 'BASE',
        }).eq('id', sub.professional_id),
        supabase.from('admin_notifications').insert({
          type:            'plan_activated',
          professional_id: sub.professional_id,
          title:           `Plano ativado: ${plan?.name ?? 'BASE'}`,
          body:            `${profile?.nome ?? 'Profissional'} ativou o plano ${plan?.name ?? 'BASE'}`,
          metadata:        { plan: plan?.name, subscription_id: sub.id, payment_id: paymentId },
        }),
      ]);

      await aplicarPromocoes(supabase, sub.professional_id, 'plano', sub.plan_id, sub.ciclo, null, paymentId);

      console.log(`[webhook] assinatura ${sub.id} ativada — profissional ${sub.professional_id}`);
      return new Response('ok', { status: 200 });
    }
  }

  // ── Compra de pacote de horas ───────────────────────────────────
  const externalRef = payment.externalReference as string | undefined;

  if (externalRef?.startsWith('hour_package::')) {
    const parts     = externalRef.split('::');
    const userId    = parts[1];
    const packageId = parts[2];

    if (userId && packageId) {
      // 🐛 Corrigido em 07/ago: `bonus_horas` existia na tabela mas NÃO era lido
      // aqui — o saldo creditado saía sem o bônus. Comprovado em produção: a
      // única compra real de Starter 10h creditou 600 min em vez de 660.
      // O bônus era anunciado no material comercial e nunca entregue.
      const { data: pkg } = await supabase
        .from('hour_packages')
        .select('horas, bonus_horas, validade_dias')
        .eq('id', packageId)
        .maybeSingle();

      if (pkg) {
        // O Asaas manda PAYMENT_CONFIRMED e depois PAYMENT_RECEIVED para o mesmo
        // cartão (a 2ª, dias depois). Sem esta checagem o pacote era creditado
        // duas vezes: hour_balance não tem restrição única por asaas_charge_id.
        const { data: jaCreditado } = await supabase
          .from('hour_balance')
          .select('id')
          .eq('asaas_charge_id', paymentId)
          .limit(1);

        if (jaCreditado && jaCreditado.length > 0) {
          console.log(`[webhook] pacote do pagamento ${paymentId} já creditado — evento ${event} ignorado`);
          await aplicarPromocoes(supabase, userId, 'pacote_horas', null, null, packageId, paymentId);
          return new Response('ok', { status: 200 });
        }

        const expiraEm = new Date();
        expiraEm.setDate(expiraEm.getDate() + (pkg.validade_dias ?? 365));

        const horasPagas = Number(pkg.horas);
        const horasBonus = Number(pkg.bonus_horas ?? 0);
        const horasTotal = horasPagas + horasBonus;

        await Promise.all([
          supabase.from('hour_balance').insert({
            professional_id: userId,
            package_id:      packageId,
            minutos_total:   Math.round(horasTotal * 60),
            minutos_usados:  0,
            expira_em:       expiraEm.toISOString(),
            asaas_charge_id: paymentId,
          }),
          supabase.from('admin_notifications').insert({
            type:            'hour_package_activated',
            professional_id: userId,
            title:           `Pacote de horas ativado: ${horasTotal}h`,
            body:            horasBonus > 0
              ? `Pacote de ${horasPagas}h + ${horasBonus}h de bônus ativado via pagamento confirmado`
              : `Pacote de ${horasPagas}h ativado via pagamento confirmado`,
            metadata:        { package_id: packageId, payment_id: paymentId, horas: horasPagas, bonus: horasBonus, total: horasTotal },
          }),
        ]);

        await aplicarPromocoes(supabase, userId, 'pacote_horas', null, null, packageId, paymentId);

        console.log(`[webhook] pacote ${packageId} ativado — profissional ${userId} — ${horasPagas}h + ${horasBonus}h bônus`);
        return new Response('ok', { status: 200 });
      }
    }
  }

  // ── Compra avulsa de módulo ─────────────────────────────────────
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
      supabase.from('user_modules').update({
        status:       'active',
        activated_at: new Date().toISOString(),
      }).eq('id', userModule.id),
      supabase.from('admin_notifications').insert({
        type:            'module_activated',
        professional_id: userModule.professional_id,
        title:           `Módulo ativado: ${module?.nome ?? 'Módulo'}`,
        body:            `${profile?.nome ?? 'Profissional'} ativou ${module?.nome ?? 'módulo'} via pagamento confirmado`,
        metadata:        { module_id: userModule.module_id, payment_id: paymentId },
      }),
    ]);

    console.log(`[webhook] módulo ${userModule.id} ativado — profissional ${userModule.professional_id}`);
    return new Response('ok', { status: 200 });
  }

  console.warn(`[webhook] pagamento ${paymentId} não encontrado (externalRef: ${externalRef ?? 'none'})`);
  return new Response('ok', { status: 200 });
});
