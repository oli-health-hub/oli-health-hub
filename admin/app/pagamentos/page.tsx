import { createSupabaseServer } from '@/lib/supabase-server';

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

export default async function PagamentosPage() {
  const supabase = await createSupabaseServer();

  // Módulos contratados (compra avulsa)
  const { data: userModules } = await supabase
    .from('user_modules')
    .select('id, status, created_at, activated_at, profiles(nome), modules(nome, valor)')
    .order('created_at', { ascending: false })
    .limit(100);

  // Assinaturas (planos recorrentes)
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, ciclo, created_at, starts_at, profiles(nome), plans(name, preco_mensal, preco_anual)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="p-7 space-y-8">
      <h1 className="text-xl font-bold text-oli-dark">Pagamentos</h1>

      {/* Módulos */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">
          Módulos contratados
          <span className="ml-2 text-oli-lgray font-normal">({userModules?.length ?? 0})</span>
        </h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Médico', 'Módulo', 'Valor', 'Status', 'Data'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {(userModules ?? []).map((um) => {
                  const profile = (um.profiles as unknown) as { nome: string } | null;
                  const module  = (um.modules  as unknown) as { nome: string; valor: number } | null;
                  const status  = um.status ?? 'inactive';
                  return (
                    <tr key={um.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-oli-dark">{profile?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-gray">{module?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-dark font-semibold">
                        {module?.valor ? `R$ ${module.valor.toFixed(2).replace('.', ',')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-oli-gray">
                        {new Date(um.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!userModules || userModules.length === 0) && (
              <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                Nenhuma compra de módulo ainda
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Assinaturas */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">
          Assinaturas de plano
          <span className="ml-2 text-oli-lgray font-normal">({subscriptions?.length ?? 0})</span>
        </h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Médico', 'Plano', 'Ciclo', 'Valor', 'Status', 'Início'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {(subscriptions ?? []).map((sub) => {
                  const profile = (sub.profiles as unknown) as { nome: string } | null;
                  const plan    = (sub.plans    as unknown) as { name: string; preco_mensal: number; preco_anual: number } | null;
                  const status  = sub.status ?? 'inactive';
                  const valor   = sub.ciclo === 'YEARLY' ? plan?.preco_anual : plan?.preco_mensal;
                  return (
                    <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-oli-dark">{profile?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-dark font-semibold">{plan?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-gray">{sub.ciclo === 'YEARLY' ? 'Anual' : 'Mensal'}</td>
                      <td className="px-4 py-3 text-oli-dark font-semibold">
                        {valor ? `R$ ${valor.toFixed(2).replace('.', ',')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-oli-gray">
                        {new Date(sub.starts_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!subscriptions || subscriptions.length === 0) && (
              <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                Nenhuma assinatura ainda
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
