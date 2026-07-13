import { createSupabaseAdmin } from '@/lib/supabase-server';
import { BroadcastForm } from './BroadcastForm';

export const dynamic = 'force-dynamic';

export default async function NotificacoesPage() {
  const supabase = await createSupabaseAdmin();
  const { count } = await supabase.from('push_tokens').select('id', { count: 'exact', head: true });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-oli-dark">Notificações</h1>
        <p className="text-sm text-gray-500">
          Envie push notification pra todos os médicos com o app instalado. {count ?? 0} device(s) registrado(s).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <BroadcastForm />
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-500">
        <p className="font-semibold text-gray-600 mb-1">Campanhas automáticas já ativas (sem precisar mexer aqui):</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Lembrete de reserva — 1 dia antes, 18h</li>
          <li>Reação à inatividade — 7 e 14 dias sem abrir o app</li>
          <li>Objetivos de perfil pendentes — toda segunda-feira</li>
        </ul>
      </div>
    </div>
  );
}
