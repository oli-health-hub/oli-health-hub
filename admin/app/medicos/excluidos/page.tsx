import { createSupabaseAdmin } from '@/lib/supabase-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MedicosExcluidosPage() {
  const supabase = await createSupabaseAdmin();

  const { data: excluidos } = await supabase
    .from('profiles')
    .select('id, nome, crm, especialidade, status_reason, created_at')
    .not('user_type', 'in', '(admin,founder,specialist,partner,pending,team)')
    .eq('account_status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(500);

  const profileIds = (excluidos ?? []).map(p => p.id);
  const emailMap: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    (authList?.users ?? []).forEach(u => {
      emailMap[u.id] = u.email ?? '';
    });
  }

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/medicos" className="text-sm text-oli-lgray hover:text-oli-dark transition-colors">
            ← Médicos
          </Link>
          <h1 className="text-xl font-bold text-oli-dark mt-1">Contas excluídas</h1>
          <p className="text-sm text-oli-lgray mt-1">
            Exclusão suave (LGPD/auditoria) — dados preservados, sem acesso ao app. Não aparecem na lista principal.
          </p>
        </div>
        <span className="text-sm text-oli-gray">{excluidos?.length ?? 0} conta{excluidos?.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {['Nome', 'E-mail', 'CRM', 'Motivo', 'Cadastro'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {(excluidos ?? []).map(p => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/medicos/${p.id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                      {p.nome ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-oli-gray">{emailMap[p.id] ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-gray">{p.crm ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-gray">{p.status_reason ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-gray">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!excluidos || excluidos.length === 0) && (
            <div className="flex items-center justify-center py-12 text-oli-lgray text-sm">
              Nenhuma conta excluída
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
