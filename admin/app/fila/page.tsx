import { createSupabaseServer } from '@/lib/supabase-server';
import FilaClient from './FilaClient';

export const dynamic = 'force-dynamic';

export default async function FilaPage() {
  const supabase = await createSupabaseServer();

  const { data: notifications } = await supabase
    .from('admin_notifications')
    // `whatsapp` do perfil é o que faz o botão funcionar — todo tipo aqui tem
    // professional_id (nenhum é lead sem cadastro).
    .select('*, profiles(nome, crm, especialidade, plan, whatsapp)')
    .is('read_at', null)
    // Fila = ação operacional sobre médico já cadastrado (cadastro, reserva,
    // plano, módulo, pacote de horas). `lead_received` e
    // `whatsapp_message_received` já vivem em /leads e /conversas — incluir
    // aqui duplicava a mesma coisa em dois lugares.
    .in('type', [
      'new_signup',
      'reservation_created',
      'plan_subscribed',
      'plan_activated',
      'module_purchased',
      'module_activated',
      'hour_package_purchased',
      'hour_package_activated',
    ])
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
