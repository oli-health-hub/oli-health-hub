'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import Link from 'next/link';

interface Reservation {
  id: string;
  room_name: string;
  start_time: string;
  end_time: string;
  status: string;
  professional_id: string;
  profiles: { nome: string; plan: string } | null;
}

const ROOM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Sala 1': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  'Sala 2': { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300' },
  'Sala 3': { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-300' },
  'Sala 4': { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300' },
  'Sala 5': { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-300' },
};

const SP = 'America/Sao_Paulo';
const GRID_START = 7;   // 07:00
const GRID_END   = 22;  // 22:00
const HOURS      = GRID_END - GRID_START; // 15
const SLOT_H     = 56;  // px per hour
const GRID_H     = HOURS * SLOT_H;

function toSP(iso: string) {
  // Returns a Date that, when using getHours/getMinutes, gives São Paulo local values
  const d = new Date(iso);
  // Use toLocaleString to get SP time parts
  const sp = new Date(d.toLocaleString('en-US', { timeZone: SP }));
  return sp;
}

function getWeekDays(refDate: Date): Date[] {
  const spNow = new Date(refDate.toLocaleString('en-US', { timeZone: SP }));
  const dow = spNow.getDay(); // 0=Sun
  const monday = new Date(spNow);
  monday.setDate(spNow.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function topForTime(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, (h - GRID_START) * SLOT_H);
}

function heightForDuration(start: Date, end: Date): number {
  const dh = (end.getTime() - start.getTime()) / 3600000;
  return Math.max(20, dh * SLOT_H);
}

const DAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export default function ReservationCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowLine, setNowLine] = useState(0);

  const refDate = new Date(Date.now() + weekOffset * 7 * 86400000);
  const days = getWeekDays(refDate);

  // Update "now" line every minute
  useEffect(() => {
    function updateLine() {
      const sp = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
      const h = sp.getHours() + sp.getMinutes() / 60;
      setNowLine((h - GRID_START) * SLOT_H);
    }
    updateLine();
    const t = setInterval(updateLine, 60000);
    return () => clearInterval(t);
  }, []);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    const start = days[0].toISOString();
    const end   = new Date(days[6].getTime() + 86399000).toISOString();

    const { data } = await getSupabaseBrowser()
      .from('reservations')
      .select('id, room_name, start_time, end_time, status, professional_id, profiles(nome, plan)')
      .gte('start_time', start)
      .lte('end_time', end)
      .not('status', 'in', '("cancelled","no_show")')
      .order('start_time', { ascending: true });

    setReservations((data as Reservation[]) ?? []);
    setLoading(false);
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const todaySP = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
  const isCurrentWeek = weekOffset === 0;

  const weekLabel = (() => {
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} – ${e.getDate()} de ${MONTHS_PT[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${s.getDate()} ${MONTHS_PT[s.getMonth()]} – ${e.getDate()} ${MONTHS_PT[e.getMonth()]} ${e.getFullYear()}`;
  })();

  return (
    <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-oli-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-oli-dark">Calendário de Reservas</h2>
          <span className="text-xs text-oli-lgray">{weekLabel}</span>
          {loading && <span className="text-xs text-oli-lgray animate-pulse">atualizando…</span>}
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors mr-1"
            >
              Hoje
            </button>
          )}
          <button onClick={() => setWeekOffset(w => w - 1)} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-oli-gray transition-colors">
            ‹
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-oli-gray transition-colors">
            ›
          </button>
        </div>
      </div>

      {/* Room legend */}
      <div className="flex gap-3 px-5 py-2 border-b border-oli-border flex-wrap">
        {Object.entries(ROOM_COLORS).map(([room, c]) => (
          <div key={room} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${c.bg} border ${c.border}`} />
            <span className="text-[10px] text-oli-lgray">{room}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          {/* Day headers */}
          <div className="grid border-b border-oli-border" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
            <div />
            {days.map((d, i) => {
              const isToday = isSameDay(d, todaySP);
              return (
                <div key={i} className={`py-2 text-center border-l border-oli-border ${isToday ? 'bg-oli-green/5' : ''}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-oli-green' : 'text-oli-lgray'}`}>
                    {DAYS_PT[i]}
                  </p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-oli-green' : 'text-oli-dark'}`}>
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
            {/* Hour labels */}
            <div style={{ height: GRID_H }} className="relative">
              {Array.from({ length: HOURS }, (_, i) => (
                <div
                  key={i}
                  className="absolute right-1 text-[9px] text-oli-lgray font-medium"
                  style={{ top: i * SLOT_H - 6 }}
                >
                  {String(GRID_START + i).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, di) => {
              const isToday = isSameDay(day, todaySP);

              // Reservations for this day
              const dayRes = reservations.filter(r => {
                const rs = toSP(r.start_time);
                return isSameDay(rs, day);
              });

              return (
                <div
                  key={di}
                  className={`relative border-l border-oli-border ${isToday ? 'bg-oli-green/[0.02]' : ''}`}
                  style={{ height: GRID_H }}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div key={i} className="absolute w-full border-t border-oli-border/40" style={{ top: i * SLOT_H }} />
                  ))}

                  {/* "Now" line for today */}
                  {isToday && nowLine > 0 && nowLine < GRID_H && (
                    <div
                      className="absolute w-full z-20 flex items-center pointer-events-none"
                      style={{ top: nowLine }}
                    >
                      <div className="w-2 h-2 rounded-full bg-oli-red -ml-1 shrink-0" />
                      <div className="flex-1 h-px bg-oli-red" />
                    </div>
                  )}

                  {/* Reservations */}
                  {dayRes.map(r => {
                    const rStart = toSP(r.start_time);
                    const rEnd   = toSP(r.end_time);
                    const top    = topForTime(rStart);
                    const height = heightForDuration(rStart, rEnd);
                    const colors = ROOM_COLORS[r.room_name] ?? ROOM_COLORS['Sala 1'];
                    const profile = r.profiles as { nome: string; plan: string } | null;

                    return (
                      <Link
                        key={r.id}
                        href={`/medicos/${r.professional_id}`}
                        className={`absolute left-0.5 right-0.5 rounded-md border px-1.5 py-1 overflow-hidden hover:z-10 hover:shadow-md transition-shadow z-10 cursor-pointer ${colors.bg} ${colors.border}`}
                        style={{ top, height }}
                        title={`${r.room_name} — ${profile?.nome ?? ''} | ${new Date(r.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP })}–${new Date(r.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP })}`}
                      >
                        {height >= 28 && (
                          <p className={`text-[10px] font-bold leading-tight truncate ${colors.text}`}>
                            {profile?.nome?.split(' ')[0] ?? r.room_name}
                          </p>
                        )}
                        {height >= 44 && (
                          <p className={`text-[9px] leading-tight truncate ${colors.text} opacity-75`}>
                            {new Date(r.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP })}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
