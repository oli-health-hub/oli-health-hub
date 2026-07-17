import { createSupabaseAdmin } from '@/lib/supabase-server';
import { setUserType } from '@/app/actions';
import { InviteUserForm } from './InviteUserForm';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const supabase = await createSupabaseAdmin();

  // Busca todos os perfis com e-mail do auth.users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome, user_type, created_at')
    .order('user_type', { ascending: false })  // admins first
    .order('created_at', { ascending: true })
    .limit(200);

  const profileIds = (profiles ?? []).map(p => p.id);

  // Busca e-mails em auth.users
  const emailMap: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    (authList?.users ?? []).forEach(u => {
      emailMap[u.id] = u.email ?? '';
    });
  }

  const admins      = (profiles ?? []).filter(p => p.user_type === 'admin');
  const pending     = (profiles ?? []).filter(p => p.user_type === 'pending');
  const nonAdmins   = (profiles ?? []).filter(p => p.user_type !== 'admin' && p.user_type !== 'pending');

  return (
    <div className="p-7 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-oli-dark">Usuários do Sistema</h1>
        <span className="text-sm text-oli-lgray">{admins.length} admin{admins.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Convidar usuário */}
      <InviteUserForm />

      {/* Admins */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Administradores</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {['Nome', 'E-mail', 'Desde', 'Ação'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {admins.map(p => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-oli-dark">{p.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-gray">{emailMap[p.id] ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-lgray">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {admins.length > 1 && (
                        <form action={setUserType}>
                          <input type="hidden" name="user_id"   value={p.id} />
                          <input type="hidden" name="user_type" value="subscriber" />
                          <button
                            type="submit"
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-50 text-oli-red hover:bg-red-100 transition-colors"
                          >
                            Remover admin
                          </button>
                        </form>
                      )}
                      <form action={setUserType} className="flex items-center gap-1">
                        <input type="hidden" name="user_id" value={p.id} />
                        <select
                          name="user_type"
                          defaultValue="founder"
                          className="text-[11px] border border-oli-border rounded-lg px-1.5 py-1"
                        >
                          <option value="founder">Founder</option>
                          <option value="specialist">Especialista</option>
                          <option value="partner">Parceiro</option>
                          <option value="team">Equipe OLI</option>
                        </select>
                        <button
                          type="submit"
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          Converter em Equipe
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {admins.length === 0 && (
            <div className="flex items-center justify-center py-8 text-oli-lgray text-sm">
              Nenhum admin cadastrado
            </div>
          )}
        </div>
      </section>

      {/* Convites aceitos aguardando classificação */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">
          Aguardando classificação
          <span className="ml-2 font-normal text-oli-lgray">— convite aceito, ainda não é profissional de saúde nem equipe</span>
        </h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {['Nome', 'E-mail', 'Desde', 'Ação'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {pending.map(p => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-oli-dark">{p.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-gray">{emailMap[p.id] ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-lgray">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <form action={setUserType}>
                        <input type="hidden" name="user_id"   value={p.id} />
                        <input type="hidden" name="user_type" value="subscriber" />
                        <button
                          type="submit"
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-green-50 text-oli-green hover:bg-green-100 transition-colors"
                        >
                          Classificar como profissional de saúde
                        </button>
                      </form>
                      <form action={setUserType} className="flex items-center gap-1">
                        <input type="hidden" name="user_id" value={p.id} />
                        <select
                          name="user_type"
                          defaultValue="admin"
                          className="text-[11px] border border-oli-border rounded-lg px-1.5 py-1"
                        >
                          <option value="admin">Admin</option>
                          <option value="founder">Founder</option>
                          <option value="specialist">Especialista</option>
                          <option value="partner">Parceiro</option>
                          <option value="team">Equipe OLI</option>
                        </select>
                        <button
                          type="submit"
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          Classificar como Equipe
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.length === 0 && (
            <div className="flex items-center justify-center py-8 text-oli-lgray text-sm">
              Ninguém aguardando classificação
            </div>
          )}
        </div>
      </section>

      {/* Promover profissional de saúde a admin */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">
          Profissionais de saúde cadastrados
          <span className="ml-2 font-normal text-oli-lgray">— promover a admin se necessário</span>
        </h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Nome', 'E-mail', 'Tipo atual', 'Ação'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {nonAdmins.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-oli-dark">{p.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-oli-gray">{emailMap[p.id] ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {p.user_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <form action={setUserType}>
                          <input type="hidden" name="user_id"   value={p.id} />
                          <input type="hidden" name="user_type" value="admin" />
                          <button
                            type="submit"
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-green-50 text-oli-green hover:bg-green-100 transition-colors"
                          >
                            Tornar admin
                          </button>
                        </form>
                        {!['founder', 'specialist', 'partner', 'team'].includes(p.user_type) ? (
                          <form action={setUserType} className="flex items-center gap-1">
                            <input type="hidden" name="user_id" value={p.id} />
                            <select
                              name="user_type"
                              defaultValue="founder"
                              className="text-[11px] border border-oli-border rounded-lg px-1.5 py-1"
                            >
                              <option value="founder">Founder</option>
                              <option value="specialist">Especialista</option>
                              <option value="partner">Parceiro</option>
                              <option value="team">Equipe OLI</option>
                            </select>
                            <button
                              type="submit"
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            >
                              Converter em Equipe
                            </button>
                          </form>
                        ) : (
                          <a
                            href={`/equipe/${p.id}`}
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            Editar em Equipe →
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {nonAdmins.length === 0 && (
              <div className="flex items-center justify-center py-8 text-oli-lgray text-sm">
                Sem outros usuários
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
