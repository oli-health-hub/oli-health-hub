/**
 * sentryService.ts
 *
 * Inicialização e configuração do Sentry para o OLI Health Hub.
 *
 * Regras LGPD obrigatórias:
 *  - NUNCA logar CPF (mesmo hasheado), nome completo, CRM, endereço, telefone
 *  - NUNCA logar dados de pacientes (diagnósticos, prontuários, histórico)
 *  - NUNCA logar tokens de autenticação, chaves de API ou senhas
 *  - Logar apenas: tipo de erro, stack trace, tela onde ocorreu, plano do usuário
 *
 * Estratégia: beforeSend / beforeBreadcrumb aplicam scrubbing em todas as
 * mensagens, extras, tags e breadcrumbs antes do envio ao Sentry.
 */

import * as Sentry from '@sentry/react-native';

// ── Campos PII a remover de qualquer objeto ───────────────────────────────────

const PII_KEYS = new Set([
  // Identificadores pessoais
  'nome', 'name', 'full_name', 'fullName', 'first_name', 'last_name',
  'email', 'phone', 'telefone', 'celular',
  // Documentos
  'cpf', 'cpf_hash', 'rg', 'crm', 'cnpj', 'passport',
  // Saúde
  'diagnosis', 'diagnostico', 'prontuario', 'anamnese', 'prescricao',
  'patient', 'paciente', 'patient_id', 'paciente_id',
  // Financeiro
  'card_number', 'cvv', 'asaas_id', 'asaas_customer_id',
  'routing_number', 'account_number',
  // Auth
  'password', 'senha', 'token', 'access_token', 'refresh_token',
  'api_key', 'secret', 'anon_key',
  // Endereço
  'address', 'endereco', 'cep', 'street', 'city', 'cidade',
]);

// Regex para detectar CPF no formato 000.000.000-00 ou 00000000000
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

// Regex para detectar emails
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// ── Scrubbing recursivo de objetos ────────────────────────────────────────────

function scrubValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value
      .replace(CPF_REGEX, '[CPF REMOVIDO]')
      .replace(EMAIL_REGEX, '[EMAIL REMOVIDO]');
  }

  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }

  if (typeof value === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) {
        scrubbed[k] = '[REDACTED]';
      } else {
        scrubbed[k] = scrubValue(v);
      }
    }
    return scrubbed;
  }

  return value;
}

function scrubEvent(event: Sentry.Event): Sentry.Event {
  // Scrub extras
  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }

  // Scrub contexts
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as Record<string, Record<string, unknown>>;
  }

  // Scrub user — só mantém id e plano, remove tudo mais
  if (event.user) {
    event.user = {
      id:    event.user.id,         // UUID anônimo — OK
      // plan e user_type são dados não-pessoais, úteis para debug
      ...(event.user as Record<string, unknown>)['plan'] ? { plan: (event.user as Record<string, unknown>)['plan'] } : {},
    };
  }

  // Scrub mensagem de erro (pode vir com dados no payload)
  if (event.message) {
    event.message = (scrubValue(event.message) as string);
  }

  // Scrub request body (nunca deve ter PII, mas garantimos)
  if (event.request?.data) {
    event.request.data = scrubValue(event.request.data);
  }

  return event;
}

// ── Inicialização ─────────────────────────────────────────────────────────────

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    // Em desenvolvimento sem DSN configurado — skip silencioso
    return;
  }

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',

    // Em dev, desabilita envio real para não poluir dados
    enabled: !__DEV__,

    // Taxa de amostras: 20% das sessões em produção (controle de custo)
    tracesSampleRate: 0.2,

    // ── beforeSend: scrubbing obrigatório LGPD ────────────────────────────────
    beforeSend(event) {
      // Nunca enviar erros de rede sem o request scrubbed
      return scrubEvent(event);
    },

    // ── beforeBreadcrumb: remove breadcrumbs com dados sensíveis ─────────────
    beforeBreadcrumb(breadcrumb) {
      // Nunca logar navegações para telas de pacientes com ID
      if (breadcrumb.category === 'navigation') {
        const to = breadcrumb.data?.to as string | undefined;
        // Remove parâmetros de URL que possam conter IDs de paciente
        if (to && breadcrumb.data) {
          breadcrumb.data.to   = to.replace(/\/[0-9a-f-]{36}/gi, '/[ID]');
          breadcrumb.data.from = (breadcrumb.data.from as string | undefined)
            ?.replace(/\/[0-9a-f-]{36}/gi, '/[ID]');
        }
      }

      // Nunca logar requisições HTTP com corpo (pode ter PII)
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        if (breadcrumb.data?.body) {
          breadcrumb.data.body = '[BODY REMOVIDO]';
        }
        // Remove headers de autenticação
        if (breadcrumb.data?.['request_headers']) {
          delete breadcrumb.data['request_headers']['authorization'];
          delete breadcrumb.data['request_headers']['apikey'];
        }
      }

      // Nunca logar console.log/warn com dados de pacientes
      if (breadcrumb.category === 'console') {
        if (breadcrumb.message) {
          breadcrumb.message = breadcrumb.message
            .replace(CPF_REGEX, '[CPF]')
            .replace(EMAIL_REGEX, '[EMAIL]');
        }
      }

      return breadcrumb;
    },

    // ── Integrações desabilitadas para privacidade ────────────────────────────
    integrations(integrations) {
      return integrations.filter(i => {
        // Remove integração de screenshot automático — poderia capturar dados de pacientes
        return i.name !== 'Screenshot';
      });
    },
  });
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Identifica o usuário no Sentry usando apenas o UUID (sem nome, email ou CRM).
 * Chama após login bem-sucedido.
 */
export function setSentryUser(userId: string, userType?: string): void {
  Sentry.setUser({
    id: userId,
    // Sem nome, email, cpf, crm — apenas tipo de conta para segmentar erros
    ...(userType ? { user_type: userType } : {}),
  });
}

/**
 * Remove identificação ao fazer logout.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Reporta erro capturado com contexto mínimo (sem PII).
 * Use nos catch blocks onde o erro precisa de atenção da equipe.
 */
export function reportError(error: unknown, context?: Record<string, string | number | boolean>): void {
  if (!(error instanceof Error)) return;

  // Nunca logar contexto com campos PII
  const safeContext = context
    ? Object.fromEntries(
        Object.entries(context).filter(([k]) => !PII_KEYS.has(k.toLowerCase()))
      )
    : undefined;

  Sentry.captureException(error, {
    extra: safeContext,
  });
}

/**
 * Registra evento de negócio (sem PII) para analytics de erros.
 * Ex: reportEvent('checkout_failed', { plan: 'PRO', reason: 'qr_invalid' })
 */
export function reportEvent(name: string, data?: Record<string, string | number>): void {
  Sentry.addBreadcrumb({
    category: 'oli.business',
    message:  name,
    data,
    level:    'info',
  });
}
