import { createSupabaseServer } from '@/lib/supabase-server';
import FilaClient from './FilaClient';

export const dynamic = 'force-dynamic';

export default async function FilaPage() {
  const supabase = await createSupabaseServer();

  const { data: notifications } = await supabase
    .from('admin_notifications')
    // `whatsapp` do perfil é o que faz o botão funcionar nas notificações de
    // cadastro e módulo: o metadata delas nunca teve telefone (conferido — 0 de
    // 109 `new_signup` têm a chave). Só lead traz número no próprio metadata.
    .select('*, profiles(nome, crm, especialidade, plan, whatsapp)')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-oli-dark">Fila de Trabalho</h1>
        <span className="bg-red-50 text-oli-red text-xs font-bold px-3 py-1 rounded-full">
          {notifications?.length ?? 0} pendentes
        </span>
      </div>
      <FilaClient initialItems={notifications ?? []} />
    </div>
  );
}
