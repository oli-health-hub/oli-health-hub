import { createSupabaseServer } from '@/lib/supabase-server';
import { CANCELLED_STATUS_VALUES, normalizeReservationStatus } from '@/lib/reservation-status';
import {
  spDayRange,
  isCheckoutAberto,
  isVencidaSemCheckin,
  assinaturaVencendo,
  limitarComTotal,
  TOLERANCIA_MIN,
  JANELA_VENCIDAS_DIAS,
  JANELA_CONVERSAS_DIAS,
  ASSINATURA_AVISO_DIAS,
} from '@/lib/hoje';
import type { QueueItem } from '@/components/FilaClient';

/** Consultas da tela "Hoje". As regras (o que é pendência) ficam em `lib/hoje.ts`. */

const MS_MIN = 60_000;
const MS_DIA = 86_400_000;
const TIPOS_ATIVIDADE = [
  'new_signup',
  'reservation_created',
  'plan_subscribed',
  'plan_activated',
  'module_purchased',
  'module_activated',
  'hour_package_purchased',
  'hour_package_activated',
];

export interface ReservaHoje {
  id: string;
  room_name: string;
  start_time: string;
  end_time: string;
  status: string | null;
  patient_label: string | null;
  professional_id: string | null;
  profissional: string | null;
}

export interface PendenciaReserva {
  id: string;
  room_name: string;
  start_time: string;
  end_time: string;
  professional_id: string | null;
  profissional: string | null;
}

export interface PendenciaAssinatura {
  id: string;
  professional_id: string | null;
  profissional: string | null;
  ends_at: string;
}

export interface SalaHoje {
  id: number;
  name: string;
  emUso: { profissional: string | null; ate: string } | null;
}

export interface ListaComTotal<T> {
  itens: T[];
  total: number;
}

export interface HojeData {
  /** 'AAAA-MM-DD' do dia de São Paulo. */
  dia: string;
  /** false quando a coluna patient_label ainda não existe no banco. */
  rotulosDisponiveis: boolean;
  reservas: ReservaHoje[];
  checkoutsAbertos: ListaComTotal<PendenciaReserva>;
  vencidasSemCheckin: ListaComTotal<PendenciaReserva>;
  assinaturasVencendo: ListaComTotal<PendenciaAssinatura>;
  leadsAguardando: number;
  conversasAguardando: number;
  salas: SalaHoje[];
  atividade: QueueItem[];
  /** Mensagens de partes que não carregaram (a tela mostra o que conseguiu). */
  avisos: string[];
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServer>>;
type Linha = Record<string, unknown>;

/** Join do Supabase pode vir como objeto ou como lista de um item. */
function um<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function nomeDe(profiles: unknown): string | null {
  return um(profiles as { nome?: string | null } | { nome?: string | null }[] | null)?.nome ?? null;
}

const FILTRO_CANCELADAS = `(${CANCELLED_STATUS_VALUES.map((v) => `"${v}"`).join(',')})`;

async function reservasDoDia(supabase: Supabase, startISO: string, endISO: string, comRotulo: boolean) {
  const colunas = `id, room_name, start_time, end_time, status, professional_id, ${comRotulo ? 'patient_label, ' : ''}profiles(nome)`;
  return supabase
    .from('reservations')
    .select(colunas)
    .gte('start_time', startISO)
    .lte('start_time', endISO)
    .not('status', 'in', FILTRO_CANCELADAS)
    .order('start_time', { ascending: true });
}

export async function carregarHoje(now: Date = new Date()): Promise<HojeData> {
  const supabase = await createSupabaseServer();
  const avisos: string[] = [];
  const { startISO, endISO, label } = spDayRange(now);

  async function tentar<T>(rotulo: string, fn: () => PromiseLike<{ data: T | null; error: unknown }>, padrao: T): Promise<T> {
    try {
      const { data, error } = await fn();
      if (error) {
        avisos.push(`Não foi possível carregar: ${rotulo}.`);
        return padrao;
      }
      return data ?? padrao;
    } catch {
      avisos.push(`Não foi possível carregar: ${rotulo}.`);
      return padrao;
    }
  }

  const corteTolerancia = new Date(now.getTime() - TOLERANCIA_MIN * MS_MIN).toISOString();
  const inicioJanelaVencidas = new Date(now.getTime() - JANELA_VENCIDAS_DIAS * MS_DIA).toISOString();
  const inicioJanelaConversas = new Date(now.getTime() - JANELA_CONVERSAS_DIAS * MS_DIA).toISOString();
  const agoraISO = now.toISOString();
  const fimAvisoAssinatura = new Date(now.getTime() + ASSINATURA_AVISO_DIAS * MS_DIA).toISOString();

  // Reservas do dia: tenta com patient_label; se a coluna ainda não existe, cai para sem ela.
  let rotulosDisponiveis = true;
  let resReservas = await reservasDoDia(supabase, startISO, endISO, true);
  if (resReservas.error) {
    rotulosDisponiveis = false;
    resReservas = await reservasDoDia(supabase, startISO, endISO, false);
  }
  if (resReservas.error) avisos.push('Não foi possível carregar: reservas do dia.');

  const [abertas, vencidas, leads, conversas, assinaturas, rooms, atividade] = await Promise.all([
    tentar<Linha[]>('check-outs abertos', () =>
      supabase
        .from('reservations')
        .select('id, room_name, start_time, end_time, status, professional_id, profiles(nome)')
        .in('status', ['em_uso', 'active'])
        .lt('end_time', corteTolerancia)
        .order('end_time', { ascending: false })
        .limit(200),
      [],
    ),
    tentar<Linha[]>('reservas vencidas', () =>
      supabase
        .from('reservations')
        .select('id, room_name, start_time, end_time, status, professional_id, profiles(nome)')
        .in('status', ['agendado', 'scheduled'])
        .lt('end_time', corteTolerancia)
        .gte('end_time', inicioJanelaVencidas)
        .order('end_time', { ascending: false })
        .limit(200),
      [],
    ),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['novo', 'sem_resposta']),
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'fechada')
      .eq('last_message_direction', 'inbound')
      .gte('last_message_at', inicioJanelaConversas),
    tentar<Linha[]>('assinaturas', () =>
      supabase
        .from('subscriptions')
        .select('id, professional_id, ends_at, status, plans(name), profiles(nome)')
        .eq('status', 'active')
        .gte('ends_at', agoraISO)
        .lte('ends_at', fimAvisoAssinatura)
        .order('ends_at', { ascending: true }),
      [],
    ),
    tentar<Linha[]>('salas', () => supabase.from('rooms').select('id, name').order('id', { ascending: true }), []),
    tentar<Linha[]>('atividade recente', () =>
      supabase
        .from('admin_notifications')
        .select('*, profiles(nome, crm, especialidade, plan, whatsapp)')
        .is('read_at', null)
        .in('type', TIPOS_ATIVIDADE)
        .order('created_at', { ascending: false })
        .limit(10),
      [],
    ),
  ]);

  if (leads.error) avisos.push('Não foi possível carregar: leads.');
  if (conversas.error) avisos.push('Não foi possível carregar: conversas.');

  const reservas: ReservaHoje[] = ((resReservas.data ?? []) as unknown as Linha[]).map((r) => ({
    id: r.id as string,
    room_name: r.room_name as string,
    start_time: r.start_time as string,
    end_time: r.end_time as string,
    status: (r.status as string | null) ?? null,
    patient_label: (r.patient_label as string | null | undefined) ?? null,
    professional_id: (r.professional_id as string | null) ?? null,
    profissional: nomeDe(r.profiles),
  }));

  const paraPendencia = (r: Linha): PendenciaReserva & { status: string | null } => ({
    id: r.id as string,
    room_name: r.room_name as string,
    start_time: r.start_time as string,
    end_time: r.end_time as string,
    status: (r.status as string | null) ?? null,
    professional_id: (r.professional_id as string | null) ?? null,
    profissional: nomeDe(r.profiles),
  });

  const checkoutsAbertos = limitarComTotal(
    abertas.map(paraPendencia).filter((r) => isCheckoutAberto(r, now)),
  );
  const vencidasSemCheckin = limitarComTotal(
    vencidas.map(paraPendencia).filter((r) => isVencidaSemCheckin(r, now)),
  );

  const assinaturasVencendo = limitarComTotal(
    assinaturas
      .map((s) => ({
        id: s.id as string,
        professional_id: (s.professional_id as string | null) ?? null,
        profissional: nomeDe(s.profiles),
        ends_at: s.ends_at as string,
        status: s.status as string,
        planName: um(s.plans as { name?: string | null } | { name?: string | null }[] | null)?.name ?? null,
      }))
      .filter((s) => assinaturaVencendo(s, now))
      .map(({ id, professional_id, profissional, ends_at }) => ({ id, professional_id, profissional, ends_at })),
  );

  const emUsoPorSala = new Map<string, ReservaHoje>();
  for (const r of reservas) {
    if (normalizeReservationStatus(r.status) === 'em_uso') emUsoPorSala.set(r.room_name, r);
  }
  const salas: SalaHoje[] = rooms.map((s) => {
    const nome = s.name as string;
    const uso = emUsoPorSala.get(nome);
    return {
      id: s.id as number,
      name: nome,
      emUso: uso ? { profissional: uso.profissional, ate: uso.end_time } : null,
    };
  });

  return {
    dia: label,
    rotulosDisponiveis,
    reservas,
    checkoutsAbertos,
    vencidasSemCheckin,
    assinaturasVencendo,
    leadsAguardando: leads.count ?? 0,
    conversasAguardando: conversas.count ?? 0,
    salas,
    atividade: atividade as unknown as QueueItem[],
    avisos,
  };
}
