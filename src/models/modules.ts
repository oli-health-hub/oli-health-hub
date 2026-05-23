/**
 * OLI Health Hub — Catálogo de Módulos e Add-ons
 * Versão: 1.0 | Maio/2026
 *
 * Fonte única de verdade para todos os módulos contratáveis separadamente
 * dos planos BASE/PRO/VIP. Cada módulo tem preço próprio, tipo de ativação,
 * plano mínimo exigido e lista de features que desbloqueia por plano.
 *
 * Camadas de ativação:
 *   🟢 auto         — ativado automaticamente ao assinar o plano
 *   🔧 oli_config   — OLI back-office configura após contratação
 *   👤 self_service — médico contrata e configura sozinho pelo app
 */

import { PlanType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type ModuleId =
  | 'communicare'
  | 'ar_credenciamento'
  | 'ar_gestao_mensal'
  | 'ar_operadora_adicional'
  | 'contabil_mello'
  | 'scribe_ia';

/** Como o módulo é ativado após a decisão de contratar */
export type ActivationType =
  | 'oauth'           // Médico conecta conta externa (ex: Communicare)
  | 'in_app_form'     // Formulário dentro do app envia solicitação para OLI
  | 'contact_sales'   // Redirecionamento para WhatsApp/email comercial OLI
  | 'auto';           // Ativado automaticamente pelo plano — sem ação do usuário

/** Camada de ativação (quem aciona) */
export type ActivationLayer =
  | 'plan_auto'       // 🟢 Incluso no plano, ativa automaticamente
  | 'oli_config'      // 🔧 OLI back-office configura após contratação
  | 'self_service';   // 👤 Médico contrata e ativa pelo app

export interface ModulePricing {
  /** Valor em reais. undefined = a definir. */
  amount?: number;
  period: 'monthly' | 'one_time' | 'per_unit' | 'included' | 'tbd';
  currency: 'BRL';
  /** Texto de exibição amigável (ex: "R$ 2.500 único") */
  displayLabel: string;
  /** Unidade para period=per_unit (ex: "por operadora") */
  unitLabel?: string;
}

export interface OLIModule {
  id: ModuleId;
  name: string;
  provider: string;
  tagline: string;
  description: string;
  /** URL do logo do parceiro (asset local ou CDN) */
  logoAsset?: string;
  pricing: ModulePricing;
  /** Plano mínimo para contratar este módulo */
  requiredPlan: PlanType;
  activationType: ActivationType;
  activationLayer: ActivationLayer;
  /** URL ou deep-link para início do fluxo de ativação */
  activationUrl?: string;
  /** Número WhatsApp comercial OLI (para contact_sales) */
  salesWhatsapp?: string;
  status: 'available' | 'coming_soon' | 'beta';
  /**
   * Features que o módulo desbloqueia para cada plano.
   * Usado pelo hook useFeature() para gate de funcionalidades.
   */
  featuresByPlan: Partial<Record<PlanType, string[]>>;
  /**
   * Planos nos quais este módulo já está INCLUSO (sem custo extra).
   * Ex: AR Credenciamento está incluso no VIP.
   */
  includedInPlans?: PlanType[];
}

/** Estado de um módulo contratado por um profissional específico (espelha tabela user_modules) */
export interface UserModule {
  /** UUID da linha em user_modules */
  id: string;
  /** UUID do profissional (= profiles.id = auth.uid()) */
  professionalId: string;
  /** UUID da linha em modules */
  moduleDbId: string;
  /** Slug do catálogo (resolvido via join com modules.slug) */
  moduleId: ModuleId;
  status: 'pending_payment' | 'pending_config' | 'active' | 'suspended' | 'cancelled' | 'expired';
  activatedAt?: string;
  /** Data de expiração (= ativo_ate na tabela) */
  expiresAt?: string;
  /** Configurações específicas do módulo (tokens OAuth, IDs externos, etc.) */
  config: Record<string, unknown>;
  contractUrl?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO
// ─────────────────────────────────────────────────────────────────────────────

export const MODULE_CATALOG: Record<ModuleId, OLIModule> = {

  // ── Communicare ─────────────────────────────────────────────────────────────
  communicare: {
    id: 'communicare',
    name: 'Communicare Connect',
    provider: 'Communicare',
    tagline: 'Prontuário eletrônico e CRM clínico integrado ao OLI',
    description:
      'Conecte seu Communicare ao OLI e gerencie pacientes, prontuários e ' +
      'cobranças sem sair do app. Planos BASE e PRO incluem acesso ao módulo ' +
      'Básico e Cuidar. VIP inclui Cuidar Automatizado com agendamento online ' +
      'e cobrança automática.',
    pricing: {
      period: 'tbd',
      currency: 'BRL',
      displayLabel: 'A definir',
    },
    requiredPlan: 'BASE',
    activationType: 'oauth',
    activationLayer: 'self_service',
    status: 'coming_soon',
    includedInPlans: ['VIP'],
    featuresByPlan: {
      BASE: [
        'communicare.prontuario_basico',
        'communicare.agenda_propria',
        'communicare.pacientes_ilimitados',
      ],
      PRO: [
        'communicare.prontuario_basico',
        'communicare.agenda_propria',
        'communicare.pacientes_ilimitados',
        'communicare.automacao_retorno',
        'communicare.relatorios',
      ],
      VIP: [
        'communicare.prontuario_basico',
        'communicare.agenda_propria',
        'communicare.pacientes_ilimitados',
        'communicare.automacao_retorno',
        'communicare.relatorios',
        'communicare.agendamento_online',
        'communicare.cobranca_automatica',
        'communicare.telemedicina',
      ],
    },
  },

  // ── AR Credenciamento ────────────────────────────────────────────────────────
  ar_credenciamento: {
    id: 'ar_credenciamento',
    name: 'Credenciamento em Convênios',
    provider: 'AR Consultoria',
    tagline: 'Credenciamento completo nos principais planos de saúde',
    description:
      'A AR Consultoria cuida de todo o processo de credenciamento junto aos ' +
      'convênios: análise de documentação, envio, acompanhamento e aprovação. ' +
      'Serviço único — sem mensalidade. Incluso no plano VIP.',
    pricing: {
      amount: 2500,
      period: 'one_time',
      currency: 'BRL',
      displayLabel: 'R$ 2.500 único',
    },
    requiredPlan: 'PRO',
    activationType: 'in_app_form',
    activationLayer: 'oli_config',
    salesWhatsapp: process.env.EXPO_PUBLIC_OLI_SALES_PHONE,
    status: 'available',
    includedInPlans: ['VIP'],
    featuresByPlan: {
      PRO: [
        'ar.credenciamento_analise',
        'ar.credenciamento_acompanhamento',
        'ar.credenciamento_aprovacao',
      ],
      VIP: [
        'ar.credenciamento_analise',
        'ar.credenciamento_acompanhamento',
        'ar.credenciamento_aprovacao',
        'ar.credenciamento_prioridade',
      ],
    },
  },

  // ── AR Gestão Mensal ─────────────────────────────────────────────────────────
  ar_gestao_mensal: {
    id: 'ar_gestao_mensal',
    name: 'Gestão de Convênios',
    provider: 'AR Consultoria',
    tagline: 'Gestão contínua das operadoras: glosas, TISS e faturamento',
    description:
      'Acompanhamento mensal das suas operadoras: auditoria de glosas, envio ' +
      'de guias TISS, faturamento e relatórios. A AR assume a operação para ' +
      'você focar no atendimento.',
    pricing: {
      amount: 1000,
      period: 'monthly',
      currency: 'BRL',
      displayLabel: 'R$ 1.000/mês',
    },
    requiredPlan: 'PRO',
    activationType: 'contact_sales',
    activationLayer: 'oli_config',
    salesWhatsapp: process.env.EXPO_PUBLIC_OLI_SALES_PHONE,
    status: 'available',
    featuresByPlan: {
      PRO: [
        'ar.gestao_glosas',
        'ar.faturamento_tiss',
        'ar.relatorio_mensal',
      ],
      VIP: [
        'ar.gestao_glosas',
        'ar.faturamento_tiss',
        'ar.relatorio_mensal',
        'ar.gestao_prioritaria',
        'ar.consultoria_estrategica',
      ],
    },
  },

  // ── AR Operadora Adicional ───────────────────────────────────────────────────
  ar_operadora_adicional: {
    id: 'ar_operadora_adicional',
    name: 'Operadora Adicional',
    provider: 'AR Consultoria',
    tagline: 'Adicione uma operadora extra ao seu pacote de gestão',
    description:
      'Já tem Gestão de Convênios ativo? Expanda para mais operadoras por um ' +
      'valor fixo por operadora adicional.',
    pricing: {
      amount: 150,
      period: 'per_unit',
      currency: 'BRL',
      displayLabel: 'R$ 150',
      unitLabel: 'por operadora/mês',
    },
    requiredPlan: 'PRO',
    activationType: 'in_app_form',
    activationLayer: 'self_service',
    status: 'available',
    featuresByPlan: {
      PRO: ['ar.operadora_adicional'],
      VIP: ['ar.operadora_adicional'],
    },
  },

  // ── Contábil Mello ───────────────────────────────────────────────────────────
  contabil_mello: {
    id: 'contabil_mello',
    name: 'Contabilidade Médica',
    provider: 'Contábil Mello',
    tagline: 'Contabilidade especializada em médicos e PJ médica',
    description:
      'Equipe especializada em médicos: abertura de PJ, planejamento tributário, ' +
      'emissão de NF, Simples Nacional, Lucro Presumido e assessoria contábil contínua. ' +
      'Diagnóstico gratuito incluso no plano BASE.',
    pricing: {
      period: 'tbd',
      currency: 'BRL',
      displayLabel: 'Consultar',
    },
    requiredPlan: 'BASE',
    activationType: 'contact_sales',
    activationLayer: 'oli_config',
    salesWhatsapp: process.env.EXPO_PUBLIC_OLI_SALES_PHONE,
    status: 'available',
    featuresByPlan: {
      BASE: [
        'contabil.diagnostico_gratuito',
      ],
      PRO: [
        'contabil.diagnostico_gratuito',
        'contabil.abertura_pj',
        'contabil.planejamento_tributario',
      ],
      VIP: [
        'contabil.diagnostico_gratuito',
        'contabil.abertura_pj',
        'contabil.planejamento_tributario',
        'contabil.assessoria_continua',
        'contabil.emissao_nf',
      ],
    },
  },

  // ── Scribe IA ────────────────────────────────────────────────────────────────
  scribe_ia: {
    id: 'scribe_ia',
    name: 'Scribe IA',
    provider: 'OLI Health Hub',
    tagline: 'Transcrição automática de consultas com IA',
    description:
      'Grave a consulta, o Scribe transcreve, estrutura em SOAP e sugere CID-10. ' +
      'Integra com o Communicare para preencher o prontuário automaticamente.',
    pricing: {
      period: 'tbd',
      currency: 'BRL',
      displayLabel: 'A definir',
    },
    requiredPlan: 'PRO',
    activationType: 'auto',
    activationLayer: 'oli_config',
    status: 'coming_soon',
    includedInPlans: ['VIP'],
    featuresByPlan: {
      PRO: [
        'scribe.transcricao',
        'scribe.soap',
        'scribe.cid10',
      ],
      VIP: [
        'scribe.transcricao',
        'scribe.soap',
        'scribe.cid10',
        'scribe.integracao_communicare',
        'scribe.sugestao_conduta',
      ],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna true se o módulo está incluso no plano (sem custo extra) */
export function isModuleIncludedInPlan(moduleId: ModuleId, plan: PlanType): boolean {
  return MODULE_CATALOG[moduleId].includedInPlans?.includes(plan) ?? false;
}

/** Retorna todos os módulos disponíveis para um plano (incluso + contratável) */
export function getModulesForPlan(plan: PlanType): OLIModule[] {
  const planOrder: PlanType[] = ['START', 'BASE', 'PRO', 'VIP'];
  const planIndex = planOrder.indexOf(plan);
  return Object.values(MODULE_CATALOG).filter((m) => {
    const requiredIndex = planOrder.indexOf(m.requiredPlan);
    return planIndex >= requiredIndex;
  });
}

/** Retorna as features de um módulo ativas para um plano */
export function getModuleFeatures(moduleId: ModuleId, plan: PlanType): string[] {
  return MODULE_CATALOG[moduleId].featuresByPlan[plan] ?? [];
}
