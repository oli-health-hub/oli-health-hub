/**
 * Edge Function: create-charge
 *
 * Cria uma cobrança avulsa no Asaas para compra de módulo.
 * Chamado pelo app quando o médico toca em "Contratar" em um módulo.
 *
 * Body: { moduleSlug: string, billingType?: 'PIX' | 'BOLETO_BANCARIO', cpfCnpj?: string }
 *
 * Retorno:
 *   - chargeId, status, invoiceUrl
 *   - pixQrCode + pixCopiaECola (se billingType === 'PIX')
 *   - bankSlipUrl (se billingType === 'BOLETO_BANCARIO')
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
      moduleSlug,
      billingType = 'CREDIT_CARD',
      cpfCnpj,
    } = await req.json() as {
      moduleSlug:   string;
      billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO_BANCARIO';
      cpfCnpj?:     string;
    };

    if (!moduleSlug) return json({ error: 'moduleSlug obrigatório' }, 400);

    // ── 3. Busca perfil e módulo em paralelo ─────────────────────────────────
    const [{ data: profile }, { data: module }] = await Promise.all([
      supabaseAdmin.from('profiles').select('nome').eq('id', user.id).single(),
      supabaseAdmin.from('modules').select('id, nome, valor').eq('slug', moduleSlug).single(),
    ]);

    if (!profile) return json({ error: 'Perfil não encontrado' },  404);
    if (!module)  return json({ error: 'Módulo não encontrado' },   404);

    // ── 4. Cliente Asaas (cria se não existe) ────────────────────────────────
    const customerId = await findOrCreateCustomer(user.id, profile.nome, user.email!, cpfCnpj);

    // ── 5. Cobrança Asaas ────────────────────────────────────────────────────
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // vence em 3 dias
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const chargeRes = await fetch(`${asaasBase()}/payments`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer:          customerId,
        billingType,
        value:             module.valor,
        dueDate:           dueDateStr,
        description:       `OLI Health Hub — ${module.nome}`,
        externalReference: `module::${user.id}::${module.id}`,
      }),
    });
    const charge = await chargeRes.json();
    if (!charge.id) throw new Error(`Asaas: falha na cobrança — ${JSON.stringify(charge)}`);

    // ── 6. Registra user_modules com status pending_payment ──────────────────
    // Upsert: se já existe (tentativa anterior), atualiza o asaas_id
    const { data: existing } = await supabaseAdmin
      .from('user_modules')
      .select('id')
      .eq('professional_id', user.id)
      .eq('module_id', module.id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('user_modules')
        .update({ status: 'pending_payment', asaas_id_plain: charge.id })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin.from('user_modules').insert({
        professional_id: user.id,
        module_id:       module.id,
        status:          'pending_payment',
        asaas_id_plain:  charge.id,
        config:          {},
      });
    }

    // ── 7. QR Code PIX (se aplicável) ────────────────────────────────────────
    const pix = billingType === 'PIX' ? await getPixQrCode(charge.id) : null;

    return json({
      chargeId:      charge.id,
      status:        charge.status,
      invoiceUrl:    charge.invoiceUrl,
      billingType:   charge.billingType,
      value:         charge.value,
      dueDate:       charge.dueDate,
      bankSlipUrl:   charge.bankSlipUrl  ?? null,
      pixQrCode:     pix?.pixQrCode      ?? null,
      pixCopiaECola: pix?.pixCopiaECola  ?? null,
    });

  } catch (err) {
    console.error('create-charge error:', err);
    return json({ error: 'Erro interno. Tente novamente.' }, 500);
  }
});
