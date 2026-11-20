import { createSupabaseAdmin } from '@/lib/supabase-server';
import { Bell, Send, Smartphone, CalendarClock } from 'lucide-react';
import { CabecalhoPagina, Painel, type KpiDef } from '@/components/ui';
import { BroadcastForm } from './BroadcastForm';

export const dynamic = 'force-dynamic';

export default async function NotificacoesPage() {
  const supabase = await createSupabaseAdmin();
  const { count } = await supabase.from('push_tokens').select('id', { count: 'exact', head: true });

  const kpis: KpiDef[] = [{ icone: Smartphone, rotulo: 'Dispositivos registrados', valor: String(count ?? 0), tom: 'green' }];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <CabecalhoPagina
        titulo="Notificações"
        subtitulo="Envie push notification para todos os médicos com o app instalado."
        icone={Bell}
        kpis={kpis}
      />

      <Painel titulo="Enviar notificação" icone={Send} tom="green">
        <BroadcastForm />
      </Painel>

      <Painel titulo="Campanhas automáticas já ativas (sem precisar mexer aqui)" icone={CalendarClock} tom="neutral">
        <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-500">
          <li>Lembrete de reserva — 1 dia antes, 18h</li>
          <li>Reação à inatividade — 7 e 14 dias sem abrir o app</li>
          <li>Objetivos de perfil pendentes — toda segunda-feira</li>
        </ul>
      </Painel>
    </div>
  );
}
