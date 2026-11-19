import { createSupabaseServer } from '@/lib/supabase-server';
import { setModuleStatus } from '@/app/actions';
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

export default async function ModulosPage() {
  const supabase = await createSupabaseServer();

  const { data: userModules } = await supabase
    .from('user_modules')
    .select(`
      id, status, activated_at, ativo_ate, created_at,
      profiles ( id, nome ),
      modules  ( id, nome, valor, categoria, tipo )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  const active    = (userModules ?? []).filter(m => m.status === 'active').length;
  const pending   = (userModules ?? []).filter(m => m.status === 'pending_payment').length;

  return (
    <div className="p-7 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-oli-dark">Módulos Contratados</h1>
        <div className="flex gap-4 text-sm">
          <span className="text-oli-green font-semibold">{active} ativos</span>
          <span className="text-yellow-600 font-semibold">{pending} pendentes</span>
          <span className="text-oli-lgray">{(userModules ?? []).length} total</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {['Médico', 'Módulo', 'Categoria', 'Valor', 'Status', 'Ativado em', 'Ativo até', 'Ação'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {(userModules ?? []).map(um => {
                const profile = um.profiles as unknown as { id: string; nome: string } | null;
                const module  = um.modules  as unknown as { nome: string; valor: number; categoria: string } | null;
                const status  = um.status ?? 'inactive';
                const canActivate   = status !== 'active';
                const canDeactivate = status === 'active';

                return (
                  <tr key={um.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/medicos/${profile?.id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                        {profile?.nome ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-oli-dark">{module?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-oli-lgray text-xs">{module?.categoria ?? '—'}</td>
                    <td className="px-4 py-3 text-oli-dark font-semibold">
                      {module?.valor ? `R$ ${Number(module.valor).toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-oli-gray">
                      {um.activated_at ? new Date(um.activated_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-oli-gray">
                      {um.ativo_ate ? new Date(um.ativo_ate).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <form action={setModuleStatus} className="flex gap-1">
                        <input type="hidden" name="user_module_id" value={um.id} />
                        {canActivate && (
                          <button
                            type="submit"
                            name="status"
                            value="active"
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-green-50 text-oli-green hover:bg-green-100 transition-colors"
                          >
                            Ativar
                          </button>
                        )}
                        {canDeactivate && (
                          <button
                            type="submit"
                            name="status"
                            value="inactive"
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            Desativar
                          </button>
                        )}
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!userModules || userModules.length === 0) && (
            <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
              Nenhum módulo contratado ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
