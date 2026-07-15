import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  active:          'bg-green-50 text-oli-green',
  pending_payment: 'bg-yellow-50 text-yellow-700',
  cancelled:       'bg-red-50 text-oli-red',
  inactive:        'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  active:          'Ativo',
  pending_payment: 'Pendente',
  cancelled:       'Cancelado',
  inactive:        'Inativo',
};

export default async function PlanosPage() {
  const supabase = await createSupabaseServer();

  const { data: subs } = await supabase
    .from('subscriptions')
    .select(`
      id, status, ciclo, starts_at, ends_at, cancelled_at, created_at,
      profiles ( id, nome, crm, especialidade ),
      plans    ( id, name, preco_mensal, preco_anual )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  // Médicos sem assinatura
  const { data: semPlano } = await supabase
    .from('profiles')
    .select('id, nome, crm, plan, created_at')
    .not('user_type', 'in', '(admin,founder,specialist,partner)')
    .not('id', 'in', `(${(subs ?? []).map(s => {
      const p = s.profiles as unknown as { id: string } | null;
      return `"${p?.id}"`;
    }).join(',')})`)
    .order('created_at', { ascending: false })
    .limit(100);

  const active    = (subs ?? []).filter(s => s.status === 'active');
  const pending   = (subs ?? []).filter(s => s.status === 'pending_payment');
  const cancelled = (subs ?? []).filter(s => s.status === 'cancelled');

  return (
    <div className="p-7 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-oli-dark">Planos & Assinaturas</h1>
        <div className="flex gap-4 text-sm">
          <span className="text-oli-green font-semibold">{active.length} ativos</span>
          <span className="text-yellow-600 font-semibold">{pending.length} pendentes</span>
          <span className="text-oli-lgray">{cancelled.length} cancelados</span>
        </div>
      </div>

      {/* Assinaturas */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Assinaturas</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Médico', 'Plano', 'Ciclo', 'Valor', 'Status', 'Início', 'Vencimento'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {(subs ?? []).map(sub => {
                  const profile = sub.profiles as unknown as { id: string; nome: string } | null;
                  const plan    = sub.plans    as unknown as { name: string; preco_mensal: number; preco_anual: number } | null;
                  const status  = sub.status ?? 'inactive';
                  const valor   = sub.ciclo === 'YEARLY' ? plan?.preco_anual : plan?.preco_mensal;
                  const ends    = sub.ends_at ? new Date(sub.ends_at).toLocaleDateString('pt-BR') : '—';
                  return (
                    <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/medicos/${profile?.id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                          {profile?.nome ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold text-oli-dark">{plan?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-gray">{sub.ciclo === 'YEARLY' ? 'Anual' : 'Mensal'}</td>
                      <td className="px-4 py-3 text-oli-dark font-semibold">
                        {valor ? `R$ ${Number(valor).toFixed(2).replace('.', ',')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-oli-gray">
                        {new Date(sub.starts_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-oli-gray">{ends}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!subs || subs.length === 0) && (
              <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                Nenhuma assinatura ainda
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Médicos sem assinatura */}
      {(semPlano ?? []).length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-oli-dark mb-3">
            Sem assinatura
            <span className="ml-2 font-normal text-oli-lgray">({semPlano?.length})</span>
          </h2>
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-oli-border">
                    {['Médico', 'CRM', 'Plano cadastral', 'Cadastro'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-oli-border">
                  {(semPlano ?? []).map(m => (
                    <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/medicos/${m.id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                          {m.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-oli-gray">{m.crm ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {m.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-oli-gray">
                        {new Date(m.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
