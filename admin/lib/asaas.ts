/**
 * Cliente Asaas API v3
 * Docs: https://docs.asaas.com
 *
 * Variáveis de ambiente necessárias:
 *   ASAAS_API_KEY   — token de acesso (começa com $aact_...)
 *   ASAAS_ENV       — "sandbox" | "production"  (default: production)
 */

const BASE =
  process.env.ASAAS_ENV === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://www.asaas.com/api/v3';

const KEY = process.env.ASAAS_API_KEY ?? '';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function asaasFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!KEY) throw new AsaasNotConfiguredError();

  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  }

  const res = await fetch(url.toString(), {
    headers: { access_token: KEY, 'Content-Type': 'application/json' },
    next: { revalidate: 300 }, // 5 min — dados financeiros tolerem cache curto
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Asaas ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export class AsaasNotConfiguredError extends Error {
  constructor() { super('ASAAS_API_KEY não configurada'); }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AsaasList<T> {
  object:     'list';
  hasMore:    boolean;
  totalCount: number;
  limit:      number;
  offset:     number;
  data:       T[];
}

export interface AsaasPayment {
  id:                 string;
  customer:           string;          // Asaas customer ID
  subscription:       string | null;   // Asaas subscription ID (null = avulso)
  value:              number;
  netValue:           number;
  dueDate:            string;          // YYYY-MM-DD
  paymentDate:        string | null;   // YYYY-MM-DD quando pago
  status:             AsaasPaymentStatus;
  billingType:        string;          // PIX | BOLETO | CREDIT_CARD | etc.
  description:        string | null;
  externalReference:  string | null;   // nosso ID interno (profile.id ou subscription.id)
  invoiceNumber:      string | null;
}

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'CHARGEBACK_REQUESTED'
  | 'CANCELLED';

export interface AsaasSubscription {
  id:               string;
  customer:         string;
  value:            number;
  nextDueDate:      string;            // YYYY-MM-DD
  cycle:            AsaasCycle;
  status:           string;            // ACTIVE | INACTIVE | EXPIRED
  description:      string | null;
  externalReference: string | null;
  billingType:      string;
  endDate:          string | null;
}

export type AsaasCycle = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Pagamentos por intervalo de vencimento. Máx 100 por chamada. */
export async function getPaymentsByDueDate(params: {
  dueDateFrom:  string;   // YYYY-MM-DD
  dueDateTo:    string;   // YYYY-MM-DD
  status?:      string;   // ex: "RECEIVED,CONFIRMED,PENDING"
  offset?:      number;
  limit?:       number;
}) {
  return asaasFetch<AsaasList<AsaasPayment>>('/payments', {
    dueDateFrom: params.dueDateFrom,
    dueDateTo:   params.dueDateTo,
    ...(params.status ? { status: params.status } : {}),
    limit:  String(params.limit  ?? 100),
    offset: String(params.offset ?? 0),
  });
}

/** Pagamentos por data de recebimento (confirma receita realizada). */
export async function getPaymentsByReceiptDate(params: {
  paymentDateFrom: string;
  paymentDateTo:   string;
  offset?: number;
  limit?:  number;
}) {
  return asaasFetch<AsaasList<AsaasPayment>>('/payments', {
    paymentDateStart: params.paymentDateFrom,
    paymentDateEnd:   params.paymentDateTo,
    limit:  String(params.limit  ?? 100),
    offset: String(params.offset ?? 0),
  });
}

/** Assinaturas ativas. */
export async function getActiveSubscriptions(limit = 100) {
  return asaasFetch<AsaasList<AsaasSubscription>>('/subscriptions', {
    status: 'ACTIVE',
    limit:  String(limit),
  });
}

/** Pagamentos de uma assinatura específica. */
export async function getSubscriptionPayments(subscriptionId: string, limit = 24) {
  return asaasFetch<AsaasList<AsaasPayment>>('/payments', {
    subscription: subscriptionId,
    limit:        String(limit),
  });
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

export const PAYMENT_STATUS_MAP: Record<AsaasPaymentStatus, { label: string; cls: string }> = {
  PENDING:                  { label: 'Pendente',       cls: 'bg-yellow-50 text-yellow-700' },
  RECEIVED:                 { label: 'Recebido',       cls: 'bg-green-50 text-green-700'   },
  CONFIRMED:                { label: 'Confirmado',     cls: 'bg-green-50 text-green-700'   },
  OVERDUE:                  { label: 'Vencido',        cls: 'bg-red-50 text-red-700'       },
  REFUNDED:                 { label: 'Estornado',      cls: 'bg-gray-100 text-gray-500'    },
  RECEIVED_IN_CASH:         { label: 'Rec. em caixa',  cls: 'bg-teal-50 text-teal-700'    },
  REFUND_REQUESTED:         { label: 'Estorno solic.', cls: 'bg-orange-50 text-orange-700' },
  CHARGEBACK_REQUESTED:     { label: 'Chargeback',     cls: 'bg-red-50 text-red-800'       },
  CANCELLED:                { label: 'Cancelado',      cls: 'bg-gray-100 text-gray-500'    },
  CHARGEBACK_DISPUTE:       { label: 'Disputa CB',     cls: 'bg-red-50 text-red-800'       },
  AWAITING_CHARGEBACK_REVERSAL: { label: 'Aguard. CB', cls: 'bg-orange-50 text-orange-700' },
  DUNNING_REQUESTED:        { label: 'Cobrança jur.',  cls: 'bg-purple-50 text-purple-700' },
  DUNNING_RECEIVED:         { label: 'CB recuperado',  cls: 'bg-green-50 text-green-700'   },
  AWAITING_RISK_ANALYSIS:   { label: 'Análise risco',  cls: 'bg-orange-50 text-orange-700' },
} as Record<AsaasPaymentStatus, { label: string; cls: string }>;

export const BILLING_TYPE_MAP: Record<string, string> = {
  BOLETO:      'Boleto',
  CREDIT_CARD: 'Cartão',
  DEBIT_CARD:  'Débito',
  PIX:         'PIX',
  TRANSFER:    'TED/DOC',
  DEPOSIT:     'Depósito',
  UNDEFINED:   '—',
};

export const CYCLE_MAP: Record<string, string> = {
  WEEKLY:       'Semanal',
  BIWEEKLY:     'Quinzenal',
  MONTHLY:      'Mensal',
  QUARTERLY:    'Trimestral',
  SEMIANNUALLY: 'Semestral',
  YEARLY:       'Anual',
};

/** Converte ciclo em fator mensal para projeção. */
export function cycleToMonthlyFactor(cycle: AsaasCycle): number {
  switch (cycle) {
    case 'WEEKLY':       return 4.33;  // ~4.33 semanas/mês
    case 'BIWEEKLY':     return 2.17;
    case 'MONTHLY':      return 1;
    case 'QUARTERLY':    return 1 / 3;
    case 'SEMIANNUALLY': return 1 / 6;
    case 'YEARLY':       return 1 / 12;
    default:             return 1;
  }
}
