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

// ── Implementação ─────────────────────────────────────────────────────────────

class LumaMockService implements ILumaService {
  async getUpcomingEvents(): Promise<LumaEvent[]> {
    // Simula latência de rede
    await new Promise(r => setTimeout(r, 400));
    return MOCK_EVENTS;
  }
}

/**
 * Fase 3 — substituir por:
 *
 * class LumaApiService implements ILumaService {
 *   private readonly calendarId = process.env.EXPO_PUBLIC_LUMA_CALENDAR_ID!;
 *
 *   async getUpcomingEvents(): Promise<LumaEvent[]> {
 *     const res = await fetch(
 *       `https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=${this.calendarId}`,
 *       { headers: { 'x-luma-api-key': process.env.EXPO_PUBLIC_LUMA_API_KEY! } },
 *     );
 *     const { entries } = await res.json();
 *     return entries.map((e: any) => ({
 *       id:          e.event.api_id,
 *       title:       e.event.name,
 *       description: e.event.description ?? '',
 *       startAt:     e.event.start_at,
 *       endAt:       e.event.end_at,
 *       coverUrl:    e.event.cover_url ?? undefined,
 *       eventUrl:    `https://lu.ma/${e.event.url}`,
 *       location:    e.event.geo_address_info?.full_address ?? 'OLI Health Hub',
 *       isFree:      e.event.ticket_info?.is_free ?? true,
 *       guestCount:  e.event.guest_count ?? 0,
 *       tags:        e.event.tags?.map((t: any) => t.label) ?? [],
 *     }));
 *   }
 * }
 */

export const lumaService: ILumaService = new LumaMockService();
