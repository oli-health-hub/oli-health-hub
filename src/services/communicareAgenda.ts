/**
 * Communicare — Agenda de Pacientes (pull CC → App)
 * ─────────────────────────────────────────────────────────────────────────────
 * CC é master da agenda de PACIENTES (consultas).
 * App puxa e exibe: Próximos, Em espera, Em atendimento, Atendidos.
 *
 * IMPORTANTE — lacuna de contrato:
 * O Swagger de staging do CC NÃO expõe (ainda) um endpoint de LISTA de
 * agenda do dia por profissional, nem GET de fila. Existem apenas:
 *   GET /v1/schedule/{id}        (precisa do id)
 *   GET /v1/history              (retorna 1 agendamento por filtro)
 *   POST /v1/queue               (entra na fila — sem GET)
 *
 * Este módulo já está pronto para o endpoint de lista. Quando Heitor
 * confirmar a rota real, ajustar AGENDA_LIST_PATH + o parser.
 * Até lá, `listDaySchedule` retorna [] silenciosamente.
 */

import { supabase } from './supabase';
import { ccIsConfigured, CCApiError } from './communicareApi';
import { isMockEnabled, mockRequest } from './communicareMock';

const PROXY_URL = process.env.EXPO_PUBLIC_COMMUNICARE_PROXY_URL ?? '';

// Rota esperada da lista de agenda do dia. Confirmar com Heitor.
// Provável: GET /v1/agenda?professionalId=X&clinicId=Y&data=YYYY-MM-DD
const AGENDA_LIST_PATH = '/v1/agenda';

// ─── Status normalizado (App) ────────────────────────────────────────────────

export type AppointmentStatus =
  | 'proximo'        // agendado/confirmado, ainda não chegou
  | 'em_espera'      // check-in feito, aguardando
  | 'em_atendimento' // consulta em curso
  | 'atendido'       // concluído
  | 'cancelado';

export interface CCAppointment {
  scheduleId:     string;
  patientId:      string;
  patientName:    string;
  startTime:      string;        // ISO 8601
  procedure?:     string;
  status:         AppointmentStatus;
  isTeleconsultation?: boolean;
}

// ─── Mapeia status bruto CC → normalizado ────────────────────────────────────
// Os valores exatos vêm de AttendanceHistoricalItemDto.status. Mapeamento
// provisório — ajustar quando Heitor confirmar os valores reais.
export function mapCCStatus(raw: string | undefined): AppointmentStatus {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('cancel')) return 'cancelado';
  if (s.includes('espera') || s.includes('aguard') || s.includes('wait') || s.includes('check')) return 'em_espera';
  // "em atendimento" / "atendendo" / "in_progress" — consulta em curso
  if (s.includes('atendimento') || s.includes('atendendo') || s.includes('progress') || s.includes('andamento')) return 'em_atendimento';
  // "atendido" / "finalizado" / "concluído" — encerrado
  if (s.includes('atendid') || s.includes('finaliz') || s.includes('concl') || s.includes('done')) return 'atendido';
  return 'proximo';
}

// ─── HTTP via proxy ──────────────────────────────────────────────────────────

async function cc<T>(path: string): Promise<T> {
  if (isMockEnabled()) {
    try { return await mockRequest<T>(path, 'GET'); }
    catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      throw new CCApiError(status, null, `mock GET ${path} → ${status}`);
    }
  }
  if (!PROXY_URL) throw new CCApiError(0, null, 'proxy não configurado');
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new CCApiError(401, null, 'sem sessão');

  const url = `${PROXY_URL}?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) throw new CCApiError(res.status, parsed, `CC GET ${path} → ${res.status}`);
  return parsed as T;
}

// ─── Lista agenda do dia ─────────────────────────────────────────────────────

interface RawAgendaItem {
  id?:            string | number;
  scheduleId?:    string | number;
  patientId?:     string | number;
  patientName?:   string;
  patient?:       { id?: string | number; name?: string };
  startTime?:     string;
  date?:          string;
  procedure?:     string | { name?: string };
  status?:        string;
  isTeleconsultation?: boolean;
}

export async function listDaySchedule(params: {
  professionalId: string;
  clinicId?:      string;
  date?:          string;   // YYYY-MM-DD (default hoje)
}): Promise<CCAppointment[]> {
  if (!ccIsConfigured()) return [];

  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const qs = new URLSearchParams({ professionalId: params.professionalId, data: date });
  if (params.clinicId) qs.set('clinicId', params.clinicId);

  try {
    const raw = await cc<RawAgendaItem[] | { items?: RawAgendaItem[] }>(
      `${AGENDA_LIST_PATH}?${qs.toString()}`,
    );
    const items: RawAgendaItem[] = Array.isArray(raw) ? raw : (raw.items ?? []);
    return items.map(normalizeAppointment);
  } catch (e) {
    // Endpoint ainda não disponível → silencioso, não quebra o app
    if (e instanceof CCApiError && (e.status === 404 || e.status === 0)) return [];
    return [];
  }
}

function normalizeAppointment(r: RawAgendaItem): CCAppointment {
  const procName = typeof r.procedure === 'string' ? r.procedure : r.procedure?.name;
  return {
    scheduleId:  String(r.scheduleId ?? r.id ?? ''),
    patientId:   String(r.patientId ?? r.patient?.id ?? ''),
    patientName: r.patientName ?? r.patient?.name ?? 'Paciente',
    startTime:   r.startTime ?? r.date ?? '',
    procedure:   procName,
    status:      mapCCStatus(r.status),
    isTeleconsultation: r.isTeleconsultation ?? false,
  };
}

// ─── Agrupamento por bucket ──────────────────────────────────────────────────

export interface AgendaBuckets {
  proximos:       CCAppointment[];
  emEspera:       CCAppointment[];
  emAtendimento:  CCAppointment[];
  atendidos:      CCAppointment[];
}

export function bucketize(appts: CCAppointment[]): AgendaBuckets {
  const byTime = (a: CCAppointment, b: CCAppointment) =>
    a.startTime.localeCompare(b.startTime);
  return {
    proximos:      appts.filter(a => a.status === 'proximo').sort(byTime),
    emEspera:      appts.filter(a => a.status === 'em_espera').sort(byTime),
    emAtendimento: appts.filter(a => a.status === 'em_atendimento').sort(byTime),
    atendidos:     appts.filter(a => a.status === 'atendido').sort(byTime),
  };
}
