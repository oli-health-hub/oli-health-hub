import { createSupabaseServer } from '@/lib/supabase-server';
import KpiCard from '@/components/KpiCard';
import NotificationFeed from '@/components/NotificationFeed';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createSupabaseServer();
  const today    = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalMedicos },
    { count: novosHoje },
    { count: modulosAtivados },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('user_type', 'admin'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'module_activated')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-oli-dark">Dashboard</h1>
        <p className="text-sm text-oli-gray">{dateFormatted}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Total de Médicos"
          value={totalMedicos ?? 0}
          badge={`${novosHoje ?? 0} hoje`}
        />
        <KpiCard
          label="Módulos Ativados (30d)"
          value={modulosAtivados ?? 0}
          color="gold"
        />
        <KpiCard
          label="Novos Hoje"
          value={novosHoje ?? 0}
        />
      </div>

      {/* Feed */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-oli-border">
          <h2 className="text-sm font-bold text-oli-dark">Feed ao Vivo</h2>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-oli-green">
            <span className="w-1.5 h-1.5 rounded-full bg-oli-green animate-pulse" />
            Tempo real
          </div>
        </div>
        <NotificationFeed />
      </div>
    </div>
  );
}
