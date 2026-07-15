import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  founder:    'Founder',
  specialist: 'Especialista',
  partner:    'Parceiro',
};

const TYPE_COLOR: Record<string, string> = {
  founder:    'bg-yellow-50 text-yellow-700',
  specialist: 'bg-blue-50 text-blue-600',
  partner:    'bg-green-50 text-oli-green',
};

export default async function EquipePage() {
  const supabase = await createSupabaseServer();

  const { data: equipe } = await supabase
    .from('profiles')
    .select('id, nome, especialidade, user_type, created_at')
    .in('user_type', ['founder', 'specialist', 'partner'])
    .order('created_at', { ascending: false });

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Equipe</h1>
          <p className="text-sm text-oli-gray mt-0.5">
            Founder, especialistas e parceiros — perfis não-médicos visíveis na Comunidade do app.
          </p>
        </div>
        <Link
          href="/equipe/novo"
          className="text-sm font-bold bg-oli-green text-white px-4 py-2 rounded-lg hover:bg-oli-green/90 transition-colors"
        >
          + Novo perfil
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {['Nome', 'Tipo', 'Título / Papel', 'Criado em'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {(equipe ?? []).map(m => (
                <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/equipe/${m.id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                      {m.nome ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[m.user_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABEL[m.user_type] ?? m.user_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-oli-gray">{m.especialidade ?? '—'}</td>
                  <td className="px-4 py-3 text-oli-gray">
                    {new Date(m.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!equipe || equipe.length === 0) && (
            <div className="flex items-center justify-center py-12 text-oli-lgray text-sm">
              Nenhum perfil de equipe cadastrado ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
