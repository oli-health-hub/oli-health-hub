/**
 * Edge Function: rd-leads-webhook
 *
 * Recebe os leads da RD Station CRM e grava na tabela `leads`. A RD é a fonte
 * única de lead de anúncio desde 03/ago — a integração do Meta vive dentro dela,
 * e a equipe de marketing usa as métricas da RD para montar campanha.
 * Ver docs/HANDOFF.md §24.
 *
 * ┌─ Por que dois eventos ─────────────────────────────────────────────────────┐
 * │ `crm_contact_created` traz os dados da pessoa (name, emails[], phones[],   │
 * │ job_title) — é ele que permite montar o lead.                              │
 * │                                                                            │
 * │ `crm_deal_created` NÃO traz contato nenhum. Traz funil, etapa, fonte e     │
 * │ campanha. Serve para atribuição, e o contato tem que ser buscado na API.   │
 * │                                                                            │
 * │ Assinar os dois é defensivo: dependendo de como a integração Meta→RD está  │
 * │ montada, o lead pode nascer como contato, como negociação, ou como os      │
 * │ dois. A deduplicação por e-mail garante que "os dois" não vire duplicata.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Restrições da RD que moldaram este código:
 *   - Timeout de 5s. Passou disso, ela reenvia — e o mesmo lead chega de novo.
 *   - 5 retentativas em resposta não-2xx.
 *   - Erro constante na mesma URL faz a RD SUSPENDER o webhook. Por isso o
 *     padrão aqui é responder 200; 500 só em falha realmente transitória.
 *
 * Segredos (Supabase → Edge Functions → Secrets):
 *   RD_WEBHOOK_SECRET  — valor combinado. Aceito no cabeçalho configurado em
 *                        `auth_key` na RD, ou como `?secret=` na URL de destino.
 *   RD_CRM_TOKEN       — token da API da RD CRM. Só necessário para buscar o
 *                        contato de uma negociação (evento de deal).
 *   RD_AUTH_HEADER     — opcional. Nome do cabeçalho usado no `auth_header`.
 *                        Padrão: 'x-rd-signature'.
 *   RD_CRM_API_BASE    — opcional. Padrão: https://crm.rdstation.com/api/v1
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const AUTH_HEADER  = Deno.env.get('RD_AUTH_HEADER')  ?? 'x-rd-signature';
const CRM_API_BASE = Deno.env.get('RD_CRM_API_BASE') ?? 'https://crm.rdstation.com/api/v1';

/* ──────────────────────────────────────────────────────────────────────────── */

interface ContatoRD {
  id?: string;
  name?: string;
  job_title?: string;
  emails?: Array<{ email?: string }>;
  phones?: Array<{ phone?: string; type?: string }>;
  created_at?: string;
}

/** Monta a linha de `leads` a partir de um contato da RD.
 *  Devolve null quando falta e-mail ou telefone — os dois são NOT NULL na
 *  tabela, e lead sem contato não é lead, é ruído. */
function montaLead(c: ContatoRD, extras: { campanha?: string | null; conjunto?: string | null }) {
  const email    = c.emails?.find(e => e.email)?.email?.trim();
  const telefone = c.phones?.find(p => p.phone)?.phone?.trim();
  const nome     = c.name?.trim();

  if (!nome || !email || !telefone) return null;

  return {
    external_id:   `rd_contact:${c.id}`,
    created_at:    c.created_at ?? new Date().toISOString(),
    nome:          nome.slice(0, 120),
    email:         email.slice(0, 160),
    whatsapp:      telefone.slice(0, 30),
    // job_title na RD é o mesmo campo que o formulário do Meta chamava de
    // job_title — cai direto em especialidade, como nos 22 leads importados.
    especialidade: c.job_title?.trim().slice(0, 120) || null,
    origem:        'rd_station',
    status:        'novo',
    campanha:      extras.campanha?.slice(0, 200) ?? null,
    conjunto:      extras.conjunto?.slice(0, 200) ?? null,
  };
}

/* ──────────────────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Handshake/health: a RD não faz verificação por challenge como o Meta, mas
  // um GET simples ajuda a conferir que a URL está de pé antes de cadastrar.
  if (req.method === 'GET') return new Response('ok', { status: 200 });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // ── Autenticação ──────────────────────────────────────────────────────────
  // A RD CRM permite configurar um cabeçalho customizado (auth_header/auth_key),
  // mas isso não aparece em toda versão do painel. O segredo na query é o plano
  // B — menos elegante, porém a URL só existe no cadastro do webhook.
  const segredo = Deno.env.get('RD_WEBHOOK_SECRET');
  if (!segredo) {
    console.error('[rd-leads] RD_WEBHOOK_SECRET ausente — recusando tudo');
    return new Response('Server misconfigured', { status: 500 });
  }
  const recebido = req.headers.get(AUTH_HEADER) ?? url.searchParams.get('secret');
  if (recebido !== segredo) {
    console.warn('[rd-leads] segredo inválido');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: { event_name?: string; document?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const evento = payload.event_name;
  const doc    = payload.document ?? {};

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  /** Grava um contato, pulando quem já existe. 200 sempre que der pra seguir. */
  async function gravar(c: ContatoRD, extras: { campanha?: string | null; conjunto?: string | null }) {
    const linha = montaLead(c, extras);
    if (!linha) {
      console.warn(`[rd-leads] contato ${c.id} sem e-mail ou telefone — ignorado`);
      return true;
    }

    // ── Deduplicação ────────────────────────────────────────────────────────
    // Por E-MAIL, não por external_id. Motivo: a mesma pessoa pode chegar como
    // contato e como negociação, e os 22 leads já importados do Meta estão na
    // tabela com external_id `l:...` — se ela reaparecer pela RD, o id seria
    // outro e entraria duplicada. E-mail é o que identifica a pessoa.
    const { data: existente } = await supabase
      .from('leads').select('id, origem').ilike('email', linha.email).limit(1).maybeSingle();

    if (existente) {
      console.log(`[rd-leads] ${linha.email} já existe (origem ${existente.origem}) — ignorado`);
      return true;
    }

    const { error } = await supabase.from('leads').insert(linha);
    if (error) {
      if (error.code === '23505') return true; // corrida entre dois envios
      console.error(`[rd-leads] erro ao gravar ${linha.email}: ${error.message}`);
      return false;
    }
    console.log(`[rd-leads] lead gravado — ${linha.nome} (${evento})`);
    return true;
  }

  // ── Contato criado: dados vêm prontos, sem chamada extra ───────────────────
  if (evento === 'crm_contact_created') {
    const ok = await gravar(doc as ContatoRD, {});
    return new Response(ok ? 'ok' : 'retry', { status: ok ? 200 : 500 });
  }

  // ── Negociação criada: precisa buscar o contato na API ─────────────────────
  if (evento === 'crm_deal_created') {
    const dealId   = doc.id as string | undefined;
    const crmToken = Deno.env.get('RD_CRM_TOKEN');

    if (!dealId || !crmToken) {
      // Sem token não dá pra buscar o contato. Não é erro recuperável por
      // retentativa — 200 pra não fazer a RD suspender o webhook.
      console.warn('[rd-leads] deal recebido sem RD_CRM_TOKEN configurado — ignorado');
      return new Response('ok', { status: 200 });
    }

    // Atribuição: é o único evento que traz de onde o lead veio.
    const fonte    = (doc.deal_source as { name?: string } | undefined)?.name ?? null;
    const campanha = (doc.campaign     as { name?: string } | undefined)?.name ?? null;

    const resp = await fetch(`${CRM_API_BASE}/deals/${dealId}/contacts?token=${crmToken}`);
    if (!resp.ok) {
      console.error(`[rd-leads] API da RD falhou para deal ${dealId}: ${resp.status}`);
      return new Response('retry', { status: 500 });
    }

    const body = await resp.json();
    // A RD ora devolve array puro, ora embrulhado em { contacts: [...] }.
    const contatos: ContatoRD[] = Array.isArray(body) ? body : (body.contacts ?? []);

    let tudoOk = true;
    for (const c of contatos) {
      const ok = await gravar(c, { campanha, conjunto: fonte });
      if (!ok) tudoOk = false;
    }
    return new Response(tudoOk ? 'ok' : 'retry', { status: tudoOk ? 200 : 500 });
  }

  // Qualquer outro evento (tarefa, produto, empresa, atualização, exclusão):
  // 200 sem fazer nada. Responder erro aqui faria a RD reenviar e, no limite,
  // suspender o webhook por "erro constante".
  return new Response('ok', { status: 200 });
});
