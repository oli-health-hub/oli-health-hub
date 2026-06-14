/**
 * Luma Events Service
 *
 * Interface pronta para a API pública do Luma (lu.ma).
 * Na Fase 3 substituir o mock pela chamada real:
 *   GET https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=<LUMA_CALENDAR_ID>
 *
 * Documentação: https://docs.lu.ma/reference/getting-started
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LumaEvent {
  id:          string;
  title:       string;
  description: string;
  startAt:     string;   // ISO 8601
  endAt:       string;   // ISO 8601
  coverUrl?:   string;   // URL da imagem de capa do Luma
  eventUrl:    string;   // https://lu.ma/xxx — abre no app Luma ou browser
  location:    string;
  isFree:      boolean;
  guestCount:  number;
  tags:        string[];
}

// ── Interface do serviço ─────────────────────────────────────────────────────

interface ILumaService {
  /** Retorna os próximos eventos públicos do calendário OLI */
  getUpcomingEvents(): Promise<LumaEvent[]>;
}

// ── Mock ─────────────────────────────────────────────────────────────────────

const MOCK_EVENTS: LumaEvent[] = [
  {
    id:          'luma-8mxd9bua',
    title:       'Café da manhã com parceiros OLI',
    description: 'Um encontro matinal para alinhar as estratégias de parceria do ecossistema OLI Health Hub. A pauta inclui apresentações mútuas entre os parceiros, definição clara do produto OLI e mapeamento dos serviços que cada um oferece ao longo da jornada do médico.',
    startAt:     '2026-05-14T08:30:00-03:00',
    endAt:       '2026-05-14T11:30:00-03:00',
    coverUrl:    'https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=400,height=400/uploads/iq/725359df-bef2-478f-8a8f-c5f7ebc30a52.jpg',
    eventUrl:    'https://lu.ma/8mxd9bua',
    location:    'OLI Health Hub · R. Marquês de Paranaguá, 348 — 6º andar, Consolação',
    isFree:      true,
    guestCount:  4,
    tags:        ['Parceiros', 'Networking'],
  },
  {
    id:          'luma-002',
    title:       'Workshop LGPD na Saúde',
    description: 'Como adequar seu consultório à Lei Geral de Proteção de Dados. Prontuários digitais, consentimento e boas práticas com a Ana Luiza.',
    startAt:     new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    endAt:       new Date(Date.now() + 21 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
    eventUrl:    'https://lu.ma/oli-lgpd-saude',
    location:    'OLI Health Hub · Online + Presencial',
    isFree:      false,
    guestCount:  14,
    tags:        ['Jurídico', 'LGPD'],
  },
];

// ── Config ────────────────────────────────────────────────────────────────────

// Feed iCal público do calendário OLI no Luma (sem API key / sem plano Plus).
// Atualiza sozinho a cada evento criado no Luma (REFRESH-INTERVAL PT12H).
const LUMA_CALENDAR_ID = process.env.EXPO_PUBLIC_LUMA_CALENDAR_ID ?? 'cal-BHFzthdc75sAu98';
const LUMA_ICS_URL =
  process.env.EXPO_PUBLIC_EVENTS_ICS_URL ??
  `https://api.lu.ma/ics/get?entity=calendar&id=${LUMA_CALENDAR_ID}`;

/** True quando há um feed de eventos configurado (sempre, via fallback OLI). */
export function lumaIsConfigured(): boolean {
  return !!LUMA_ICS_URL;
}

// ── Parser iCal (RFC 5545, mínimo necessário) ────────────────────────────────

/** Desfaz line-folding: linhas continuadas começam com espaço ou tab. */
function unfoldICS(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Desescapa texto iCal: \n \, \; \\ */
function unescapeICS(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** Converte DTSTART/DTEND iCal para ISO 8601. Trata Z, TZID e VALUE=DATE. */
function icsDateToISO(value: string): string | null {
  const v = value.trim();
  // YYYYMMDD (data sem hora)
  const dateOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
  }
  // YYYYMMDDTHHMMSS(Z)
  const dt = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dt) {
    const [, y, mo, d, h, mi, s, z] = dt;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`;
    const parsed = new Date(iso);
    return isNaN(parsed.getTime()) ? null : (z ? parsed.toISOString() : iso);
  }
  const fallback = new Date(v);
  return isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

/** Quebra "KEY;PARAM=x:VALUE" em { key, value }. */
function splitICSLine(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  const keyPart = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const key = keyPart.split(';')[0].toUpperCase();
  return { key, value };
}

/** Parseia um VCALENDAR em LumaEvent[]. Exportado p/ teste. */
export function parseICS(raw: string): LumaEvent[] {
  const lines = unfoldICS(raw);
  const events: LumaEvent[] = [];
  let cur: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur) {
        const startISO = cur.DTSTART ? icsDateToISO(cur.DTSTART) : null;
        if (startISO) {
          const endISO = cur.DTEND ? icsDateToISO(cur.DTEND) : null;
          events.push({
            id:          cur.UID ?? startISO,
            title:       cur.SUMMARY ? unescapeICS(cur.SUMMARY) : 'Evento',
            description: cur.DESCRIPTION ? unescapeICS(cur.DESCRIPTION) : '',
            startAt:     startISO,
            endAt:       endISO ?? startISO,
            coverUrl:    cur.ATTACH || undefined,
            eventUrl:    cur.URL || 'https://lu.ma',
            location:    cur.LOCATION ? unescapeICS(cur.LOCATION) : 'OLI Health Hub',
            isFree:      true,
            guestCount:  0,
            tags:        cur.CATEGORIES ? cur.CATEGORIES.split(',').map(t => t.trim()).filter(Boolean) : [],
          });
        }
      }
      cur = null;
      continue;
    }
    if (cur) {
      const parsed = splitICSLine(line);
      if (parsed) cur[parsed.key] = parsed.value;
    }
  }
  return events;
}

// ── Implementação ─────────────────────────────────────────────────────────────

/** Mock para desenvolvimento. Nunca é o default em produção. */
class LumaMockService implements ILumaService {
  async getUpcomingEvents(): Promise<LumaEvent[]> {
    await new Promise(r => setTimeout(r, 400));
    return MOCK_EVENTS;
  }
}

/**
 * Serviço real: lê o feed iCal público do calendário OLI no Luma.
 * - Sem API key / sem plano Plus.
 * - Filtra apenas eventos futuros, ordena por data crescente.
 * - Erro de rede/parse → [] (nunca quebra a tela; aba mostra "sem eventos").
 */
class LumaIcsService implements ILumaService {
  async getUpcomingEvents(): Promise<LumaEvent[]> {
    try {
      const res = await fetch(LUMA_ICS_URL, { headers: { accept: 'text/calendar' } });
      if (!res.ok) return [];
      const ics = await res.text();
      const now = Date.now();
      return parseICS(ics)
        .filter(e => new Date(e.startAt).getTime() >= now)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    } catch {
      return [];
    }
  }
}

/** Default = feed iCal real. */
export const lumaService: ILumaService = new LumaIcsService();

// Mantém o mock acessível p/ dev sem warning de "não usado".
export const _lumaMock = LumaMockService;
