/**
 * OLI Health Hub — Definição de Planos
 * Versão: 1.1 | Maio/2026
 * Fonte: Especificacoes_Tecnicas_Planos_OLI.md
 *
 * Este arquivo é a fonte única de verdade (single source of truth) sobre
 * planos, preços, feature flags e regras de billing do app OLI.
 * Importe onde precisar verificar acesso, calcular cobranças ou exibir UI.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type PlanId = 'plan_start' | 'plan_base' | 'plan_pro' | 'plan_vip';

export type PlanStatus = 'active' | 'coming_soon';

export type SupportLevel = 'essencial' | 'profissional' | 'premium';

export type TaxRegime = 'simples_nacional' | 'lucro_presumido' | null;

export interface Plan {
  id: PlanId;
  name: string;
  status: PlanStatus;
  /** Mensalidade em reais. null = plano não lançado. */
  monthlyPrice: number | null;
  /** Custo por minuto de uso da sala em reais. null = plano não lançado. */
  ratePerMinute: number | null;
  /** Desconto percentual de minutagem em relação ao START (0–1). */
  minuteDiscount: number;
  supportLevel: SupportLevel;
  highlighted: boolean;
  badge: string | null;
  features: FeatureFlags;
}

/** Feature flags derivadas do plano.
 *  true  = ativo
 *  false = bloqueado
 *  null  = plano VIP ainda não lançado (não implementar lógica)
 */
export interface FeatureFlags {
  // Infraestrutura física
  feature_conforto_medico: boolean | null;
  feature_impressao: boolean | null;

  // Comunidade e app
  feature_comunidade: boolean | null;
  feature_app_timer: boolean | null;
  feature_app_agenda_propria: boolean | null;
  feature_app_pacientes: boolean | null;

  // Diagnósticos com parceiros (sessão única de avaliação — não serviço contínuo)
  feature_diag_contabil: boolean | null;       // Contábil Mello
  feature_diag_ar_solucoes: boolean | null;    // AR Soluções (convênios/carreira)
  feature_diag_juridico: boolean | null;       // Ana (jurídico)

  // Gestão PRO via equipe OLI
  feature_crm_communicare: boolean | null;     // CRM Communicare Plano Básico
  feature_gestao_agenda_oli: boolean | null;   // Gestão de agenda pela recepção OLI
  feature_emissao_notas_oli: boolean | null;   // Emissão de NF gerenciada pela OLI

  // Serviços plenos — exclusivos VIP (quando lançado)
  feature_ar_solucoes_pleno: boolean | null;   // Gestão contínua AR Soluções
  feature_juridico_ana_pleno: boolean | null;  // Consultoria jurídica contínua
  feature_contabil_mello_pleno: boolean | null;// Contabilidade plena inclusa
  feature_gestao_carreira: boolean | null;     // Gestão de carreira médica
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANOS
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, Plan> = {

  plan_start: {
    id: 'plan_start',
    name: 'START',
    status: 'active',
    monthlyPrice: 0,
    ratePerMinute: 2.00,
    minuteDiscount: 0,
    supportLevel: 'essencial',
    highlighted: false,
    badge: null,
    features: {
      feature_conforto_medico: false,
      feature_impressao: false,
      feature_comunidade: true,
      feature_app_timer: true,
      feature_app_agenda_propria: true,
      feature_app_pacientes: true,
      feature_diag_contabil: false,
      feature_diag_ar_solucoes: false,
      feature_diag_juridico: false,
      feature_crm_communicare: false,
      feature_gestao_agenda_oli: false,
      feature_emissao_notas_oli: false,
      feature_ar_solucoes_pleno: false,
      feature_juridico_ana_pleno: false,
      feature_contabil_mello_pleno: false,
      feature_gestao_carreira: false,
    },
  },

  plan_base: {
    id: 'plan_base',
    name: 'BASE',
    status: 'active',
    monthlyPrice: 299.00,
    ratePerMinute: 1.50,
    minuteDiscount: 0.25, // −25% vs START
    supportLevel: 'essencial',
    highlighted: false,
    badge: null,
    features: {
      feature_conforto_medico: true,
      feature_impressao: false,
      feature_comunidade: true,
      feature_app_timer: true,
      feature_app_agenda_propria: true,
      feature_app_pacientes: true,
      feature_diag_contabil: true,
      feature_diag_ar_solucoes: true,
      feature_diag_juridico: true,
      feature_crm_communicare: false,
      feature_gestao_agenda_oli: false,
      feature_emissao_notas_oli: false,
      feature_ar_solucoes_pleno: false,
      feature_juridico_ana_pleno: false,
      feature_contabil_mello_pleno: false,
      feature_gestao_carreira: false,
    },
  },

  plan_pro: {
    id: 'plan_pro',
    name: 'PRO',
    status: 'active',
    monthlyPrice: 599.00,
    ratePerMinute: 1.30,
    minuteDiscount: 0.35, // −35% vs START
    supportLevel: 'profissional',
    highlighted: true,
    badge: 'Mais popular',
    features: {
      feature_conforto_medico: true,
      feature_impressao: true,
      feature_comunidade: true,
      feature_app_timer: true,
      feature_app_agenda_propria: true,
      feature_app_pacientes: true,
      feature_diag_contabil: true,
      feature_diag_ar_solucoes: true,
      feature_diag_juridico: true,
      feature_crm_communicare: true,
      feature_gestao_agenda_oli: true,
      feature_emissao_notas_oli: true,
      feature_ar_solucoes_pleno: false,
      feature_juridico_ana_pleno: false,
      feature_contabil_mello_pleno: false,
      feature_gestao_carreira: false,
    },
  },

  /**
   * ⚠️ PLANO VIP — EM DESENVOLVIMENTO
   * Não implementar lógica de cobrança nem ativar feature flags.
   * Exibir apenas como teaser ("Em breve") na UI.
   * Todos os campos de preço/minutagem são null até o lançamento.
   */
  plan_vip: {
    id: 'plan_vip',
    name: 'VIP',
    status: 'coming_soon',
    monthlyPrice: null,
    ratePerMinute: null,
    minuteDiscount: 0,
    supportLevel: 'premium',
    highlighted: false,
    badge: 'Em breve',
    features: {
      feature_conforto_medico: null,
      feature_impressao: null,
      feature_comunidade: null,
      feature_app_timer: null,
      feature_app_agenda_propria: null,
      feature_app_pacientes: null,
      feature_diag_contabil: null,
      feature_diag_ar_solucoes: null,
      feature_diag_juridico: null,
      feature_crm_communicare: null,
      feature_gestao_agenda_oli: null,
      feature_emissao_notas_oli: null,
      feature_ar_solucoes_pleno: null,
      feature_juridico_ana_pleno: null,
      feature_contabil_mello_pleno: null,
      feature_gestao_carreira: null,
    },
  },
};

/** Lista de planos na ordem de exibição na UI. */
export const PLAN_ORDER: PlanId[] = ['plan_start', 'plan_base', 'plan_pro', 'plan_vip'];

// ─────────────────────────────────────────────────────────────────────────────
// BILLING — MINUTAGEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Campos gravados em cada sessão de uso da sala.
 * O snapshot de `ratePerMinute` é salvo no momento do início —
 * mudanças de plano posteriores não afetam sessões em andamento.
 */
export interface RoomSession {
  session_id: string;         // UUID
  user_id: string;
  plan_id: PlanId;            // plano ativo no início da sessão
  rate_per_minute: number;    // snapshot da taxa (em R$)
  started_at: string;         // ISO 8601
  ended_at: string | null;    // null = sessão em andamento
  duration_minutes: number | null;
  total_charged: number | null; // duration_minutes × rate_per_minute
}

/** Calcula o valor cobrado de uma sessão. */
export function calcSessionCharge(
  durationMinutes: number,
  ratePerMinute: number,
): number {
  return parseFloat((durationMinutes * ratePerMinute).toFixed(2));
}

// ─────────────────────────────────────────────────────────────────────────────
// PACOTES DE HORAS (modelo bônus)
// ─────────────────────────────────────────────────────────────────────────────

export interface HourPackage {
  /** Horas pagas pelo profissional. */
  paidHours: number;
  /** Horas bônus adicionadas sem custo extra. */
  bonusHours: number;
  /** Total de horas disponíveis para uso. */
  totalHours: number;
}

/** Tabela de bônus por pacote. */
export const HOUR_PACKAGES: HourPackage[] = [
  { paidHours: 10, bonusHours: 1,  totalHours: 11 },
  { paidHours: 20, bonusHours: 3,  totalHours: 23 },
];

/**
 * Calcula o custo de compra de um pacote de horas.
 * O valor é baseado na minutagem do plano ativo do profissional
 * (apenas sobre as horas pagas — bônus não entram no cálculo).
 */
export function calcPackageCost(
  paidHours: number,
  ratePerMinute: number,
): number {
  return parseFloat((paidHours * 60 * ratePerMinute).toFixed(2));
}

/**
 * Campos do pacote de horas gravados no banco.
 * Saldo em minutos é decrementado a cada sessão — esgotado o saldo,
 * a cobrança volta a ser por minutagem avulsa.
 */
export interface UserHourPackage {
  package_id: string;
  user_id: string;
  plan_id_at_purchase: PlanId;
  paid_hours: number;
  bonus_hours: number;
  total_minutes: number;       // totalHours × 60
  minutes_remaining: number;
  purchased_at: string;        // ISO 8601
  expires_at: string | null;   // política de validade a definir
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD-ONS (módulos avulsos de parceiros)
// ─────────────────────────────────────────────────────────────────────────────

export type AddonId =
  | 'addon_contabil_simples'
  | 'addon_contabil_presumido'
  | 'addon_contabil_abertura_sp'
  | 'addon_ar_convenios'
  | 'addon_ar_agenda'
  | 'addon_ar_carreira'
  | 'addon_juridico_consulta'
  | 'addon_juridico_contrato';

export type AddonStatus = 'active' | 'price_pending';

export interface Addon {
  id: AddonId;
  name: string;
  partner: string;
  /** Preço avulso em reais. null = valor ainda não definido com parceiro. */
  price: number | null;
  status: AddonStatus;
  /**
   * Se true, este add-on ficará incluído no plano VIP quando lançado
   * (assinantes VIP não pagarão à parte).
   */
  includedInVip: boolean;
  /** Referência: preço que será embutido no VIP. null = a definir. */
  vipReferencePrice: number | null;
}

export const ADDONS: Record<AddonId, Addon> = {

  // ── Contábil Mello ──────────────────────────────────────────────────────
  addon_contabil_simples: {
    id: 'addon_contabil_simples',
    name: 'Honorários Contábeis — Simples Nacional',
    partner: 'Contábil Mello (Isabella)',
    price: 460.00,
    status: 'active',
    includedInVip: true,
    vipReferencePrice: 400.00,
  },
  addon_contabil_presumido: {
    id: 'addon_contabil_presumido',
    name: 'Honorários Contábeis — Lucro Presumido',
    partner: 'Contábil Mello (Isabella)',
    price: 632.00,
    status: 'active',
    includedInVip: true,
    vipReferencePrice: 550.00,
  },
  addon_contabil_abertura_sp: {
    id: 'addon_contabil_abertura_sp',
    name: 'Abertura de Empresa (SP)',
    partner: 'Contábil Mello (Isabella)',
    price: 1200.00,
    status: 'active',
    includedInVip: false,
    vipReferencePrice: null,
  },

  // ── AR Soluções ─────────────────────────────────────────────────────────
  // Valores pendentes de validação com Amanda e Ronaldo.
  // Regra: preço avulso = valor VIP × 1,15 (aplicar após validação).
  addon_ar_convenios: {
    id: 'addon_ar_convenios',
    name: 'Cadastramento em Convênios Médicos',
    partner: 'AR Soluções (Amanda e Ronaldo)',
    price: null,
    status: 'price_pending',
    includedInVip: true,
    vipReferencePrice: null,
  },
  addon_ar_agenda: {
    id: 'addon_ar_agenda',
    name: 'Gestão de Agenda / Retenção de Pacientes',
    partner: 'AR Soluções (Amanda e Ronaldo)',
    price: null,
    status: 'price_pending',
    includedInVip: true,
    vipReferencePrice: null,
  },
  addon_ar_carreira: {
    id: 'addon_ar_carreira',
    name: 'Otimização de Carreira Médica',
    partner: 'AR Soluções (Amanda e Ronaldo)',
    price: null,
    status: 'price_pending',
    includedInVip: true,
    vipReferencePrice: null,
  },

  // ── Consultoria Jurídica — Ana ──────────────────────────────────────────
  // Valores pendentes de validação com Ana.
  // Regra: preço avulso = valor VIP × 1,15 (aplicar após validação).
  addon_juridico_consulta: {
    id: 'addon_juridico_consulta',
    name: 'Consulta Jurídica Avulsa',
    partner: 'Ana (sócia)',
    price: null,
    status: 'price_pending',
    includedInVip: false,
    vipReferencePrice: null,
  },
  addon_juridico_contrato: {
    id: 'addon_juridico_contrato',
    name: 'Consultoria Jurídica Contratual',
    partner: 'Ana (sócia)',
    price: null,
    status: 'price_pending',
    includedInVip: true,
    vipReferencePrice: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNICARE (CRM — integração PRO)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plano Básico do Communicare — incluído no plano PRO da OLI.
 * Acesso liberado via feature_crm_communicare.
 * Integração: a definir com Heitor (API ou acesso direto).
 */
export const COMMUNICARE_PRO_PLAN = {
  planName: 'Plano Básico',
  partner: 'Heitor',
  includedInOliPlan: 'plan_pro' as PlanId,
  features: [
    'Prontuário eletrônico multiprofissional',
    'Agendamento com confirmação por e-mail e WhatsApp (one-click)',
    'Agendamento online via link personalizado da clínica',
    'Lembretes automáticos de consulta',
    'Pagamento online integrado via Asaas (split clínica × profissional)',
    'Emissão automática de notas fiscais via Asaas',
    'Módulo financeiro com relatórios de repasse por procedimento',
    'Histórico unificado de atendimentos',
    'Dashboards operacionais (NPS e perfil da carteira de pacientes)',
    'Modelos de registro clínico (anamnese, atestados, pedido de exames)',
    'Configuração de permissões de acesso por login',
    'Logins administrativos ilimitados (profissionais de nível superior pagam assento)',
  ],
  /** Módulos opcionais — não incluídos no PRO, contratar à parte se necessário. */
  optionalModules: [
    { name: 'Teleconsulta', pricePerProfessional: 97 },
    { name: 'Scribe IA', pricePerProfessional: 149 },
    { name: 'Communicare Connect', pricePerProfessional: 239 },
    {
      name: 'Chat Omnichannel Digisac',
      basePrice: 197,        // até 2 atendentes/mês
      extraPerAttendant: 30, // por atendente adicional
      note: 'Contratação direta com Digisac — não passa pela OLI',
    },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PERFIL DO PROFISSIONAL (campos mínimos)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  user_id: string;
  name: string;
  crm: string;
  specialty: string;
  cnpj: string | null;
  tax_regime: TaxRegime;
  plan_id: PlanId;
  plan_started_at: string;           // ISO 8601
  billing_minutes_balance: number;   // saldo de pacote de horas em minutos
  active_addons: AddonId[];
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna true se o profissional tem acesso a uma feature específica. */
export function hasFeature(
  profile: UserProfile,
  flag: keyof FeatureFlags,
): boolean {
  const plan = PLANS[profile.plan_id];
  return plan.features[flag] === true;
}

/** Retorna a taxa por minuto do profissional com base no plano ativo. */
export function getRatePerMinute(planId: PlanId): number {
  const rate = PLANS[planId].ratePerMinute;
  if (rate === null) {
    throw new Error(`Plano ${planId} ainda não lançado — taxa indefinida.`);
  }
  return rate;
}

/**
 * Calcula a hora em que o plano BASE começa a ser mais econômico que o START.
 * Break-even: horas onde (mensalidade_base + minutos × rate_base) = (minutos × rate_start)
 * → horas = mensalidade_base / ((rate_start − rate_base) × 60)
 */
export function calcBreakevenHours(
  basePlan: Plan = PLANS.plan_base,
  startPlan: Plan = PLANS.plan_start,
): number {
  if (!basePlan.monthlyPrice || !basePlan.ratePerMinute || !startPlan.ratePerMinute) return 0;
  const savings_per_minute = startPlan.ratePerMinute - basePlan.ratePerMinute;
  return parseFloat((basePlan.monthlyPrice / (savings_per_minute * 60)).toFixed(1));
}
// → ~10h/mês para BASE vs START (R$299 / (R$0,50 × 60)).
//   O comentário aqui dizia ~17h com R$0,30 — diferença de minutagem de uma
//   tabela antiga. A função sempre calculou certo; só o comentário estava velho.
