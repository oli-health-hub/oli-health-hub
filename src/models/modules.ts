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
  | 'contabil_mello'
  | 'juridico';

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
      'cobranças sem sair do app. Disponível no plano PRO: gestão de agenda ' +
      'pela recepção e emissão de nota fiscal automatizada.',
    pricing: {
      period: 'tbd',
      currency: 'BRL',
      displayLabel: 'A definir',
    },
    requiredPlan: 'PRO',
    activationType: 'contact_sales',
    activationLayer: 'oli_config',
    status: 'available',
    includedInPlans: ['VIP'],
    featuresByPlan: {
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

  // ── Jurídico ─────────────────────────────────────────────────────────────────
  juridico: {
    id: 'juridico',
    name: 'Consultoria Jurídica',
    provider: 'Ana (sócia)',
    tagline: 'Direito médico: CFM, LGPD, contratos e ética médica',
    description:
      'Assessoria jurídica especializada em medicina: ética médica e normas do ' +
      'CFM, LGPD aplicada à saúde, contratos com clínicas e hospitais, ' +
      'publicidade médica e responsabilidade civil.',
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
      BASE: ['juridico.consulta'],
      PRO: ['juridico.consulta', 'juridico.contratos'],
      VIP: ['juridico.consulta', 'juridico.contratos', 'juridico.assessoria_continua'],
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
      'Diagnóstico gratuito incluso nos planos BASE e PRO.',
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
