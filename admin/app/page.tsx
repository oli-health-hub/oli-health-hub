import { createSupabaseServer } from '@/lib/supabase-server';
import LiveRooms from '@/components/LiveRooms';
import ReservationCalendar from '@/components/ReservationCalendar';
import UpcomingList from '@/components/UpcomingList';
import NotificationFeed from '@/components/NotificationFeed';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createSupabaseServer();

  const SP = 'America/Sao_Paulo';
  const nowSP    = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
  const todayStart = new Date(nowSP);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(nowSP);
  todayEnd.setHours(23, 59, 59, 999);

  const [
    { count: totalMedicos },
    { count: novosHoje },
    { data: reservasHoje },
    { data: activeNow },
    { data: proximaRes },
    { data: receitaHoje },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('user_type', 'admin'),
    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase.from('reservations')
      .select('id, status')
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .not('status', 'in', '("cancelled","no_show")'),
    supabase.from('reservations')
      .select('id, room_name')
      .lte('start_time', nowSP.toISOString())
      .gte('end_time', nowSP.toISOString())
      .not('status', 'in', '("cancelled","no_show")'),
    supabase.from('reservations')
      .select('start_time, room_name, profiles(nome)')
      .gt('start_time', nowSP.toISOString())
      .not('status', 'in', '("cancelled","no_show")')
      .order('start_time', { ascending: true })
      .limit(1),
    supabase.from('usage_charges')
      .select('valor_total')
      .gte('iniciado_em', todayStart.toISOString())
      .lte('iniciado_em', todayEnd.toISOString()),
  ]);

  const salaEmUso   = activeNow?.length ?? 0;
  const totalHoje   = reservasHoje?.length ?? 0;
  const receitaTotal = (receitaHoje ?? []).reduce((s, r) => s + (r.valor_total ?? 0), 0);

  // Próxima reserva
  const proxRes = proximaRes?.[0];
  const proxMins = proxRes
    ? Math.max(0, Math.floor((new Date(proxRes.start_time).getTime() - Date.now()) / 60000))
    : null;
  const proxProfile = proxRes?.profiles as { nome: string } | null | undefined;

  const dateFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: SP,
  }).replace(/^\w/, c => c.toUpperCase());

  const timeFormatted = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: SP,
  });

  return (
    <div className="p-7 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Dashboard</h1>
          <p className="text-sm text-oli-gray mt-0.5">{dateFormatted} · {timeFormatted}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-oli-green bg-green-50 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-oli-green animate-pulse" />
          Tempo real
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Salas em uso */}
        <div className={`bg-white rounded-2xl border p-4 ${salaEmUso > 0 ? 'border-oli-green/40' : 'border-oli-border'}`}>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Salas em uso</p>
          <p className="text-3xl font-extrabold text-oli-dark leading-none mt-2">
            {salaEmUso}<span className="text-base font-semibold text-oli-lgray ml-1">/7</span>
          </p>
          {salaEmUso > 0 && (
            <p className="mt-1.5 text-[10px] font-bold text-oli-green">● ao vivo</p>
          )}
        </div>

        {/* Reservas hoje */}
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Reservas hoje</p>
          <p className="text-3xl font-extrabold text-oli-dark leading-none mt-2">{totalHoje}</p>
          <p className="mt-1.5 text-[10px] text-oli-lgray">
            {(reservasHoje ?? []).filter(r => r.status === 'completed').length} concluídas
          </p>
        </div>

        {/* Próxima reserva */}
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Próxima reserva</p>
          {proxRes ? (
            <>
              <p className="text-xl font-extrabold text-oli-dark leading-none mt-2">
                {proxMins! < 60 ? `${proxMins}min` : `${Math.floor(proxMins! / 60)}h`}
              </p>
              <p className="mt-1.5 text-[10px] text-oli-lgray truncate">
                {proxProfile?.nome} · {proxRes.room_name}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-oli-lgray mt-2">—</p>
          )}
        </div>

        {/* Receita do dia */}
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Receita hoje</p>
          <p className="text-2xl font-extrabold text-oli-dark leading-none mt-2">
            {receitaTotal > 0
              ? `R$ ${receitaTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
              : '—'}
          </p>
          <p className="mt-1.5 text-[10px] text-oli-lgray">minutagem cobrada</p>
        </div>

        {/* Médicos cadastrados */}
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Médicos</p>
          <p className="text-3xl font-extrabold text-oli-dark leading-none mt-2">{totalMedicos ?? 0}</p>
          {(novosHoje ?? 0) > 0 && (
            <p className="mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-oli-green">
              +{novosHoje} hoje
            </p>
          )}
        </div>
      </div>

      {/* Salas ao vivo */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold text-oli-dark">Salas ao Vivo</h2>
          <span className="text-[10px] font-semibold text-oli-lgray">— timers em tempo real</span>
        </div>
        <LiveRooms />
      </section>

      {/* Calendário + Próximas + Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Calendário semanal — 2 colunas */}
        <div className="xl:col-span-2">
          <ReservationCalendar />
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">

          {/* Próximas reservas */}
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-oli-border">
              <h2 className="text-sm font-bold text-oli-dark">Próximas Reservas</h2>
              <span className="text-[10px] text-oli-lgray">48h</span>
            </div>
            <div className="p-3">
              <UpcomingList />
            </div>
          </div>

          {/* Feed de notificações */}
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-oli-border">
              <h2 className="text-sm font-bold text-oli-dark">Feed</h2>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-oli-green">
                <span className="w-1.5 h-1.5 rounded-full bg-oli-green animate-pulse" />
                Ao vivo
              </div>
            </div>
            <NotificationFeed />
          </div>

        </div>
      </div>
    </div>
  );
}
