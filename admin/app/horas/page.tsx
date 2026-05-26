import { createSupabaseServer } from '@/lib/supabase-server';
import { addHours } from '@/app/actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function fmt(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default async function HorasPage() {
  const supabase = await createSupabaseServer();

  const { data: balances } = await supabase
    .from('hour_balance')
    .select(`
      id, minutos_total, minutos_usados, expira_em, created_at,
      profiles ( id, nome, crm )
    `)
    .order('created_at', { ascending: false })
    .limit(300);

  // Agrupa por profissional para mostrar saldo consolidado
  type BalanceRow = {
    id: string;
    minutos_total: number;
    minutos_usados: number;
    expira_em: string;
    created_at: string;
    profiles: { id: string; nome: string; crm: string | null } | null;
  };

  const byProfessional: Record<string, { nome: string; crm: string | null; profId: string; total: number; usado: number; pacotes: BalanceRow[] }> = {};

  (balances as unknown as BalanceRow[] ?? []).forEach(b => {
    const prof = b.profiles;
    if (!prof) return;
    if (!byProfessional[prof.id]) {
      byProfessional[prof.id] = { nome: prof.nome, crm: prof.crm, profId: prof.id, total: 0, usado: 0, pacotes: [] };
    }
    byProfessional[prof.id].total += b.minutos_total;
    byProfessional[prof.id].usado += b.minutos_usados;
    byProfessional[prof.id].pacotes.push(b);
  });

  const rows = Object.values(byProfessional).sort((a, b) => (b.total - b.usado) - (a.total - a.usado));

  return (
    <div className="p-7 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-oli-dark">Controle de Horas</h1>
        <span className="text-sm text-oli-lgray">{rows.length} médicos com saldo</span>
      </div>

      {/* Resumo consolidado por médico */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Saldo por médico</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Médico', 'CRM', 'Total comprado', 'Utilizado', 'Saldo restante', 'Uso %', 'Adicionar horas'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {rows.map(r => {
                  const restante = r.total - r.usado;
                  const pct      = r.total > 0 ? Math.round((r.usado / r.total) * 100) : 0;
                  const low      = pct >= 80;
                  return (
                    <tr key={r.profId} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/medicos/${r.profId}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                          {r.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-oli-lgray">{r.crm ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-gray">{fmt(r.total)}</td>
                      <td className="px-4 py-3 text-oli-gray">{fmt(r.usado)}</td>
                      <td className={`px-4 py-3 font-semibold ${low ? 'text-oli-red' : 'text-oli-green'}`}>
                        {fmt(restante)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${low ? 'bg-oli-red' : 'bg-oli-green'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${low ? 'text-oli-red' : 'text-oli-lgray'}`}>{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <form action={addHours} className="flex items-center gap-1.5">
                          <input type="hidden" name="professional_id" value={r.profId} />
                          <input
                            type="number"
                            name="horas"
                            min="1"
                            step="1"
                            placeholder="h"
                            required
                            title="Venda somente em horas inteiras (mín. 1h)"
                            className="w-16 text-xs border border-oli-border rounded-lg px-2 py-1 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
                          />
                          <button
                            type="submit"
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors"
                          >
                            + Adicionar
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                Nenhum saldo de horas registrado
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Histórico de pacotes */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Histórico de pacotes</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Médico', 'Horas', 'Usadas', 'Expira em', 'Adquirido em'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {((balances as unknown as BalanceRow[]) ?? []).map(b => {
                  const prof = b.profiles;
                  return (
                    <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/medicos/${prof?.id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                          {prof?.nome ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-oli-dark font-semibold">{fmt(b.minutos_total)}</td>
                      <td className="px-4 py-3 text-oli-gray">{fmt(b.minutos_usados)}</td>
                      <td className="px-4 py-3 text-oli-gray">
                        {b.expira_em ? new Date(b.expira_em).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-oli-gray">
                        {new Date(b.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
