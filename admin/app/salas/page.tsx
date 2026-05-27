import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Sala Digital'];

const ROOM_THEME: Record<string, { free: string; occ: string; border: string; dot: string; text: string }> = {
  'Sala 1':      { free: 'bg-emerald-50',  occ: 'bg-emerald-200',  border: 'border-emerald-300',  dot: 'bg-emerald-500',  text: 'text-emerald-900' },
  'Sala 2':      { free: 'bg-blue-50',     occ: 'bg-blue-200',     border: 'border-blue-300',     dot: 'bg-blue-500',     text: 'text-blue-900' },
  'Sala 3':      { free: 'bg-violet-50',   occ: 'bg-violet-200',   border: 'border-violet-300',   dot: 'bg-violet-500',   text: 'text-violet-900' },
  'Sala 4':      { free: 'bg-amber-50',    occ: 'bg-amber-200',    border: 'border-amber-300',    dot: 'bg-amber-500',    text: 'text-amber-900' },
  'Sala 5':      { free: 'bg-rose-50',     occ: 'bg-rose-200',     border: 'border-rose-300',     dot: 'bg-rose-500',     text: 'text-rose-900' },
  'Sala 6':      { free: 'bg-teal-50',     occ: 'bg-teal-200',     border: 'border-teal-300',     dot: 'bg-teal-500',     text: 'text-teal-900' },
  'Sala Digital':{ free: 'bg-indigo-50',   occ: 'bg-indigo-200',   border: 'border-indigo-300',   dot: 'bg-indigo-500',   text: 'text-indigo-900' },
};

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

export default async function SalasPage({ searchParams }: { searchParams: { date?: string } }) {
  const supabase = await createSupabaseServer();

  const nowSP  = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
  const selDate = searchParams.date ?? nowSP.toISOString().split('T')[0];

  // Build day window in UTC
  const dayStart = new Date(`${selDate}T00:00:00`);
  const dayEnd   = new Date(`${selDate}T23:59:59`);
  // Shift: São Paulo is UTC-3
  const utcStart = new Date(dayStart.getTime() + 3 * 3600000).toISOString();
  const utcEnd   = new Date(dayEnd.getTime()   + 3 * 3600000).toISOString();

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, room_name, start_time, end_time, status, arrived_at, consultation_started_at, consultation_ended_at, professional_id, profiles(nome, plan)')
    .gte('start_time', utcStart)
    .lte('start_time', utcEnd)
    .not('status', 'in', '("cancelled")')
    .order('start_time', { ascending: true });

  const recs = reservations ?? [];

  const isToday = selDate === nowSP.toISOString().split('T')[0];
  const nowHour = nowSP.getHours() + nowSP.getMinutes() / 60;
  const nowPct  = isToday ? `${((nowHour - GRID_START) / GRID_HOURS * 100).toFixed(2)}%` : null;

  const totalRes      = recs.length;
  const completed     = recs.filter(r => r.status === 'completed').length;
  const inProgress    = recs.filter(r => r.consultation_started_at && !r.consultation_ended_at).length;
  const upcoming      = recs.filter(r => {
    const sp = toSPDate(r.start_time);
    return sp > nowSP;
  }).length;

  // Utilisation %: sum of scheduled minutes / (5 rooms × 15h × 60min)
  const totalScheduledMin = recs.reduce((s, r) => {
    const diff = new Date(r.end_time).getTime() - new Date(r.start_time).getTime();
    return s + diff / 60000;
  }, 0);
  const maxMin = ROOMS.length * GRID_HOURS * 60;
  const utilPct = Math.round((totalScheduledMin / maxMin) * 100);

  const dateLabel = new Date(`${selDate}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="p-7 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Mapa das Salas</h1>
          <p className="text-sm text-oli-gray mt-0.5">{dateLabel}</p>
        </div>

        {/* Date navigator */}
        <form method="GET" className="flex items-center gap-2">
          <Link
            href={`/salas?date=${new Date(new Date(`${selDate}T12:00:00`).getTime() - 86400000).toISOString().split('T')[0]}`}
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
            href={`/salas?date=${new Date(new Date(`${selDate}T12:00:00`).getTime() + 86400000).toISOString().split('T')[0]}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-oli-gray transition-colors text-lg"
          >›</Link>
          {!isToday && (
            <Link href="/salas" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
              Hoje
            </Link>
          )}
        </form>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-dark">{totalRes}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Reservas</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className={`text-2xl font-extrabold ${inProgress > 0 ? 'text-oli-red' : 'text-oli-dark'}`}>{inProgress}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Em sessão</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-yellow-600">{upcoming}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Próximas</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-green">{utilPct}%</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Ocupação</p>
        </div>
      </div>

      {/* Timeline */}
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
            {ROOMS.map(room => {
              const theme = ROOM_THEME[room] ?? ROOM_THEME['Sala 1'];
              const roomRecs = recs.filter(r => r.room_name === room);
              const hasActive = roomRecs.some(r => r.consultation_started_at && !r.consultation_ended_at);

              return (
                <div key={room} className="flex items-center gap-3">
                  {/* Room label */}
                  <div className="w-20 shrink-0 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${hasActive ? `${theme.dot} animate-pulse` : theme.dot} opacity-70`} />
                    <span className="text-xs font-bold text-oli-dark">{room}</span>
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
                        <Link
                          key={r.id}
                          href={`/medicos/${r.professional_id}`}
                          title={`${profile?.nome ?? '?'} | ${fmtTime(rStart)}–${fmtTime(rEnd)} | ${STATUS_LABEL[r.status] ?? r.status}`}
                          className={`absolute top-1 bottom-1 rounded-md border px-1.5 flex items-center overflow-hidden cursor-pointer hover:opacity-90 hover:shadow-sm transition-all z-10 ${
                            inSess
                              ? 'bg-green-200 border-green-400'
                              : done
                              ? 'bg-gray-200 border-gray-300'
                              : `${theme.occ} ${theme.border}`
                          }`}
                          style={{ left, width, minWidth: 4 }}
                        >
                          <span className={`text-[10px] font-bold truncate ${done ? 'text-gray-600' : theme.text}`}>
                            {profile?.nome?.split(' ')[0]}
                          </span>
                        </Link>
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

      {/* Reservations table */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="px-5 py-3 border-b border-oli-border">
          <h2 className="text-sm font-bold text-oli-dark">
            Reservas do dia
            <span className="ml-2 font-normal text-oli-lgray">({recs.length})</span>
          </h2>
        </div>
        {recs.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
            Nenhuma reserva para este dia
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Hora', 'Médico', 'Sala', 'Duração', 'Status', 'Check-in'].map(h => (
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
                      <td className="px-4 py-3 font-semibold text-oli-dark">
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
