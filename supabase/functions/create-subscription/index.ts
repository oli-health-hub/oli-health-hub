/**
 * Edge Function: create-subscription
 *
 * Cria uma assinatura recorrente no Asaas para contratação de plano BASE/PRO/VIP.
 * Chamado pelo app quando o médico confirma um plano no fluxo de upgrade.
 *
 * Body: { planId: string, ciclo: 'MONTHLY' | 'SEMESTRAL' | 'YEARLY', billingType?: 'PIX' | 'BOLETO_BANCARIO', cpfCnpj?: string }
 *
 * ciclo 'SEMESTRAL': cobrança MENSAL (R$/mês) com fidelidade de 6 meses —
 * não é cobrança semestral à vista. O `cycle` enviado à Asaas é sempre
 * 'MONTHLY' nesse caso; `fidelidade_ate` é gravado só pra rastreio interno,
 * sem bloqueio automático de cancelamento.
 *
 * Retorno:
 *   - subscriptionId (Asaas), status, value
 *   - pixQrCode + pixCopiaECola OU bankSlipUrl para o primeiro pagamento
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { findOrCreateCustomer, asaasBase, asaasHeaders, getPixQrCode } from '../_shared/asaas.ts';
import { validateCoupon, recordRedemption, type CouponResult } from '../_shared/coupon.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── 2. Body ──────────────────────────────────────────────────────────────
    const {
      planId,
      ciclo       = 'MONTHLY',
      billingType = 'CREDIT_CARD',
      cpfCnpj,
      couponCode,
    } = await req.json() as {
      planId:       string;
      ciclo?:       'MONTHLY' | 'SEMESTRAL' | 'YEARLY';
      billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO_BANCARIO';
      cpfCnpj?:     string;
      couponCode?:  string;
    };

    if (!planId) return json({ error: 'planId obrigatório' }, 400);

    // ── 3. Busca perfil e plano em paralelo ──────────────────────────────────
    const [{ data: profile }, { data: plan }] = await Promise.all([
      supabaseAdmin.from('profiles').select('nome').eq('id', user.id).single(),
      supabaseAdmin.from('plans').select('id, name, preco_mensal, preco_semestral, preco_anual').eq('id', planId).eq('ativo', true).single(),
    ]);

    if (!profile) return json({ error: 'Perfil não encontrado' }, 404);
    if (!plan)    return json({ error: 'Plano não encontrado ou inativo' }, 404);

    const value = ciclo === 'YEARLY' ? plan.preco_anual
      : ciclo === 'SEMESTRAL' ? plan.preco_semestral
      : plan.preco_mensal;
    if (value == null) return json({ error: `Plano ${plan.name} não oferece ciclo ${ciclo}` }, 400);

    // ── 3b. Cupom (opcional) ─────────────────────────────────────────────────
    // planoRecorrente: desconto em todas as faturas (subscription.value menor).
    // Caso contrário: desconto só na 1ª fatura (ajusta o primeiro payment).
    let coupon: CouponResult | null = null;
    let subValue = value;            // valor da assinatura (recorrente)
    if (couponCode) {
      coupon = await validateCoupon(supabaseAdmin, couponCode, 'plano', value, user.id);
      if (!coupon.valid) return json({ error: coupon.error }, 400);
      if (coupon.planoRecorrente) subValue = coupon.valorFinal!;
    }

    // ── 4. Cliente Asaas ─────────────────────────────────────────────────────
    const customerId = await findOrCreateCustomer(user.id, profile.nome, user.email!, cpfCnpj);

    // ── 5. Assinatura Asaas ──────────────────────────────────────────────────
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    // Asaas não tem ciclo "semestral cobrado mensalmente" — semestral é
    // cobrança MONTHLY na Asaas, com fidelidade rastreada só no nosso banco.
    const asaasCycle = ciclo === 'YEARLY' ? 'YEARLY' : 'MONTHLY';

    const subRes = await fetch(`${asaasBase()}/subscriptions`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer:          customerId,
        billingType,
        value:             subValue,
        nextDueDate:       nextDueDateStr,
        cycle:             asaasCycle,
        description:       `OLI Health Hub — Plano ${plan.name} (${ciclo === 'YEARLY' ? 'Anual' : ciclo === 'SEMESTRAL' ? 'Semestral' : 'Mensal'})`,
        externalReference: `subscription::${user.id}::${planId}::${ciclo}`,
      }),
    });
    const subscription = await subRes.json();
    if (!subscription.id) throw new Error(`Asaas: falha na assinatura — ${JSON.stringify(subscription)}`);

    // ── 6. Registra em subscriptions com status pending ──────────────────────
    // ciclo/status gravados nos valores em português aceitos pelo CHECK do banco
    // (subscriptions_ciclo_check / subscriptions_status_check) — não os valores
    // em inglês que vêm do app/Asaas.
    const cicloDb: 'mensal' | 'semestral' | 'anual' =
      ciclo === 'YEARLY' ? 'anual' : ciclo === 'SEMESTRAL' ? 'semestral' : 'mensal';
    const endsAt = ciclo === 'YEARLY'
      ? new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() +  31 * 24 * 60 * 60 * 1000).toISOString();
    const fidelidadeAte = ciclo === 'SEMESTRAL'
      ? new Date(Date.now() + 183 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    // Hash do ID Asaas para lookup no webhook (trigger zera asaas_id_plain)
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.id));
    const asaasIdHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: newSub, error: insertSubError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        professional_id: user.id,
        plan_id:         planId,
        ciclo:           cicloDb,
        status:          'pending',
        starts_at:       new Date().toISOString(),
        ends_at:         endsAt,
        fidelidade_ate:  fidelidadeAte,
        asaas_id_plain:  subscription.id,
        asaas_id_hash:   asaasIdHash,
      })
      .select('id')
      .single();
    if (insertSubError) {
      console.error('create-subscription: falha ao registrar subscription', insertSubError);
      throw new Error('Falha ao registrar assinatura no banco. A cobrança na Asaas foi criada — contate o suporte.');
    }

    // Notificação admin: plano contratado
    supabaseAdmin.from('admin_notifications').insert({
      type:            'plan_subscribed',
      professional_id: user.id,
      title:           `Plano contratado: ${plan.name}`,
      body:            `${profile.nome} contratou o plano ${plan.name} (${ciclo === 'YEARLY' ? 'Anual' : ciclo === 'SEMESTRAL' ? 'Semestral' : 'Mensal'}) via ${billingType}`,
      metadata:        { plan_id: planId, plan_name: plan.name, ciclo, billing_type: billingType, value },
    }).then(() => {}).catch(() => {}); // fire-and-forget

    // ── 7. Primeiro pagamento (para exibir PIX/boleto no app) ────────────────
    const paymentsRes  = await fetch(
      `${asaasBase()}/subscriptions/${subscription.id}/payments?limit=1`,
      { headers: asaasHeaders() },
    );
    const paymentsData = await paymentsRes.json();
    const firstPayment = paymentsData.data?.[0] as Record<string, unknown> | undefined;

    // Cupom não-recorrente: aplica o desconto só na 1ª fatura.
    if (coupon?.valid && !coupon.planoRecorrente && firstPayment?.id) {
      await fetch(`${asaasBase()}/payments/${firstPayment.id}`, {
        method: 'PUT',
        headers: asaasHeaders(),
        body: JSON.stringify({ value: coupon.valorFinal }),
      });
      firstPayment.value = coupon.valorFinal;
    }

    // Registra resgate do cupom (confirmado no webhook ao pagamento)
    if (coupon?.valid) {
      await recordRedemption(supabaseAdmin, {
        couponId:       coupon.couponId!,
        professionalId: user.id,
        targetType:     'plano',
        targetRef:      planId,
        baseValue:      value,
        desconto:       coupon.desconto!,
        valorFinal:     coupon.valorFinal!,
        asaasId:        subscription.id as string,
      });
    }

    // QR Code só depois de eventual ajuste de valor (o QR codifica o valor).
    const pix = (billingType === 'PIX' && firstPayment?.id)
      ? await getPixQrCode(firstPayment.id as string)
      : null;

    return json({
      subscriptionId: subscription.id,
      supabaseSubId:  newSub?.id  ?? null,
      status:         'pending_payment',
      ciclo,
      value:          subValue,
      valorOriginal:  value,
      desconto:       coupon?.desconto ?? 0,
      planoRecorrente: coupon?.planoRecorrente ?? false,
      dueDate:        firstPayment?.dueDate    ?? nextDueDateStr,
      invoiceUrl:     firstPayment?.invoiceUrl ?? null,
      bankSlipUrl:    firstPayment?.bankSlipUrl ?? null,
      pixQrCode:      pix?.pixQrCode           ?? null,
      pixCopiaECola:  pix?.pixCopiaECola       ?? null,
    });

  } catch (err) {
    console.error('create-subscription error:', err);
    return json({ error: 'Erro interno. Tente novamente.' }, 500);
  }
});
