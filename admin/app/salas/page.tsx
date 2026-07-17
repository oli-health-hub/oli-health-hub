import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { ReservationBlock } from '@/components/ReservationBlock';

export const dynamic = 'force-dynamic';

const PALETTE = [
  { free: 'bg-emerald-50', occ: 'bg-emerald-200', border: 'border-emerald-300', dot: 'bg-emerald-500', text: 'text-emerald-900' },
  { free: 'bg-blue-50',    occ: 'bg-blue-200',    border: 'border-blue-300',    dot: 'bg-blue-500',    text: 'text-blue-900'    },
  { free: 'bg-violet-50',  occ: 'bg-violet-200',  border: 'border-violet-300',  dot: 'bg-violet-500',  text: 'text-violet-900'  },
  { free: 'bg-amber-50',   occ: 'bg-amber-200',   border: 'border-amber-300',   dot: 'bg-amber-500',   text: 'text-amber-900'   },
  { free: 'bg-rose-50',    occ: 'bg-rose-200',    border: 'border-rose-300',    dot: 'bg-rose-500',    text: 'text-rose-900'    },
  { free: 'bg-teal-50',    occ: 'bg-teal-200',    border: 'border-teal-300',    dot: 'bg-teal-500',    text: 'text-teal-900'    },
  { free: 'bg-indigo-50',  occ: 'bg-indigo-200',  border: 'border-indigo-300',  dot: 'bg-indigo-500',  text: 'text-indigo-900'  },
  { free: 'bg-orange-50',  occ: 'bg-orange-200',  border: 'border-orange-300',  dot: 'bg-orange-500',  text: 'text-orange-900'  },
  { free: 'bg-cyan-50',    occ: 'bg-cyan-200',    border: 'border-cyan-300',    dot: 'bg-cyan-500',    text: 'text-cyan-900'    },
];

const STATUS_LABEL: Record<string, string> = {
  agendado:  'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  no_show:   'No-show',
  cancelled: 'Cancelado',
};

const SP = 'America/Sao_Paulo';
const GRID_START = 7;
const GRID_HOURS = 15; // 07:00–22:00

function toSPDate(iso: string) {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: SP }));
}
function pct(h: number) { return `${((h - GRID_START) / GRID_HOURS * 100).toFixed(3)}%`; }
function durPct(start: Date, end: Date) {
  const h = (end.getTime() - start.getTime()) / 3600000;
  return `${(h / GRID_HOURS * 100).toFixed(3)}%`;
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function isoDay(d: Date) { return d.toISOString().split('T')[0]; }

/** Segunda-feira da semana que contém `d` (semana Seg–Dom). */
function weekStartOf(d: Date): Date {
  const dow  = d.getDay(); // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  return start;
}

export default async function SalasPage({ searchParams }: { searchParams: { date?: string; view?: string } }) {
  const supabase = await createSupabaseServer();

  const nowSP    = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
  const selDate  = searchParams.date ?? isoDay(nowSP);
  const viewMode: 'day' | 'week' = searchParams.view === 'week' ? 'week' : 'day';
  const isToday  = selDate === isoDay(nowSP);

  // Janela de busca: 1 dia no modo Dia, semana Seg–Dom no modo Semana (SP = UTC-3).
  // weekStartOf usa T12:00 só pra achar a data da segunda (evita virada de dia por DST);
  // o range em si sempre começa/termina em 00:00/23:59 do dia real.
  const weekStartDate = viewMode === 'week' ? isoDay(weekStartOf(new Date(`${selDate}T12:00:00`))) : selDate;
  const rangeStart = new Date(`${weekStartDate}T00:00:00`);
  const rangeEnd   = viewMode === 'week'
    ? new Date(new Date(rangeStart).setDate(rangeStart.getDate() + 6))
    : new Date(`${selDate}T23:59:59`);
  rangeEnd.setHours(23, 59, 59, 999);

  const utcStart = new Date(rangeStart.getTime() + 3 * 3600000).toISOString();
  const utcEnd   = new Date(rangeEnd.getTime()   + 3 * 3600000).toISOString();

  const weekDays = viewMode === 'week'
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(rangeStart);
        d.setDate(rangeStart.getDate() + i);
        return isoDay(d);
      })
    : [selDate];

  const [{ data: roomRows }, { data: reservations }] = await Promise.all([
    supabase.from('rooms').select('id, name').order('id'),
    supabase
      .from('reservations')
      .select('id, room_name, start_time, end_time, status, arrived_at, consultation_started_at, consultation_ended_at, professional_id, profiles(nome, plan)')
      .gte('start_time', utcStart)
      .lte('start_time', utcEnd)
      .not('status', 'in', '("cancelled")')
      .order('start_time', { ascending: true }),
  ]);

  const rooms = (roomRows ?? []) as { id: number; name: string }[];
  const recs  = reservations ?? [];

  const nowHour = nowSP.getHours() + nowSP.getMinutes() / 60;
  const nowPct  = (viewMode === 'day' && isToday) ? `${((nowHour - GRID_START) / GRID_HOURS * 100).toFixed(2)}%` : null;

  const totalRes      = recs.length;
  const inProgress    = recs.filter(r => r.consultation_started_at && !r.consultation_ended_at).length;
  const upcoming      = recs.filter(r => {
    const sp = toSPDate(r.start_time);
    return sp > nowSP;
  }).length;
  const uniqueProfs   = new Set(recs.map(r => r.professional_id)).size;

  // Utilisation %: sum of scheduled minutes / (salas × 15h × 60min × dias no período)
  const totalScheduledMin = recs.reduce((s, r) => {
    const diff = new Date(r.end_time).getTime() - new Date(r.start_time).getTime();
    return s + diff / 60000;
  }, 0);
  const maxMin  = rooms.length * GRID_HOURS * 60 * weekDays.length;
  const utilPct = maxMin > 0 ? Math.round((totalScheduledMin / maxMin) * 100) : 0;

  const dateLabel = viewMode === 'week'
    ? `${new Date(`${weekDays[0]}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${new Date(`${weekDays[6]}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : new Date(`${selDate}T12:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).replace(/^\w/, c => c.toUpperCase());

  const navStepMs  = (viewMode === 'week' ? 7 : 1) * 86400000;
  const prevHref    = `/salas?view=${viewMode}&date=${isoDay(new Date(new Date(`${selDate}T12:00:00`).getTime() - navStepMs))}`;
  const nextHref    = `/salas?view=${viewMode}&date=${isoDay(new Date(new Date(`${selDate}T12:00:00`).getTime() + navStepMs))}`;
  const resetHref   = `/salas?view=${viewMode}`;
  const isThisWeek  = viewMode === 'week' && weekDays.includes(isoDay(nowSP));

  return (
    <div className="p-7 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Mapa das Salas</h1>
          <p className="text-sm text-oli-gray mt-0.5">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Dia/Semana */}
          <div className="flex items-center bg-stone-100 rounded-xl p-1 text-xs font-bold">
            <Link
              href={`/salas?date=${selDate}`}
              className={`px-3 py-1.5 rounded-lg transition-colors ${viewMode === 'day' ? 'bg-white text-oli-dark shadow-sm' : 'text-oli-lgray hover:text-oli-dark'}`}
            >
              Dia
            </Link>
            <Link
              href={`/salas?view=week&date=${selDate}`}
              className={`px-3 py-1.5 rounded-lg transition-colors ${viewMode === 'week' ? 'bg-white text-oli-dark shadow-sm' : 'text-oli-lgray hover:text-oli-dark'}`}
            >
              Semana
            </Link>
          </div>

          {/* Date navigator */}
          <form method="GET" className="flex items-center gap-2">
            <input type="hidden" name="view" value={viewMode} />
            <Link
              href={prevHref}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-oli-gray transition-colors text-lg"
            >‹</Link>
            <input
              type="date"
              name="date"
              defaultValue={selDate}
              className="text-sm border border-oli-border rounded-xl px-3 py-1.5 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
            />
            <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
              Ir
            </button>
            <Link
              href={nextHref}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-oli-gray transition-colors text-lg"
            >›</Link>
            {!(viewMode === 'day' ? isToday : isThisWeek) && (
              <Link href={resetHref} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
                {viewMode === 'week' ? 'Esta semana' : 'Hoje'}
              </Link>
            )}
          </form>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-dark">{totalRes}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Reservas</p>
        </div>
        {viewMode === 'week' ? (
          <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
            <p className="text-2xl font-extrabold text-oli-dark">{uniqueProfs}</p>
            <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Profissionais</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
            <p className={`text-2xl font-extrabold ${inProgress > 0 ? 'text-oli-red' : 'text-oli-dark'}`}>{inProgress}</p>
            <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Em sessão</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-yellow-600">{upcoming}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Próximas</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-green">{utilPct}%</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Ocupação</p>
        </div>
      </div>

      {/* Grid semanal */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="px-5 py-3 border-b border-oli-border">
            <h2 className="text-sm font-bold text-oli-dark">Semana por sala</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-oli-border">
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider sticky left-0 bg-white">Sala</th>
                  {weekDays.map(day => {
                    const d = new Date(`${day}T12:00:00`);
                    const isCurrentDay = day === isoDay(nowSP);
                    return (
                      <th key={day} className="text-center px-2 py-2 min-w-[130px] border-l border-oli-border">
                        <Link
                          href={`/salas?date=${day}`}
                          className={`inline-flex flex-col items-center px-2 py-1 rounded-lg transition-colors hover:bg-stone-100 ${isCurrentDay ? 'bg-oli-green/10' : ''}`}
                        >
                          <span className="text-[10px] font-bold text-oli-lgray uppercase">
                            {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                          </span>
                          <span className={`text-sm font-extrabold ${isCurrentDay ? 'text-oli-green' : 'text-oli-dark'}`}>
                            {d.getDate()}/{d.getMonth() + 1}
                          </span>
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {rooms.map((room, idx) => {
                  const theme = PALETTE[idx % PALETTE.length];
                  return (
                    <tr key={room.id}>
                      <td className="px-4 py-2 align-top sticky left-0 bg-white">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${theme.dot} opacity-70`} />
                          <span className="text-xs font-bold text-oli-dark whitespace-nowrap">{room.name}</span>
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const dayRecs = recs
                          .filter(r => r.room_name === room.name && isoDay(toSPDate(r.start_time)) === day)
                          .sort((a, b) => a.start_time.localeCompare(b.start_time));
                        return (
                          <td key={day} className="px-2 py-2 align-top border-l border-oli-border">
                            {dayRecs.length === 0 ? (
                              <div className="text-center text-oli-lgray text-xs py-2">—</div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {dayRecs.map(r => {
                                  const profile = (r.profiles as unknown) as { nome: string; plan: string } | null;
                                  const inSess  = r.consultation_started_at && !r.consultation_ended_at;
                                  const done    = r.status === 'completed' || !!r.consultation_ended_at;
                                  return (
                                    <Link
                                      key={r.id}
                                      href={`/salas?date=${day}`}
                                      title={`${profile?.nome ?? '?'} — ${STATUS_LABEL[r.status] ?? r.status}`}
                                      className={`block rounded-md border px-1.5 py-1 text-[10px] leading-tight truncate transition-opacity hover:opacity-80 ${
                                        inSess ? 'bg-green-100 border-green-300 text-green-900' :
                                        done   ? 'bg-gray-100 border-gray-300 text-gray-500' :
                                        `${theme.occ} ${theme.border} ${theme.text}`
                                      }`}
                                    >
                                      <span className="font-bold">{fmtTime(toSPDate(r.start_time))}</span>
                                      {' '}
                                      {profile?.nome?.split(' ')[0] ?? '?'}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline */}
      {viewMode === 'day' && (
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="px-5 py-3 border-b border-oli-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-oli-dark">Timeline do dia</h2>
          <div className="flex gap-3 text-[10px] font-semibold text-oli-lgray">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-300 inline-block" />Em sessão</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200 inline-block" />Agendado</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300 inline-block" />Concluído</span>
          </div>
        </div>

        <div className="px-5 py-4 overflow-x-auto">
          {/* Hour labels */}
          <div className="flex mb-3 pl-20">
            <div className="relative flex-1" style={{ minWidth: 600 }}>
              {Array.from({ length: GRID_HOURS + 1 }, (_, i) => (
                <span
                  key={i}
                  className="absolute text-[9px] text-oli-lgray font-medium -translate-x-1/2"
                  style={{ left: `${(i / GRID_HOURS * 100).toFixed(2)}%` }}
                >
                  {String(GRID_START + i).padStart(2, '0')}h
                </span>
              ))}
            </div>
          </div>

          {/* Room rows */}
          <div className="space-y-2" style={{ minWidth: 620 }}>
            {rooms.map((room, idx) => {
              const theme    = PALETTE[idx % PALETTE.length];
              const roomRecs = recs.filter(r => r.room_name === room.name);
              const hasActive = roomRecs.some(r => r.consultation_started_at && !r.consultation_ended_at);

              return (
                <div key={room.id} className="flex items-center gap-3">
                  {/* Room label */}
                  <div className="w-20 shrink-0 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${hasActive ? `${theme.dot} animate-pulse` : theme.dot} opacity-70`} />
                    <span className="text-xs font-bold text-oli-dark">{room.name}</span>
                  </div>

                  {/* Timeline strip */}
                  <div className={`relative flex-1 h-10 rounded-lg ${theme.free}`} style={{ minWidth: 560 }}>
                    {/* Hour grid lines */}
                    {Array.from({ length: GRID_HOURS - 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-white/70"
                        style={{ left: `${((i + 1) / GRID_HOURS * 100).toFixed(2)}%` }}
                      />
                    ))}

                    {/* Now line */}
                    {nowPct && nowHour >= GRID_START && nowHour <= GRID_START + GRID_HOURS && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-oli-red z-10"
                        style={{ left: nowPct }}
                      />
                    )}

                    {/* Reservations */}
                    {roomRecs.map(r => {
                      const rStart = toSPDate(r.start_time);
                      const rEnd   = toSPDate(r.end_time);
                      const sh = rStart.getHours() + rStart.getMinutes() / 60;
                      const eh = rEnd.getHours()   + rEnd.getMinutes()   / 60;
                      const left   = pct(Math.max(sh, GRID_START));
                      const width  = durPct(
                        new Date(Math.max(rStart.getTime(), new Date(`${selDate}T${String(GRID_START).padStart(2,'0')}:00`).getTime())),
                        new Date(Math.min(rEnd.getTime(), new Date(`${selDate}T${String(GRID_START + GRID_HOURS).padStart(2,'0')}:00`).getTime()))
                      );

                      const inSess = r.consultation_started_at && !r.consultation_ended_at;
                      const done   = r.status === 'completed' || !!r.consultation_ended_at;

                      const profile = (r.profiles as unknown) as { nome: string; plan: string } | null;

                      return (
                        <ReservationBlock
                          key={r.id}
                          id={r.id}
                          professionalId={r.professional_id}
                          professionalName={profile?.nome ?? null}
                          plan={profile?.plan ?? null}
                          roomName={r.room_name}
                          startTime={r.start_time}
                          endTime={r.end_time}
                          status={r.status}
                          statusLabel={STATUS_LABEL[r.status] ?? r.status}
                          arrivedAt={r.arrived_at ?? null}
                          consultationStartedAt={r.consultation_started_at ?? null}
                          consultationEndedAt={r.consultation_ended_at ?? null}
                          left={left}
                          width={width}
                          inSess={!!inSess}
                          done={done}
                          occClass={theme.occ}
                          borderClass={theme.border}
                          textClass={theme.text}
                        />
                      );
                    })}
                  </div>

                  {/* Status */}
                  <div className="w-20 shrink-0 text-right">
                    {hasActive ? (
                      <span className="text-[10px] font-bold text-red-600">● Em sessão</span>
                    ) : roomRecs.some(r => {
                      const sp = toSPDate(r.start_time);
                      return sp > nowSP && r.status !== 'cancelled';
                    }) ? (
                      <span className="text-[10px] font-semibold text-yellow-600">Próxima</span>
                    ) : (
                      <span className="text-[10px] text-oli-lgray">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Reservations table */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="px-5 py-3 border-b border-oli-border">
          <h2 className="text-sm font-bold text-oli-dark">
            {viewMode === 'week' ? 'Reservas da semana' : 'Reservas do dia'}
            <span className="ml-2 font-normal text-oli-lgray">({recs.length})</span>
          </h2>
        </div>
        {recs.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
            {viewMode === 'week' ? 'Nenhuma reserva para esta semana' : 'Nenhuma reserva para este dia'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {(viewMode === 'week'
                    ? ['Dia', 'Hora', 'Médico', 'Sala', 'Duração', 'Status', 'Check-in']
                    : ['Hora', 'Médico', 'Sala', 'Duração', 'Status', 'Check-in']
                  ).map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {recs.map(r => {
                  const profile = (r.profiles as unknown) as { nome: string; plan: string } | null;
                  const rStart  = toSPDate(r.start_time);
                  const rEnd    = toSPDate(r.end_time);
                  const durMin  = Math.round((rEnd.getTime() - rStart.getTime()) / 60000);
                  const inSess  = r.consultation_started_at && !r.consultation_ended_at;
                  return (
                    <tr key={r.id} className={`hover:bg-stone-50 transition-colors ${inSess ? 'bg-green-50/40' : ''}`}>
                      {viewMode === 'week' && (
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                          {rStart.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')}
                        </td>
                      )}
                      <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">
                        {fmtTime(rStart)} – {fmtTime(rEnd)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/medicos/${r.professional_id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                          {profile?.nome ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-oli-gray">{r.room_name}</td>
                      <td className="px-4 py-3 text-oli-gray">
                        {durMin < 60 ? `${durMin}min` : `${Math.floor(durMin/60)}h${durMin%60 > 0 ? ` ${durMin%60}min` : ''}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inSess            ? 'bg-green-100 text-green-700' :
                          r.status === 'completed' ? 'bg-gray-100 text-gray-500' :
                          r.status === 'no_show'   ? 'bg-red-50 text-red-600' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {inSess ? 'Em sessão' : STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-oli-gray text-xs">
                        {r.arrived_at ? fmtTime(toSPDate(r.arrived_at)) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
