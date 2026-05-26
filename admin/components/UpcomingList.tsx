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
  professional_id: string;
  profiles: { nome: string; plan: string } | null;
}

const ROOM_DOT: Record<string, string> = {
  'Sala 1': 'bg-emerald-500',
  'Sala 2': 'bg-blue-500',
  'Sala 3': 'bg-violet-500',
  'Sala 4': 'bg-amber-500',
  'Sala 5': 'bg-rose-500',
};
const PLAN_COLOR: Record<string, string> = {
  START: 'bg-blue-100 text-blue-700',
  BASE:  'bg-gray-100 text-gray-600',
  PRO:   'bg-green-100 text-oli-green',
  VIP:   'bg-yellow-100 text-yellow-700',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}
function isToday(iso: string) {
  const d = new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const t = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return d === t;
}
function isTomorrow(iso: string) {
  const d = new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const tom = new Date(Date.now() + 86400000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return d === tom;
}

export default function UpcomingList() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const now = new Date().toISOString();
    const in48h = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const { data } = await getSupabaseBrowser()
      .from('reservations')
      .select('id, room_name, start_time, end_time, status, arrived_at, consultation_started_at, professional_id, profiles(nome, plan)')
      .gte('start_time', now)
      .lte('start_time', in48h)
      .not('status', 'in', '("cancelled","no_show")')
      .order('start_time', { ascending: true })
      .limit(30);
    setItems((data as Reservation[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const channel = getSupabaseBrowser()
      .channel('upcoming_reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetch)
      .subscribe();
    return () => { getSupabaseBrowser().removeChannel(channel); };
  }, [fetch]);

  if (loading) {
    return <div className="flex items-center justify-center h-24 text-oli-lgray text-sm">Carregando…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-1">
        <p className="text-oli-lgray text-sm">Sem reservas nas próximas 48h</p>
      </div>
    );
  }

  // Group by day label
  const groups: { label: string; items: Reservation[] }[] = [];
  let currentLabel = '';
  items.forEach(r => {
    const label = isToday(r.start_time) ? 'Hoje' : isTomorrow(r.start_time) ? 'Amanhã' : formatDate(r.start_time);
    if (label !== currentLabel) {
      groups.push({ label, items: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].items.push(r);
  });

  return (
    <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1">
      {groups.map(g => (
        <div key={g.label}>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-widest mb-2 sticky top-0 bg-white py-1">
            {g.label}
          </p>
          <div className="space-y-1">
            {g.items.map(r => {
              const profile = r.profiles as { nome: string; plan: string } | null;
              const dot     = ROOM_DOT[r.room_name] ?? 'bg-gray-400';
              const started = !!r.consultation_started_at;
              const arrived = !!r.arrived_at && !started;

              return (
                <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/medicos/${r.professional_id}`} className="text-sm font-semibold text-oli-dark hover:text-oli-green transition-colors truncate">
                        {profile?.nome ?? '—'}
                      </Link>
                      <span className={`text-[9px] font-bold px-1.5 py-px rounded-full shrink-0 ${PLAN_COLOR[profile?.plan ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                        {profile?.plan}
                      </span>
                    </div>
                    <p className="text-xs text-oli-lgray">
                      {r.room_name} · {formatTime(r.start_time)}–{formatTime(r.end_time)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {started ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Em sessão</span>
                    ) : arrived ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Chegou</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Confirmada</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
