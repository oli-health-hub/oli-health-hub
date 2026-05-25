/**
 * Edge Function: create-subscription
 *
 * Cria uma assinatura recorrente no Asaas para contratação de plano BASE/PRO/VIP.
 * Chamado pelo app quando o médico confirma um plano no fluxo de upgrade.
 *
 * Body: { planId: string, ciclo: 'MONTHLY' | 'YEARLY', billingType?: 'PIX' | 'BOLETO_BANCARIO', cpfCnpj?: string }
 *
 * Retorno:
 *   - subscriptionId (Asaas), status, value
 *   - pixQrCode + pixCopiaECola OU bankSlipUrl para o primeiro pagamento
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { findOrCreateCustomer, asaasBase, asaasHeaders, getPixQrCode } from '../_shared/asaas.ts';

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
    } = await req.json() as {
      planId:       string;
      ciclo?:       'MONTHLY' | 'YEARLY';
      billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO_BANCARIO';
      cpfCnpj?:     string;
    };

    if (!planId) return json({ error: 'planId obrigatório' }, 400);

    // ── 3. Busca perfil e plano em paralelo ──────────────────────────────────
    const [{ data: profile }, { data: plan }] = await Promise.all([
      supabaseAdmin.from('profiles').select('nome').eq('id', user.id).single(),
      supabaseAdmin.from('plans').select('id, name, preco_mensal, preco_anual').eq('id', planId).eq('ativo', true).single(),
    ]);

    if (!profile) return json({ error: 'Perfil não encontrado' }, 404);
    if (!plan)    return json({ error: 'Plano não encontrado ou inativo' }, 404);

    const value = ciclo === 'YEARLY' ? plan.preco_anual : plan.preco_mensal;

    // ── 4. Cliente Asaas ─────────────────────────────────────────────────────
    const customerId = await findOrCreateCustomer(user.id, profile.nome, user.email!, cpfCnpj);

    // ── 5. Assinatura Asaas ──────────────────────────────────────────────────
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    const subRes = await fetch(`${asaasBase()}/subscriptions`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer:          customerId,
        billingType,
        value,
        nextDueDate:       nextDueDateStr,
        cycle:             ciclo,           // 'MONTHLY' | 'YEARLY' — Asaas aceita direto
        description:       `OLI Health Hub — Plano ${plan.name} (${ciclo === 'YEARLY' ? 'Anual' : 'Mensal'})`,
        externalReference: `subscription::${user.id}::${planId}::${ciclo}`,
      }),
    });
    const subscription = await subRes.json();
    if (!subscription.id) throw new Error(`Asaas: falha na assinatura — ${JSON.stringify(subscription)}`);

    // ── 6. Registra em subscriptions com status pending_payment ──────────────
    const endsAt = ciclo === 'YEARLY'
      ? new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() +  31 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newSub } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        professional_id: user.id,
        plan_id:         planId,
        ciclo,
        status:          'pending_payment',
        starts_at:       new Date().toISOString(),
        ends_at:         endsAt,
        asaas_id_plain:  subscription.id,
      })
      .select('id')
      .single();

    // ── 7. Primeiro pagamento (para exibir PIX/boleto no app) ────────────────
    const paymentsRes  = await fetch(
      `${asaasBase()}/subscriptions/${subscription.id}/payments?limit=1`,
      { headers: asaasHeaders() },
    );
    const paymentsData = await paymentsRes.json();
    const firstPayment = paymentsData.data?.[0] as Record<string, unknown> | undefined;

    const pix = (billingType === 'PIX' && firstPayment?.id)
      ? await getPixQrCode(firstPayment.id as string)
      : null;

    return json({
      subscriptionId: subscription.id,
      supabaseSubId:  newSub?.id  ?? null,
      status:         'pending_payment',
      ciclo,
      value,
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
