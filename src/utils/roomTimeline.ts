import type { Reservation } from '../models/types';

// ─── Constantes ───────────────────────────────────────────────────────────────

export const DAY_START_MIN = 8 * 60;    // 08:00 → 480 min
export const DAY_END_MIN   = 19 * 60;   // 19:00 → 1140 min
export const DAY_TOTAL_MIN = DAY_END_MIN - DAY_START_MIN; // 660 min

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Segment {
  type:     'free' | 'occupied';
  startMin: number;   // minutos a partir da meia-noite
  endMin:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMinutes(iso: string | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.getHours() * 60 + d.getMinutes();
}

function minToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Construção dos segmentos do dia ─────────────────────────────────────────

/**
 * Retorna os segmentos livre/ocupado para uma sala num dia específico.
 * Sempre começa em 08:00 e termina em 19:00.
 */
export function buildDaySegments(
  date:         Date,
  reservations: Reservation[],
  roomName:     string,
): Segment[] {
  const dateStr = date.toDateString();

  const roomRes = reservations
    .filter(r => r.roomName === roomName && new Date(r.startTime).toDateString() === dateStr)
    .map(r => ({
      start: Math.max(DAY_START_MIN, toMinutes(r.startTime)),
      end:   Math.min(DAY_END_MIN,   toMinutes(r.endTime)),
    }))
    .filter(r => r.start < r.end)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = DAY_START_MIN;

  for (const res of roomRes) {
    if (res.start > cursor) {
      segments.push({ type: 'free',     startMin: cursor,    endMin: res.start });
    }
    segments.push(  { type: 'occupied', startMin: res.start, endMin: res.end   });
    cursor = res.end;
  }
  if (cursor < DAY_END_MIN) {
    segments.push({ type: 'free', startMin: cursor, endMin: DAY_END_MIN });
  }

  return segments;
}

// ─── Texto do próximo horário livre ──────────────────────────────────────────

/**
 * Retorna uma string descrevendo o próximo bloco livre para exibir no card.
 * - Para hoje: considera apenas blocos que ainda não passaram.
 * - Exemplos: "Livre: 10:00–14:00", "Dia todo livre", "Sem horários livres"
 */
export function nextFreeLabel(segments: Segment[], date: Date): string {
  const now     = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const nowMin  = isToday ? toMinutes(now) : DAY_START_MIN;

  const free = segments
    .filter(s => s.type === 'free' && s.endMin > nowMin)
    .map(s => ({
      startMin: Math.max(s.startMin, nowMin),
      endMin:   s.endMin,
    }))
    .filter(s => s.endMin - s.startMin >= 30);

  if (free.length === 0) return 'Sem horários livres';

  const freeMinutes = free.reduce((acc, s) => acc + (s.endMin - s.startMin), 0);
  if (freeMinutes >= DAY_TOTAL_MIN - 30) return 'Dia todo livre';

  // Maior bloco livre
  const biggest = free.reduce((a, b) =>
    (b.endMin - b.startMin) > (a.endMin - a.startMin) ? b : a,
  );
  return `Livre: ${minToHHMM(biggest.startMin)}–${minToHHMM(biggest.endMin)}`;
}

// ─── Blocos livres para lista detalhada ──────────────────────────────────────

export interface FreeBlock {
  startMin: number;
  endMin:   number;
  label:    string;   // "10:00 – 14:00"
  duration: string;   // "4h" / "1h30"
}

function durationStr(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

export function buildFreeBlocks(segments: Segment[], date: Date): FreeBlock[] {
  const now     = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const nowMin  = isToday ? toMinutes(now) : DAY_START_MIN;

  return segments
    .filter(s => s.type === 'free' && s.endMin > nowMin)
    .map(s => {
      const start = Math.max(s.startMin, nowMin);
      const end   = s.endMin;
      const dur   = end - start;
      return {
        startMin: start,
        endMin:   end,
        label:    `${minToHHMM(start)} – ${minToHHMM(end)}`,
        duration: durationStr(dur),
      };
    })
    .filter(b => b.endMin - b.startMin >= 30);
}

// ─── Marcadores de hora para o eixo da timeline ───────────────────────────────

export const HOUR_MARKS = [8, 10, 12, 14, 16, 18] as const;
