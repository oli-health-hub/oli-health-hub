import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const PLAN_COLOR: Record<string, string> = {
  BASE: 'bg-gray-100 text-gray-600',
  PRO:  'bg-green-50 text-oli-green',
  VIP:  'bg-yellow-50 text-yellow-700',
};

export default async function MedicosPage() {
  const supabase = await createSupabaseServer();

  const { data: medicos } = await supabase
    .from('profiles')
    .select('id, nome, crm, especialidade, plan, created_at')
    .neq('user_type', 'admin')
    .order('created_at', { ascending: false })
    .limit(200);

  // Conta módulos ativos por profissional
  const professionalIds = (medicos ?? []).map(m => m.id);
  const { data: moduleCounts } = professionalIds.length > 0
    ? await supabase
        .from('user_modules')
        .select('professional_id')
        .in('professional_id', professionalIds)
        .eq('status', 'active')
    : { data: [] };

  const moduleCountMap: Record<string, number> = {};
  (moduleCounts ?? []).forEach(m => {
    moduleCountMap[m.professional_id] = (moduleCountMap[m.professional_id] ?? 0) + 1;
  });

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-oli-dark">Médicos</h1>
        <span className="text-sm text-oli-gray">{medicos?.length ?? 0} cadastrados</span>
      </div>

      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {['Nome', 'CRM', 'Especialidade', 'Plano', 'Módulos', 'Cadastro'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {(medicos ?? []).map(m => {
                const plan        = m.plan ?? 'BASE';
                const planColor   = PLAN_COLOR[plan] ?? 'bg-gray-100 text-gray-600';
                const moduleCount = moduleCountMap[m.id] ?? 0;
                const date        = new Date(m.created_at).toLocaleDateString('pt-BR');

                return (
                  <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-oli-dark">{m.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-oli-gray">{m.crm ?? '—'}</td>
                    <td className="px-4 py-3 text-oli-gray">{m.especialidade ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${planColor}`}>
                        {plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {moduleCount > 0
                        ? <span className="text-oli-green font-semibold">{moduleCount} ativo{moduleCount !== 1 ? 's' : ''}</span>
                        : <span className="text-oli-lgray">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-oli-gray">{date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(!medicos || medicos.length === 0) && (
            <div className="flex items-center justify-center py-12 text-oli-lgray text-sm">
              Nenhum médico cadastrado ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
