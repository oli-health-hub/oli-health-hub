import { createSupabaseAdmin } from '@/lib/supabase-server';
import { deletePost } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface PostRow {
  id: string;
  content: string;
  created_at: string;
  profiles: { nome: string } | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function ComunidadePage() {
  const supabase = await createSupabaseAdmin();
  const { data, count } = await supabase
    .from('community_posts')
    .select('id, content, created_at, profiles(nome)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);
  const posts = (data ?? []) as unknown as PostRow[];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-oli-dark">Comunidade — Feed</h1>
        <p className="text-sm text-gray-500">Moderação de posts do feed interno. {count ?? 0} posts no total (últimos 100 exibidos).</p>
      </div>

      {/* overflow-x-auto, não overflow-hidden: em tela menor a tabela rola em
          vez de cortar coluna (mesmo motivo do /leads). */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Autor</th>
              <th className="text-left px-4 py-3">Post</th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nenhum post ainda.</td></tr>
            )}
            {posts.map((p) => (
              <tr key={p.id} className="border-t border-gray-50 align-top">
                <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">{p.profiles?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xl">{p.content}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <form action={deletePost}>
                    <input type="hidden" name="post_id" value={p.id} />
                    <button type="submit" className="text-xs text-red-500 underline hover:text-red-700">
                      Apagar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
