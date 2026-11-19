/**
 * Status de reserva: fonte única para o Admin.
 *
 * O banco grava `agendado`, `em_uso`, `concluido` (e `cancelado`). Telas antigas
 * comparavam com os nomes em inglês (`scheduled`, `active`, `completed`...), o
 * que deixava "Em sessão" e "Concluída" errados. Aqui os dois jeitos convergem.
 *
 * Sem imports: este arquivo é testado com `node --test`.
 */

export type ReservationStatusKey =
  | 'agendado'
  | 'em_uso'
  | 'concluido'
  | 'cancelado'
  | 'nao_compareceu'
  | 'desconhecido';

const NORMALIZACAO: Record<string, ReservationStatusKey> = {
  agendado: 'agendado',
  scheduled: 'agendado',
  em_uso: 'em_uso',
  active: 'em_uso',
  concluido: 'concluido',
  completed: 'concluido',
  cancelado: 'cancelado',
  cancelled: 'cancelado',
  nao_compareceu: 'nao_compareceu',
  no_show: 'nao_compareceu',
};

export function normalizeReservationStatus(raw: string | null | undefined): ReservationStatusKey {
  if (!raw) return 'desconhecido';
  return NORMALIZACAO[raw.toLowerCase()] ?? 'desconhecido';
}

const ROTULO: Record<ReservationStatusKey, string> = {
  agendado: 'Agendada',
  em_uso: 'Em sessão',
  concluido: 'Concluída',
  cancelado: 'Cancelada',
  nao_compareceu: 'Não compareceu',
  desconhecido: 'Status desconhecido',
};

export function reservationStatusLabel(key: ReservationStatusKey): string {
  return ROTULO[key];
}

const CLASSE: Record<ReservationStatusKey, string> = {
  agendado: 'bg-blue-50 text-blue-700',
  em_uso: 'bg-green-50 text-oli-green',
  concluido: 'bg-gray-100 text-gray-500',
  cancelado: 'bg-red-50 text-red-600',
  nao_compareceu: 'bg-orange-50 text-orange-600',
  desconhecido: 'bg-gray-100 text-gray-500',
};

export function reservationStatusClass(key: ReservationStatusKey): string {
  return CLASSE[key];
}

/** Todas as grafias que significam "não vai acontecer", para `.not('status', 'in', ...)`. */
export const CANCELLED_STATUS_VALUES: readonly string[] = [
  'cancelado',
  'cancelled',
  'no_show',
  'nao_compareceu',
];
