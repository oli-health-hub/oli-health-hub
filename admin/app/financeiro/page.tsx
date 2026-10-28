import { carregarFinanceiro, hojeSP, mesValido } from '@/lib/financeiro';
import { FinanceiroClient } from './FinanceiroClient';

export const dynamic = 'force-dynamic';

export default async function FinanceiroPage({ searchParams }: { searchParams: { mes?: string } }) {
  const mes  = mesValido(searchParams.mes) ? searchParams.mes : hojeSP().slice(0, 7);
  const data = await carregarFinanceiro(mes);

  return <FinanceiroClient data={data} />;
}
