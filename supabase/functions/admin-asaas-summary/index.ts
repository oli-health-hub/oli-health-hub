/**
 * Edge Function: admin-asaas-summary
 *
 * Retorna dados financeiros REAIS do Asaas para o dashboard admin:
 *   - balance: saldo disponível na conta Asaas
 *   - mrr: MRR estimado (assinaturas ativas)
 *   - paymentsMonth: total recebido no mês corrente
 *   - paymentsLastMonth: total recebido no mês anterior
 *   - lastPayments: últimos 10 pagamentos confirmados
 *
 * Segurança: requer JWT válido E user_type=admin no profile.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

interface AsaasPayment {
  id:            string;
  value:         number;
  netValue:      number;
  status:        string;
  customer:      string;
  customerName?: string;
  description?:  string;
  paymentDate?:  string;
  confirmedDate?: string;
  externalReference?: string;
  billingType?:  string;
}

function asaasBase(): string {
  return Deno.env.get('ASAAS_ENV') === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

function asaasHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'access_token': Deno.env.get('ASAAS_API_KEY')!,
    'User-Agent':   'OLIHealthHub-Admin/1.0',
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${asaasBase()}${path}`, { headers: asaasHeaders() });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Asaas ${path}: ${res.status} ${txt}`);
  }
  return res.json() as Promise<T>;
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  // ── 1. Valida JWT + role admin ─────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (profile?.user_type !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── 2. Busca dados do Asaas em paralelo ───────────────────────────────────
  try {
    const now           = new Date();
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    type BalanceRes = { balance: number };
    type PaymentsList = { data: AsaasPayment[]; totalCount: number };
    type SubsList = { data: Array<{ value: number; cycle: string; status: string }>; totalCount: number };

    const [
      balance,
      paymentsMonth,
      paymentsLastMonth,
      lastPayments,
      activeSubs,
    ] = await Promise.all([
      fetchJson<BalanceRes>('/finance/balance').catch(() => ({ balance: 0 })),
      fetchJson<PaymentsList>(`/payments?status=CONFIRMED&dateCreated[ge]=${monthStart}&limit=100`),
      fetchJson<PaymentsList>(`/payments?status=CONFIRMED&dateCreated[ge]=${lastMonthStart}&dateCreated[le]=${lastMonthEnd}&limit=100`),
      fetchJson<PaymentsList>('/payments?status=CONFIRMED&limit=10&order=desc'),
      fetchJson<SubsList>('/subscriptions?status=ACTIVE&limit=100'),
    ]);

    // Calcula totais
    const sumMonth     = paymentsMonth.data.reduce((s, p) => s + (p.value ?? 0), 0);
    const sumLastMonth = paymentsLastMonth.data.reduce((s, p) => s + (p.value ?? 0), 0);

    // MRR: subscriptions mensais somam value; anuais → value/12
    const mrr = activeSubs.data.reduce((s, sub) => {
      if (sub.cycle === 'MONTHLY') return s + (sub.value ?? 0);
      if (sub.cycle === 'YEARLY')  return s + (sub.value ?? 0) / 12;
      return s;
    }, 0);

    const result = {
      balance:         balance.balance,
      mrr,
      paymentsMonth:   sumMonth,
      paymentsLastMonth: sumLastMonth,
      paymentsMonthCount: paymentsMonth.totalCount,
      activeSubsCount: activeSubs.totalCount,
      lastPayments:    lastPayments.data.slice(0, 10).map(p => ({
        id:            p.id,
        value:         p.value,
        netValue:      p.netValue,
        customerName:  p.customerName ?? p.customer,
        description:   p.description ?? '',
        confirmedDate: p.confirmedDate ?? p.paymentDate ?? null,
        billingType:   p.billingType ?? '',
      })),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
