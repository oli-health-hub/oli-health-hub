/**
 * Regras puras da tela "Hoje": janela do dia em São Paulo e o que conta como pendência.
 * Sem acesso a banco e sem imports com alias `@/` (testado com `node --test`).
 */
import { normalizeReservationStatus } from './reservation-status.ts';

export const TOLERANCIA_MIN = 30;
export const JANELA_VENCIDAS_DIAS = 14;
export const LIMITE_LINHAS = 10;
export const JANELA_CONVERSAS_DIAS = 7;
export const ASSINATURA_AVISO_DIAS = 7;

const MS_MIN = 60_000;
const MS_DIA = 86_400_000;
/** São Paulo é UTC−3 o ano todo (sem horário de verão desde 2019). */
const SP_OFFSET_MS = 3 * 60 * MS_MIN;

export function spDayRange(now: Date): { startISO: string; endISO: string; label: string } {
  const spNow = new Date(now.getTime() - SP_OFFSET_MS);
  const label = spNow.toISOString().slice(0, 10);
  const startMs = Date.parse(`${label}T00:00:00.000Z`) + SP_OFFSET_MS;
  return {
    label,
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(startMs + MS_DIA - 1).toISOString(),
  };
}

export interface ReservaMin {
  id: string;
  status: string | null;
  start_time: string;
  end_time: string;
}

function passouDaTolerancia(endTime: string, now: Date): boolean {
  return now.getTime() > new Date(endTime).getTime() + TOLERANCIA_MIN * MS_MIN;
}

export function isCheckoutAberto(r: ReservaMin, now: Date): boolean {
  return normalizeReservationStatus(r.status) === 'em_uso' && passouDaTolerancia(r.end_time, now);
}

export function isVencidaSemCheckin(r: ReservaMin, now: Date): boolean {
  if (normalizeReservationStatus(r.status) !== 'agendado') return false;
  if (!passouDaTolerancia(r.end_time, now)) return false;
  return new Date(r.end_time).getTime() >= now.getTime() - JANELA_VENCIDAS_DIAS * MS_DIA;
}

export function assinaturaVencendo(
  s: { status: string; ends_at: string | null; planName: string | null },
  now: Date,
): boolean {
  if (s.status !== 'active' || s.planName !== 'PRO' || !s.ends_at) return false;
  const fim = new Date(s.ends_at).getTime();
  return fim >= now.getTime() && fim <= now.getTime() + ASSINATURA_AVISO_DIAS * MS_DIA;
}

export function limitarComTotal<T>(itens: T[], limite: number = LIMITE_LINHAS): { itens: T[]; total: number } {
  return { itens: itens.slice(0, limite), total: itens.length };
}

/** A reserva começa dentro do dia de São Paulo de `now`? (regra de quais reservas aceitam rótulo de paciente) */
export function startNoDia(startTime: string, now: Date): boolean {
  const { startISO, endISO } = spDayRange(now);
  return startTime >= startISO && startTime <= endISO;
}

/** Quantas pendências o cabeçalho anuncia: Comercial (leads, conversas) conta uma linha cada, o resto conta item a item. */
export function contarPendencias(p: {
  checkouts: number;
  vencidas: number;
  assinaturas: number;
  leads: number;
  conversas: number;
}): number {
  return p.checkouts + p.vencidas + p.assinaturas + (p.leads > 0 ? 1 : 0) + (p.conversas > 0 ? 1 : 0);
}
