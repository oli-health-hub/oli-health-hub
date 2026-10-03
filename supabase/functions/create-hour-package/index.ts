/**
 * Edge Function: create-hour-package
 *
 * Cria uma cobrança avulsa no Asaas para compra de pacote de horas.
 *
 * Body: { hours: number, billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO_BANCARIO', cpfCnpj?: string }
 *
 * Retorno:
 *   - chargeId, status, invoiceUrl, value, dueDate
 *   - pixQrCode + pixCopiaECola (se billingType === 'PIX')
 *   - bankSlipUrl (se billingType === 'BOLETO_BANCARIO')
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
      hours,
      billingType = 'CREDIT_CARD',
      cpfCnpj,
      couponCode,
    } = await req.json() as {
      hours:        number;
      billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO_BANCARIO';
      cpfCnpj?:     string;
      couponCode?:  string;
    };

    if (!hours || hours < 1) return json({ error: 'hours deve ser >= 1' }, 400);

    // ── 3. Busca perfil e pacote em paralelo ─────────────────────────────────
    const [{ data: profile }, { data: pkg }] = await Promise.all([
      supabaseAdmin.from('profiles').select('nome, plan, taxa_min_congelada').eq('id', user.id).single(),
      supabaseAdmin
        .from('hour_packages')
        .select('id, nome, horas, validade_dias')
        .eq('horas', hours)
        .eq('ativo', true)
        .maybeSingle(),
    ]);

    if (!profile) return json({ error: 'Perfil não encontrado' }, 404);
    if (!pkg)     return json({ error: `Pacote de ${hours}h não encontrado` }, 404);

    // ── 3b. Preço = taxa/min do plano do médico × 60 ─────────────────────────
    // Prioridade: taxa congelada do perfil (assinante de antes da reforma de
    // 13/ago — não pode ser afetado pela mudança de preço do catálogo) →
    // plans.taxa_min ao vivo → fallback START se o plano não bater com
    // nenhuma linha (ex.: VIP em standby).
    let taxaMin = Number(profile.taxa_min_congelada ?? 0) || null;
    if (!taxaMin) {
      const { data: planRow } = await supabaseAdmin
        .from('plans')
        .select('taxa_min')
        .eq('name', profile.plan ?? 'START')
        .maybeSingle();
      taxaMin = Number(planRow?.taxa_min ?? 1.29);
    }

    // ── 3c. Cupom (opcional) ─────────────────────────────────────────────────
    const baseValue = Math.round(pkg.horas * 60 * taxaMin * 100) / 100;
    let chargeValue = baseValue;
    let coupon: CouponResult | null = null;
    if (couponCode) {
      coupon = await validateCoupon(supabaseAdmin, couponCode, 'pacote', baseValue, user.id);
      if (!coupon.valid) return json({ error: coupon.error }, 400);
      chargeValue = coupon.valorFinal!;
    }

    // ── 4. Cliente Asaas (cria se não existe) ────────────────────────────────
    const customerId = await findOrCreateCustomer(user.id, profile.nome, user.email!, cpfCnpj);

    // ── 5. Cobrança Asaas ────────────────────────────────────────────────────
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const chargeRes = await fetch(`${asaasBase()}/payments`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer:          customerId,
        billingType,
        value:             chargeValue,
        dueDate:           dueDateStr,
        description:       `OLI Health Hub — Pacote ${pkg.horas}h`,
        externalReference: `hour_package::${user.id}::${pkg.id}`,
      }),
    });
    const charge = await chargeRes.json();
    if (!charge.id) throw new Error(`Asaas: falha na cobrança — ${JSON.stringify(charge)}`);

    // Registra resgate do cupom (confirmado no webhook ao pagamento)
    if (coupon?.valid) {
      await recordRedemption(supabaseAdmin, {
        couponId:       coupon.couponId!,
        professionalId: user.id,
        targetType:     'pacote',
        targetRef:      String(hours),
        baseValue,
        desconto:       coupon.desconto!,
        valorFinal:     chargeValue,
        asaasId:        charge.id as string,
      });
    }

    // ── 6. Notificação admin (fire-and-forget) ───────────────────────────────
    supabaseAdmin.from('admin_notifications').insert({
      type:            'hour_package_purchased',
      professional_id: user.id,
      title:           `Pacote de horas: ${pkg.horas}h`,
      body:            `${profile.nome} iniciou compra do pacote ${pkg.horas}h via ${billingType}`,
      metadata:        { package_id: pkg.id, charge_id: charge.id, billing_type: billingType, value: baseValue },
    }).then(() => {}).catch(() => {});

    // ── 7. QR Code PIX (se aplicável) ────────────────────────────────────────
    const pix = billingType === 'PIX' ? await getPixQrCode(charge.id) : null;

    return json({
      chargeId:      charge.id,
      status:        charge.status,
      invoiceUrl:    charge.invoiceUrl    ?? null,
      billingType:   charge.billingType,
      value:         charge.value,
      dueDate:       charge.dueDate,
      bankSlipUrl:   charge.bankSlipUrl   ?? null,
      pixQrCode:     pix?.pixQrCode       ?? null,
      pixCopiaECola: pix?.pixCopiaECola   ?? null,
    });

  } catch (err) {
    console.error('create-hour-package error:', err);
    return json({ error: 'Erro interno. Tente novamente.' }, 500);
  }
});
