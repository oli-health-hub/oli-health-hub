/**
 * Communicare API Client (Real)
 * ─────────────────────────────────────────────────────────────────────────────
 * Substitui gradualmente o mock em `communicare.ts`.
 * Toda chamada passa pela Edge Function `communicare-proxy`, que injeta
 * x-sso-api-key server-side. Token nunca chega ao app.
 *
 * Endpoints (Communicare Swagger):
 *   SSO médico           GET    /v1/sso/{cpf}
 *   Pacientes            GET/POST/PUT/DELETE /v1/patient
 *   Convênios            GET    /v1/health-plans
 *   Histórico            GET    /v1/history
 *   Profissionais        GET    /v1/agenda/professionals
 *   Procedimentos        GET    /v1/agenda/professional-procedures
 *   Agenda (standby)     POST/DELETE /v1/agenda  (aguardando liberação CC)
 *   Fila                 POST   /v1/queue
 *
 * Quando tokens chegarem: setar EXPO_PUBLIC_COMMUNICARE_PROXY_URL no app +
 * CC_API_KEY/CC_SSO_KEY no Supabase env. Resto funciona.
 */

import { supabase } from './supabase';
import { isMockEnabled, mockRequest } from './communicareMock';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CCPatient {
  id?:              string;
  name:             string;
  cpf:              string;       // cleartext, só via HTTPS
  birthDate:        string;       // YYYY-MM-DD
  phone:            string;
  email?:           string;
  gender?:          'M' | 'F' | 'O';
  address?: {
    street?:        string;
    number?:        string;
    complement?:    string;
    neighborhood?:  string;
    city?:          string;
    state?:         string;
    zipCode?:       string;
  };
  healthPlanId?:    string;
  healthPlanCard?:  string;
  externalId?:      string;       // = OLI patient id, chave de vínculo
}

export interface CCHealthPlan {
  id:           string;
  name:         string;
  ansCode?:     string;
}

export interface CCHistoryEntry {
  scheduleId:       string;
  date:             string;       // ISO 8601
  professionalName: string;
  procedure?:       string;
  status:           string;
  notes?:           string;
}

export interface CCProfessional {
  id:            string;
  name:          string;
  cpf:           string;
  specialties:   string[];
  procedures:    string[];
}

export interface CCSSO {
  jwt:            string;
  expiresAt:      string;
  professionalId: string;
}

export interface CCScheduleCreate {
  professionalId:      string;
  clinicId:            string;
  patientId:           string;
  procedure:           string;
  startTime:           string;       // ISO 8601
  endTime:             string;
  isTeleconsultation?: boolean;
}

// ─── HTTP Client via Edge Proxy ──────────────────────────────────────────────

const PROXY_URL = process.env.EXPO_PUBLIC_COMMUNICARE_PROXY_URL ?? '';

export class CCApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = 'CCApiError';
  }
}

async function cc<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?:  unknown,
): Promise<T> {
  // Simulador: responde local sem token nem rede
  if (isMockEnabled()) {
    try {
      return await mockRequest<T>(path, method, body);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      throw new CCApiError(status, null, `mock ${method} ${path} → ${status}`);
    }
  }

  if (!PROXY_URL) {
    throw new CCApiError(0, null, 'COMMUNICARE_PROXY_URL não configurado');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new CCApiError(401, null, 'sem sessão Supabase');

  const url = `${PROXY_URL}?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

  if (!res.ok) {
    throw new CCApiError(res.status, parsed, `CC ${method} ${path} → ${res.status}`);
  }
  return parsed as T;
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export async function ccFindPatientByCPF(cpf: string): Promise<CCPatient | null> {
  try {
    const result = await cc<CCPatient[] | CCPatient>(`/v1/patient?cpf=${cpf}`, 'GET');
    if (Array.isArray(result)) return result.length > 0 ? result[0] : null;
    return result ?? null;
  } catch (e) {
    if (e instanceof CCApiError && e.status === 404) return null;
    throw e;
  }
}

export async function ccCreatePatient(patient: CCPatient): Promise<CCPatient> {
  return cc<CCPatient>('/v1/patient', 'POST', patient);
}

export async function ccUpdatePatient(
  id: string,
  patient: Partial<CCPatient>,
): Promise<CCPatient> {
  return cc<CCPatient>(`/v1/patient/${id}`, 'PUT', patient);
}

export async function ccDeletePatient(id: string): Promise<void> {
  await cc<void>(`/v1/patient/${id}`, 'DELETE');
}

// ─── Health Plans ────────────────────────────────────────────────────────────

export async function ccListHealthPlans(): Promise<CCHealthPlan[]> {
  return cc<CCHealthPlan[]>('/v1/health-plans', 'GET');
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function ccGetPatientHistory(patientId: string): Promise<CCHistoryEntry[]> {
  return cc<CCHistoryEntry[]>(`/v1/history?patientId=${patientId}`, 'GET');
}

// ─── Professionals & Procedures ──────────────────────────────────────────────

export async function ccListProfessionals(): Promise<CCProfessional[]> {
  return cc<CCProfessional[]>('/v1/agenda/professionals', 'GET');
}

export async function ccListProcedures(professionalId: string): Promise<string[]> {
  return cc<string[]>(
    `/v1/agenda/professional-procedures?professionalId=${professionalId}`,
    'GET',
  );
}

// ─── SSO Médico ──────────────────────────────────────────────────────────────

export async function ccSSO(cpf: string): Promise<CCSSO> {
  return cc<CCSSO>(`/v1/sso/${cpf}`, 'GET');
}

// ─── Agenda (standby) ────────────────────────────────────────────────────────

export async function ccCreateSchedule(s: CCScheduleCreate): Promise<{
  id: string;
  teleconsultationLink?: string;
  paymentLink?: string;
}> {
  return cc('/v1/agenda', 'POST', s);
}

export async function ccCancelSchedule(id: string): Promise<void> {
  await cc<void>(`/v1/agenda/${id}`, 'DELETE');
}

// ─── Fila ────────────────────────────────────────────────────────────────────

export async function ccAddToQueue(queueId: string, patientId: string): Promise<void> {
  await cc<void>('/v1/queue', 'POST', { queueId, patientId });
}

// ─── Health check ────────────────────────────────────────────────────────────

export function ccIsConfigured(): boolean {
  return isMockEnabled() || !!PROXY_URL;
}
