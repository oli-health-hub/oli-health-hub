/**
 * Edge Function: create-hour-package (BUNDLED — para deploy via editor Supabase)
 *
 * Cria cobrança avulsa no Asaas para compra de pacote de horas.
 * Body: { hours: number, billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO_BANCARIO', cpfCnpj?: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

// ─── Shared Asaas utils (inlined) ───────────────────────────────────────────

function asaasBase(): string {
  return Deno.env.get('ASAAS_ENV') === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

function asaasHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'access_token': Deno.env.get('ASAAS_API_KEY')!,
    'User-Agent':   'OLIHealthHub/1.0',
  };
}

async function findOrCreateCustomer(
  professionalId: string, name: string, email: string, cpfCnpj?: string,
): Promise<string> {
  const base    = asaasBase();
  const headers = asaasHeaders();
  const searchRes  = await fetch(`${base}/customers?externalReference=${professionalId}&limit=1`, { headers });
  const searchData = await searchRes.json();
  if (searchData.data?.length > 0) return searchData.data[0].id as string;
  const body: Record<string, string> = { name, email, externalReference: professionalId };
  if (cpfCnpj) body.cpfCnpj = cpfCnpj;
  const createRes = await fetch(`${base}/customers`, { method: 'POST', headers, body: JSON.stringify(body) });
  const customer  = await createRes.json();
  if (!customer.id) throw new Error(`Asaas: falha ao criar cliente — ${JSON.stringify(customer)}`);
  return customer.id as string;
}

async function getPixQrCode(paymentId: string): Promise<{ pixQrCode: string; pixCopiaECola: string } | null> {
  const res  = await fetch(`${asaasBase()}/payments/${paymentId}/pixQrCode`, { headers: asaasHeaders() });
  const data = await res.json();
  if (!data.encodedImage) return null;
  return { pixQrCode: data.encodedImage as string, pixCopiaECola: data.payload as string };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
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

    const { hours, billingType = 'CREDIT_CARD', cpfCnpj } = await req.json() as {
      hours: number; billingType?: string; cpfCnpj?: string;
    };
    if (!hours || hours < 1) return json({ error: 'hours deve ser >= 1' }, 400);

    const [{ data: profile }, { data: pkg }] = await Promise.all([
      supabaseAdmin.from('profiles').select('nome').eq('id', user.id).single(),
      supabaseAdmin.from('hour_packages')
        .select('id, nome, horas, valor, validade_dias')
        .eq('horas', hours).eq('ativo', true).maybeSingle(),
    ]);

    if (!profile) return json({ error: 'Perfil não encontrado' }, 404);
    if (!pkg)     return json({ error: `Pacote de ${hours}h não encontrado` }, 404);

    const customerId = await findOrCreateCustomer(user.id, profile.nome, user.email!, cpfCnpj);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const chargeRes = await fetch(`${asaasBase()}/payments`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer:          customerId,
        billingType,
        value:             pkg.valor,
        dueDate:           dueDateStr,
        description:       `OLI Health Hub — Pacote ${pkg.horas}h`,
        externalReference: `hour_package::${user.id}::${pkg.id}`,
      }),
    });
    const charge = await chargeRes.json();
    if (!charge.id) throw new Error(`Asaas: falha na cobrança — ${JSON.stringify(charge)}`);

    supabaseAdmin.from('admin_notifications').insert({
      type:            'hour_package_purchased',
      professional_id: user.id,
      title:           `Pacote de horas: ${pkg.horas}h`,
      body:            `${profile.nome} iniciou compra do pacote ${pkg.horas}h via ${billingType}`,
      metadata:        { package_id: pkg.id, charge_id: charge.id, billing_type: billingType, value: pkg.valor },
    }).then(() => {}).catch(() => {});

    const pix = billingType === 'PIX' ? await getPixQrCode(charge.id) : null;

    return json({
      chargeId:      charge.id,
      status:        charge.status,
      invoiceUrl:    charge.invoiceUrl  ?? null,
      billingType:   charge.billingType,
      value:         charge.value,
      dueDate:       charge.dueDate,
      bankSlipUrl:   charge.bankSlipUrl ?? null,
      pixQrCode:     pix?.pixQrCode     ?? null,
      pixCopiaECola: pix?.pixCopiaECola ?? null,
    });

  } catch (err) {
    console.error('create-hour-package error:', err);
    return json({ error: 'Erro interno. Tente novamente.' }, 500);
  }
});
