import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;
const SP = 'America/Sao_Paulo';

const STATUS_LABEL: Record<string, string> = {
  agendado:  'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  no_show:   'No-show',
  cancelled: 'Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  agendado:  'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-oli-green',
  completed: 'bg-gray-100 text-gray-500',
  no_show:   'bg-red-50 text-oli-red',
  cancelled: 'bg-red-50 text-oli-red',
};
const PLAN_COLOR: Record<string, string> = {
  START: 'bg-blue-50 text-blue-600',
  BASE:  'bg-gray-100 text-gray-600',
  PRO:   'bg-green-50 text-oli-green',
  VIP:   'bg-yellow-50 text-yellow-700',
};

function toSPDate(iso: string) {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: SP }));
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDur(min: number) {
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`;
}

interface SearchParams {
  page?: string;
  room?: string;
  professional?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export default async function HistoricoPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServer();

  const page     = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const room     = searchParams.room ?? '';
  const profName = searchParams.professional ?? '';
  const status   = searchParams.status ?? '';
  const nowSP    = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));

  // Default: last 30 days
  const defaultEnd   = nowSP.toISOString().split('T')[0];
  const defaultStart = new Date(nowSP.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const startDate = searchParams.start_date ?? defaultStart;
  const endDate   = searchParams.end_date   ?? defaultEnd;

  // Build UTC window (SP is UTC-3)
  const utcStart = new Date(`${startDate}T00:00:00`);
  utcStart.setTime(utcStart.getTime() + 3 * 3600000);
  const utcEnd = new Date(`${endDate}T23:59:59`);
  utcEnd.setTime(utcEnd.getTime() + 3 * 3600000);

  // Fetch reservations
  let query = supabase
    .from('reservations')
    .select('id, room_name, start_time, end_time, status, arrived_at, consultation_started_at, consultation_ended_at, professional_id, profiles(id, nome, plan, crm)', { count: 'exact' })
    .gte('start_time', utcStart.toISOString())
    .lte('start_time', utcEnd.toISOString())
    .order('start_time', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  if (room)   query = query.eq('room_name', room);
  if (status) query = query.eq('status', status);

  const { data: reservations, count } = await query;

  // If filtering by professional name, do it client-side (Supabase doesn't support join filters easily)
  let recs = ((reservations ?? []) as unknown) as Array<{
    id: string; room_name: string; start_time: string; end_time: string;
    status: string; arrived_at: string | null; consultation_started_at: string | null;
    consultation_ended_at: string | null; professional_id: string;
    profiles: { id: string; nome: string; plan: string; crm: string | null } | null;
  }>;

  if (profName) {
    const q = profName.toLowerCase();
    recs = recs.filter(r => {
      const p = r.profiles;
      return p?.nome?.toLowerCase().includes(q) || p?.crm?.toLowerCase().includes(q);
    });
  }

  // Fetch usage_charges for these reservations to show billed amount
  const reservationIds = recs.map(r => r.id);
  const { data: charges } = reservationIds.length > 0
    ? await supabase
        .from('usage_charges')
        .select('reservation_id, valor_total, minutos')
        .in('reservation_id', reservationIds)
    : { data: [] };

  const chargeMap: Record<string, { valor: number; min: number }> = {};
  (charges ?? []).forEach(c => {
    if (c.reservation_id) chargeMap[c.reservation_id] = { valor: c.valor_total ?? 0, min: c.minutos ?? 0 };
  });

  // Aggregate stats for the current page/filter
  const { data: statsData } = await supabase
    .from('reservations')
    .select('start_time, end_time, status')
    .gte('start_time', utcStart.toISOString())
    .lte('start_time', utcEnd.toISOString());

  const totalReservations = statsData?.length ?? 0;
  const completedCount    = (statsData ?? []).filter(r => r.status === 'completed').length;
  const noShowCount       = (statsData ?? []).filter(r => r.status === 'no_show').length;
  const totalScheduledMin = (statsData ?? []).reduce((s, r) => {
    return s + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000;
  }, 0);

  const { data: revenueData } = await supabase
    .from('usage_charges')
    .select('valor_total')
    .gte('iniciado_em', utcStart.toISOString())
    .lte('iniciado_em', utcEnd.toISOString());
  const totalRevenue = (revenueData ?? []).reduce((s, c) => s + (c.valor_total ?? 0), 0);

  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);

  // Build URL helper for pagination/filters
  function buildUrl(params: Record<string, string | number>) {
    const base: Record<string, string> = {
      start_date: startDate, end_date: endDate,
      ...(room ? { room } : {}),
      ...(profName ? { professional: profName } : {}),
      ...(status ? { status } : {}),
    };
    Object.entries(params).forEach(([k, v]) => { if (v) base[k] = String(v); else delete base[k]; });
    return '/historico?' + new URLSearchParams(base).toString();
  }

  return (
    <div className="p-7 space-y-6">

      {/* Header */}
      <h1 className="text-xl font-bold text-oli-dark">Histórico de Utilização</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-dark">{totalReservations}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Reservas</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-dark">{fmtDur(Math.round(totalScheduledMin))}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Horas agendadas</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-green">
            {totalRevenue > 0 ? `R$ ${totalRevenue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : '—'}
          </p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">Receita cobrada</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4 text-center">
          <p className="text-2xl font-extrabold text-oli-red">{noShowCount}</p>
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">No-shows</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" action="/historico" className="bg-white rounded-2xl border border-oli-border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">De</label>
            <input type="date" name="start_date" defaultValue={startDate}
              className="text-sm border border-oli-border rounded-lg px-3 py-1.5 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Até</label>
            <input type="date" name="end_date" defaultValue={endDate}
              className="text-sm border border-oli-border rounded-lg px-3 py-1.5 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Sala</label>
            <select name="room" defaultValue={room}
              className="text-sm border border-oli-border rounded-lg px-3 py-1.5 text-oli-dark bg-white focus:outline-none focus:ring-1 focus:ring-oli-green">
              <option value="">Todas</option>
              {['Sala 1','Sala 2','Sala 3','Sala 4','Sala 5','Sala 6','Sala Digital'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Status</label>
            <select name="status" defaultValue={status}
              className="text-sm border border-oli-border rounded-lg px-3 py-1.5 text-oli-dark bg-white focus:outline-none focus:ring-1 focus:ring-oli-green">
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-36">
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Médico / CRM</label>
            <input type="text" name="professional" defaultValue={profName} placeholder="Buscar…"
              className="w-full text-sm border border-oli-border rounded-lg px-3 py-1.5 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green" />
          </div>
          <button type="submit"
            className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
            Filtrar
          </button>
          <Link href="/historico"
            className="text-sm font-semibold px-4 py-1.5 rounded-lg border border-oli-border text-oli-gray hover:bg-stone-50 transition-colors">
            Limpar
          </Link>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="px-5 py-3 border-b border-oli-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-oli-dark">
            Reservas
            <span className="ml-2 font-normal text-oli-lgray">({count ?? 0} total · página {page}/{totalPages || 1})</span>
          </h2>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link href={buildUrl({ page: page - 1 })}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-oli-border text-oli-gray hover:bg-stone-50 transition-colors">
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: page + 1 })}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
                Próxima →
              </Link>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {['Data', 'Horário', 'Médico', 'CRM', 'Plano', 'Sala', 'Duração', 'Status', 'Check-in', 'Cobrado'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {recs.map(r => {
                const profile  = r.profiles;
                const rStart   = toSPDate(r.start_time);
                const rEnd     = toSPDate(r.end_time);
                const durMin   = Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000);
                const charge   = chargeMap[r.id];
                return (
                  <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 text-oli-gray whitespace-nowrap">{fmtDate(rStart)}</td>
                    <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">{fmtTime(rStart)}–{fmtTime(rEnd)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/medicos/${r.professional_id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                        {profile?.nome ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-oli-lgray">{profile?.crm ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PLAN_COLOR[profile?.plan ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                        {profile?.plan ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-oli-gray">{r.room_name}</td>
                    <td className="px-4 py-3 text-oli-gray">{fmtDur(durMin)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                      {r.arrived_at ? fmtTime(toSPDate(r.arrived_at)) : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">
                      {charge ? `R$ ${charge.valor.toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {recs.length === 0 && (
            <div className="flex items-center justify-center py-12 text-oli-lgray text-sm">
              Nenhuma reserva encontrada para os filtros selecionados
            </div>
          )}
        </div>

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-oli-border">
            <span className="text-xs text-oli-lgray">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, count ?? 0)} de {count ?? 0}
            </span>
            <div className="flex gap-1">
              {page > 1 && (
                <Link href={buildUrl({ page: page - 1 })} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-oli-border text-oli-gray hover:bg-stone-50 transition-colors">
                  ← Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildUrl({ page: page + 1 })} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
                  Próxima →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
