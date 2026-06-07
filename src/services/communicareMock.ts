/**
 * Communicare Simulator (mock in-memory)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ativado por EXPO_PUBLIC_COMMUNICARE_MOCK=true.
 * Permite rodar o fluxo de integração 100% SEM token nem endpoints reais.
 * Responde aos mesmos paths/shapes que o CC real.
 *
 * Quando token + endpoints reais chegarem: setar mock=false e o
 * communicareApi passa a falar com o proxy real. Zero mudança de código.
 *
 * Serve também como ESPECIFICAÇÃO de referência do contrato esperado.
 */

// ─── Fixtures in-memory ───────────────────────────────────────────────────────

interface MockPatient {
  id:         string;
  name:       string;
  cpf:        string;
  birthDate:  string;
  phone:      string;
  email?:     string;
  healthPlanId?: string;
  externalId?: string;
}

const patients: Map<string, MockPatient> = new Map();
let patientSeq = 1000;

const healthPlans = [
  { id: 'hp_particular', name: 'Particular' },
  { id: 'hp_unimed',     name: 'Unimed',           ansCode: '393321' },
  { id: 'hp_bradesco',   name: 'Bradesco Saúde',   ansCode: '005711' },
  { id: 'hp_amil',       name: 'Amil',             ansCode: '326305' },
  { id: 'hp_sulamerica', name: 'SulAmérica Saúde', ansCode: '006246' },
  { id: 'hp_hapvida',    name: 'Hapvida',          ansCode: '368253' },
];

// Agenda simulada do dia — popula buckets do dashboard
function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const agendaFixture = [
  { scheduleId: 's1', patientId: '1001', patientName: 'Maria Oliveira',  startTime: todayAt(9, 0),  procedure: 'Consulta',  status: 'atendido' },
  { scheduleId: 's2', patientId: '1002', patientName: 'João Santos',     startTime: todayAt(10, 0), procedure: 'Retorno',   status: 'em atendimento' },
  { scheduleId: 's3', patientId: '1003', patientName: 'Ana Costa',       startTime: todayAt(10, 30),procedure: 'Consulta',  status: 'aguardando' },
  { scheduleId: 's4', patientId: '1004', patientName: 'Pedro Almeida',   startTime: todayAt(11, 0), procedure: 'Consulta',  status: 'agendado' },
  { scheduleId: 's5', patientId: '1005', patientName: 'Carla Dias',      startTime: todayAt(11, 30),procedure: 'Teleconsulta', status: 'confirmado', isTeleconsultation: true },
];

const historyFixture = [
  { scheduleId: 'h1', date: todayAt(-720, 0), professionalName: 'Dr. Guilherme', procedure: 'Consulta', status: 'atendido', notes: 'Rotina' },
  { scheduleId: 'h2', date: todayAt(-1440, 0), professionalName: 'Dr. Guilherme', procedure: 'Retorno', status: 'atendido' },
];

// ─── Roteador do mock ──────────────────────────────────────────────────────────

const delay = () => new Promise<void>(r => setTimeout(r, 300));

let warnedOnce = false;

export function isMockEnabled(): boolean {
  const enabled = process.env.EXPO_PUBLIC_COMMUNICARE_MOCK === 'true';
  // Guard: mock NUNCA deve ir pra release público. Avisa alto se ativo
  // fora de dev (TestFlight com mock é OK e intencional; release não).
  const isProd = typeof __DEV__ !== 'undefined' && !__DEV__;
  if (enabled && isProd && !warnedOnce) {
    warnedOnce = true;
    console.warn(
      '[OLI] ⚠️ SIMULADOR COMMUNICARE ATIVO em build de produção. ' +
      'Dados de paciente/agenda são FIXTURES. Desligar antes de release público ' +
      '(ver RELEASE_CHECKLIST.md).',
    );
  }
  return enabled;
}

/**
 * Responde a uma chamada simulada. Lança {status} em erros como o real.
 * `path` já vem com querystring. `method` + `body` opcionais.
 */
export async function mockRequest<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?:  unknown,
): Promise<T> {
  await delay();
  const [rawPath, qs] = path.split('?');
  const params = new URLSearchParams(qs ?? '');

  // ── SSO ──
  if (rawPath.startsWith('/v1/sso/')) {
    const cpf = rawPath.replace('/v1/sso/', '');
    return {
      jwt:            `mock.jwt.${cpf}`,
      expiresAt:      new Date(Date.now() + 24 * 3600_000).toISOString(),
      professionalId: `prof_${cpf.slice(0, 4)}`,
    } as T;
  }

  // ── Health plans ──
  if (rawPath === '/v1/health-plans' && method === 'GET') {
    return healthPlans as T;
  }

  // ── Patient ──
  if (rawPath === '/v1/patient') {
    if (method === 'GET') {
      const cpf = params.get('cpf');
      const email = params.get('email');
      const ext = params.get('externalId');
      const found = [...patients.values()].find(p =>
        (cpf && p.cpf === cpf) ||
        (email && p.email === email) ||
        (ext && p.externalId === ext),
      );
      return (found ? [found] : []) as T;
    }
    if (method === 'POST') {
      const p = body as MockPatient;
      const id = `${++patientSeq}`;
      const saved = { ...p, id };
      patients.set(id, saved);
      return saved as T;
    }
  }
  if (rawPath.startsWith('/v1/patient/')) {
    const id = rawPath.replace('/v1/patient/', '');
    if (method === 'PUT') {
      const existing = patients.get(id);
      const merged = { ...existing, ...(body as Partial<MockPatient>), id } as MockPatient;
      patients.set(id, merged);
      return merged as T;
    }
    if (method === 'DELETE') {
      patients.delete(id);
      return undefined as T;
    }
    if (method === 'GET') {
      const p = patients.get(id);
      if (!p) { const e = new Error('not found'); (e as { status?: number }).status = 404; throw e; }
      return p as T;
    }
  }

  // ── Agenda do dia ──
  if (rawPath === '/v1/agenda' && method === 'GET') {
    return agendaFixture as T;
  }

  // ── Histórico ──
  if (rawPath === '/v1/history' && method === 'GET') {
    return historyFixture as T;
  }

  // ── Queue ──
  if (rawPath === '/v1/queue' && method === 'POST') {
    return {
      success:          true,
      queueId:          'q1',
      queuePatientUUID: `qp_${Date.now()}`,
      queueURL:         'https://mock.communicare/queue/q1',
      message:          'Paciente adicionado à fila',
    } as T;
  }

  // ── Procedures / professionals ──
  if (rawPath === '/v1/agenda/professional-procedures') {
    return ['Consulta', 'Retorno', 'Teleconsulta', 'Avaliação'] as T;
  }
  if (rawPath === '/v1/agenda/professionals') {
    return [{ id: 'prof_1', name: 'Dr. Guilherme', cpf: '00000000000', specialties: ['Clínica Geral'], procedures: ['Consulta'] }] as T;
  }

  const e = new Error(`mock: rota não mapeada ${method} ${rawPath}`);
  (e as { status?: number }).status = 404;
  throw e;
}
