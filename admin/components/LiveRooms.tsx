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
  arrived_at: string | null;
  consultation_started_at: string | null;
  consultation_ended_at: string | null;
  professional_id: string;
  profiles: { nome: string; plan: string } | null;
}

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5'];

const ROOM_COLOR: Record<string, { bg: string; border: string; dot: string; bar: string }> = {
  'Sala 1': { bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500',  bar: 'bg-emerald-500' },
  'Sala 2': { bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-500',     bar: 'bg-blue-500' },
  'Sala 3': { bg: 'bg-violet-50',   border: 'border-violet-200',  dot: 'bg-violet-500',   bar: 'bg-violet-500' },
  'Sala 4': { bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-500',    bar: 'bg-amber-500' },
  'Sala 5': { bg: 'bg-rose-50',     border: 'border-rose-200',    dot: 'bg-rose-500',     bar: 'bg-rose-500' },
};

const PLAN_COLOR: Record<string, string> = {
  START: 'bg-blue-100 text-blue-700',
  BASE:  'bg-gray-100 text-gray-600',
  PRO:   'bg-green-100 text-oli-green',
  VIP:   'bg-yellow-100 text-yellow-700',
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

function minutesUntil(iso: string, now: Date): number {
  return Math.floor((new Date(iso).getTime() - now.getTime()) / 60000);
}

export default function LiveRooms() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [now, setNow] = useState(new Date());

  // Tick every second for live timers
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchReservations = useCallback(async () => {
    const windowStart = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // -4h
    const windowEnd   = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2h

    const { data } = await getSupabaseBrowser()
      .from('reservations')
      .select('id, room_name, start_time, end_time, status, arrived_at, consultation_started_at, consultation_ended_at, professional_id, profiles(nome, plan)')
      .gte('end_time', windowStart)
      .lte('start_time', windowEnd)
      .not('status', 'in', '("cancelled","no_show")')
      .order('start_time', { ascending: true });

    setReservations((data as Reservation[]) ?? []);
  }, []);

  useEffect(() => {
    fetchReservations();

    const channel = getSupabaseBrowser()
      .channel('live_reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchReservations)
      .subscribe();

    return () => { getSupabaseBrowser().removeChannel(channel); };
  }, [fetchReservations]);

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
      {ROOMS.map(room => {
        const colors = ROOM_COLOR[room] ?? ROOM_COLOR['Sala 1'];

        // Find the most relevant reservation for this room
        const active = reservations.find(r =>
          r.room_name === room &&
          r.consultation_started_at && !r.consultation_ended_at
        );
        const arrived = !active && reservations.find(r =>
          r.room_name === room &&
          r.arrived_at && !r.consultation_started_at
        );
        const current = !active && !arrived && reservations.find(r =>
          r.room_name === room &&
          new Date(r.start_time) <= now &&
          new Date(r.end_time) >= now
        );
        const upcoming = !active && !arrived && !current && reservations.find(r =>
          r.room_name === room &&
          new Date(r.start_time) > now &&
          minutesUntil(r.start_time, now) <= 60
        );

        const res = active ?? arrived ?? current ?? upcoming;
        const profile = res ? (res.profiles as { nome: string; plan: string } | null) : null;

        const isBusy    = !!(active ?? arrived ?? current);
        const isUpcoming = !isBusy && !!upcoming;
        const isFree    = !isBusy && !isUpcoming;

        // Progress bar: how far through the scheduled time
        let progress = 0;
        if (res && isBusy) {
          const start = new Date(res.start_time).getTime();
          const end   = new Date(res.end_time).getTime();
          progress = Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100));
        }

        // Elapsed since session start (or since start_time if no consultation_started_at)
        const sessionRef = active?.consultation_started_at ?? (current ? current.start_time : null);
        const elapsed = sessionRef ? now.getTime() - new Date(sessionRef).getTime() : 0;

        // Time remaining until end
        const minsRemaining = res ? minutesUntil(res.end_time, now) : null;
        const minsUntilStart = upcoming ? minutesUntil(upcoming.start_time, now) : null;

        return (
          <div
            key={room}
            className={`rounded-2xl border p-4 transition-all ${
              isBusy
                ? `${colors.bg} ${colors.border}`
                : isUpcoming
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-white border-oli-border'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  isBusy
                    ? `${colors.dot} animate-pulse`
                    : isUpcoming
                    ? 'bg-yellow-400'
                    : 'bg-gray-300'
                }`} />
                <span className="text-sm font-bold text-oli-dark">{room}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                active
                  ? 'bg-red-100 text-red-700'
                  : arrived
                  ? 'bg-orange-100 text-orange-700'
                  : current
                  ? 'bg-green-100 text-oli-green'
                  : isUpcoming
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {active   ? 'Em sessão'
                  : arrived  ? 'Aguardando'
                  : current  ? 'Reservado'
                  : isUpcoming ? 'Em breve'
                  : 'Livre'}
              </span>
            </div>

            {/* Content */}
            {res && profile ? (
              <>
                <Link href={`/medicos/${res.professional_id}`} className="block group">
                  <p className="text-sm font-semibold text-oli-dark group-hover:text-oli-green transition-colors leading-tight truncate">
                    {profile.nome}
                  </p>
                </Link>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PLAN_COLOR[profile.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                    {profile.plan}
                  </span>
                  <span className="text-xs text-oli-lgray">
                    {formatTime(res.start_time)} – {formatTime(res.end_time)}
                  </span>
                </div>

                {/* Live timer (only when in session) */}
                {(active || current) && elapsed > 0 && (
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-oli-dark tabular-nums leading-none">
                        {formatElapsed(elapsed)}
                      </span>
                      {minsRemaining !== null && minsRemaining > 0 && (
                        <span className={`text-xs font-semibold ${minsRemaining < 15 ? 'text-oli-red' : 'text-oli-lgray'}`}>
                          {minsRemaining < 15 ? `⚠ ${minsRemaining}min restantes` : `${minsRemaining}min restantes`}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${progress > 85 ? 'bg-oli-red' : colors.bar}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Upcoming countdown */}
                {isUpcoming && minsUntilStart !== null && upcoming && (
                  <div className="mt-3">
                    <p className="text-sm font-bold text-yellow-700">
                      Começa em {minsUntilStart}min
                    </p>
                    <p className="text-xs text-yellow-600 mt-0.5">
                      {formatTime(upcoming.start_time)}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-oli-lgray mt-1">Sem reserva</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
