// ─── Domínio ──────────────────────────────────────────────────────────────────

export type PlanType = 'BASE' | 'PRO' | 'VIP';

// ─── Onboarding Contábil ──────────────────────────────────────────────────────

/** Q1: Pessoa Física, PJ ou ambos? */
export type SituacaoJuridica = 'pf' | 'pj' | 'ambos';

/** Q2: Faixa de faturamento mensal */
export type FaturamentoRange =
  | 'ate_10k'       // Até R$ 10.000
  | '10k_30k'       // R$ 10.001 – R$ 30.000
  | '30k_80k'       // R$ 30.001 – R$ 80.000
  | '80k_160k'      // R$ 80.001 – R$ 160.000
  | 'acima_160k';   // Acima de R$ 160.000

/** Q5: Onde exerce a atividade? */
export type LocalAtuacao = 'proprio' | 'terceiros' | 'ambos';

/** Q6: Quantidade de locais de atuação */
export type NumLocais = '1' | '2_3' | '4_6' | 'mais_6';

/** Q8: Faixa de notas fiscais por mês */
export type NotasFiscaisRange =
  | 'nao_emite'
  | 'ate_5'
  | '6_20'
  | '21_50'
  | 'acima_50';

/** Respostas completas do questionário diagnóstico contábil */
export interface OnboardingContabil {
  situacaoJuridica:       SituacaoJuridica;   // Q1
  faturamentoRange:       FaturamentoRange;   // Q2
  atividadeExercida:      string;             // Q3 — texto livre (especialidade)
  possuiCLT:              boolean;            // Q4
  localAtuacao:           LocalAtuacao;       // Q5
  numLocais:              NumLocais;          // Q6
  cidadeUF:               string;             // Q7
  notasFiscaisRange:      NotasFiscaisRange;  // Q8
  possuiFuncionarios:     boolean;            // Q9a
  previsaoContratacao:    boolean;            // Q9b (só relevante se possuiFuncionarios=false)
  possuiSocios:           boolean;            // Q10
}

export interface Room {
  id: number;
  name: string;
  specialties: string[];
  isAvailable: boolean;
  /** Preenchido quando um profissional continua além do horário reservado */
  occupiedBy?: string;
  /** Equipamentos e mobiliário disponíveis na sala */
  items: string[];
  /** Observação adicional exibida no detalhe da sala */
  note?: string;
  /** URLs de fotos da sala (fase futura) */
  photos?: string[];
}

export type ReservationStatus =
  | 'agendado'
  | 'em_uso'
  | 'concluido'
  | 'cancelado';

export interface Reservation {
  id: string;
  roomName: string;
  startTime: string; // ISO 8601
  endTime: string;
  notes?: string;
  status?: ReservationStatus;
  arrivedAt?: string;
  consultationStartedAt?: string;
  consultationEndedAt?: string;
}

export type ConvenioTipo = 'particular' | 'convenio';

export interface Patient {
  id: string;
  nome: string;
  telefone: string;
  /** LGPD: nunca armazenar em texto puro em produção — usar cpfHash */
  cpf: string;
  dataNascimento: string;
  convenioTipo: ConvenioTipo;
  convenioNome?: string;          // Nome do convênio, se aplicável
  isSincronizado: boolean;
  consentimentoTimestamp: string; // ISO 8601 — obrigatório pela LGPD
  dataCadastro: string;           // ISO 8601
  /** Fase 3: ID do paciente no Communicare após sincronização */
  communicareId?: string;
}

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  crm: string;
  especialidade: string;
  plan: PlanType;
}

// ─── Timer e Alertas ─────────────────────────────────────────────────────────

export type TimerAlertType =
  | 'bufferFriendly'
  | 'bufferUrgent'
  | 'overtimeAdded'
  | 'checkoutSuccess';

export const TIMER_ALERTS: Record<TimerAlertType, { title: string; message: string }> = {
  bufferFriendly: {
    title: 'Seu período encerrou',
    message: 'A sala está livre. Você pode continuar por mais tempo sem problema.',
  },
  bufferUrgent: {
    title: 'Atenção — Próximo Paciente',
    message: 'Outro profissional tem reserva em breve. Faça o checkout nos próximos 15 minutos.',
  },
  overtimeAdded: {
    title: 'Bloco Extra Adicionado',
    message: 'Um bloco adicional de 30 minutos foi adicionado ao seu uso.',
  },
  checkoutSuccess: {
    title: 'Checkout Realizado',
    message: 'Sessão encerrada. A recepção foi notificada para preparar a sala.',
  },
};

// ─── Prontuário Rápido (Communicare — somente leitura, sem cache local) ───────
// LGPD Art. 11: dados de saúde nunca armazenados localmente.
// Consultados em tempo real via Communicare API na Fase 3.

export interface ProntuarioEntrada {
  data: string;         // ISO 8601
  tipo: 'consulta' | 'retorno' | 'exame';
  descricao: string;
  profissional: string;
}

export interface ProntuarioRapido {
  patientId:         string;
  nome:              string;
  dataNascimento:    string;
  idadeAnos:         number;
  diagnosticoPrincipal: string;
  medicamentosEmUso: string[];
  alergias:          string[];
  ultimaConsulta:    string; // ISO 8601
  observacoes:       string;
  historico:         ProntuarioEntrada[];
  /** Fonte: Communicare — nunca salvar em AsyncStorage ou SecureStore */
  _fonte:            'communicare';
}

// ─── Financeiro ───────────────────────────────────────────────────────────────

export type InvoiceStatus = 'pendente' | 'paga' | 'vencida';

export interface Invoice {
  id: string;
  period: string; // ex: "Maio 2026"
  amount: number;
  dueDate: string; // ISO 8601
  status: InvoiceStatus;
}

export interface HourPackage {
  hours: number;
  price: number;
  discountPercent: number;
}
