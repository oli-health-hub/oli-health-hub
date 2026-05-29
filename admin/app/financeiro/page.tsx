import { createSupabaseServer } from '@/lib/supabase-server';
import { FinanceiroClient } from './FinanceiroClient';

export const dynamic = 'force-dynamic';

interface AsaasSummary {
  balance:            number;
  mrr:                number;
  paymentsMonth:      number;
  paymentsLastMonth:  number;
  paymentsMonthCount: number;
  activeSubsCount:    number;
  lastPayments: Array<{
    id:            string;
    value:         number;
    netValue:      number;
    customerName:  string;
    description:   string;
    confirmedDate: string | null;
    billingType:   string;
  }>;
}

async function fetchAsaasSummary(): Promise<{ data: AsaasSummary | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return { data: null, error: 'Sessão não encontrada' };

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xwcarrurjvfxisuaihid.supabase.co'}/functions/v1/admin-asaas-summary`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache:   'no-store',
    });

    if (!res.ok) {
      const txt = await res.text();
      return { data: null, error: `${res.status}: ${txt}` };
    }

    const data = await res.json() as AsaasSummary;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function FinanceiroPage() {
  const supabase = await createSupabaseServer();

  const SP = 'America/Sao_Paulo';
  const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
  const monthStart = new Date(nowSP); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  // Dados locais + Asaas em paralelo
  const [asaasRes, receitaMesRes, reservasMesRes] = await Promise.all([
    fetchAsaasSummary(),
    supabase.from('usage_charges').select('valor_total').gte('iniciado_em', monthStart.toISOString()),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .gte('start_time', monthStart.toISOString())
      .not('status', 'in', '("cancelled","cancelado","no_show","nao_compareceu")'),
  ]);

  const receitaMinMes = (receitaMesRes.data ?? []).reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
  const reservasMes   = reservasMesRes.count ?? 0;

  return (
    <FinanceiroClient
      asaas={asaasRes.data}
      asaasError={asaasRes.error}
      receitaMinMes={receitaMinMes}
      reservasMes={reservasMes}
    />
  );
}
