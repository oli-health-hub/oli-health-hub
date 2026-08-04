/**
 * Edge Function: meta-leads-webhook
 *
 * Recebe os leads de tráfego pago do Meta (Instagram/Facebook Lead Ads) em tempo
 * real e grava direto na tabela `leads`. Substitui a importação manual da planilha
 * do Google — ver docs/HANDOFF.md §19, §20 e §23.
 *
 * Fluxo:
 *   1. Meta manda GET com hub.challenge para verificar o endpoint (uma vez).
 *   2. Meta manda POST a cada lead novo, com `leadgen_id` — e SÓ o id, sem os
 *      dados da pessoa.
 *   3. A função busca os dados na Graph API usando o leadgen_id.
 *   4. Grava em `leads` com origem 'meta_ads'.
 *   5. O trigger `trg_notify_lead_created` (já existente) dispara a notificação,
 *      que chega no feed do admin por realtime, sem recarregar a página.
 *
 * Segredos necessários (Supabase → Edge Functions → Secrets):
 *   META_VERIFY_TOKEN      — string inventada por nós; tem que ser idêntica à
 *                            digitada no painel do Meta ao assinar o webhook.
 *   META_APP_SECRET        — App Secret do app do Meta. Valida a assinatura.
 *   META_PAGE_ACCESS_TOKEN — token da Página, longo prazo. Sem ele não dá pra
 *                            ler os dados do lead.
 *   META_GRAPH_VERSION     — opcional. Se a Graph API recusar a versão, é ESTE
 *                            valor que se muda (ex.: 'v25.0'), sem tocar em código.
 *
 * verify_jwt = false de propósito: quem chama é o Meta, que não tem JWT do
 * Supabase. A autenticação real é a assinatura HMAC do corpo da requisição.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') ?? 'v23.0';

/* ────────────────────────────────────────────────────────────────────────────
 * Assinatura
 * ──────────────────────────────────────────────────────────────────────────── */

/** HMAC-SHA256 do corpo cru. O Meta assina os BYTES recebidos — reserializar o
 *  JSON muda o resultado, por isso o corpo é lido como texto e só depois parseado. */
async function assinaturaConfere(corpoCru: string, header: string | null, segredo: string): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(corpoCru));
  const esperado = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  const recebido = header.slice('sha256='.length);

  // Comparação de tempo constante: sair no primeiro byte diferente vaza
  // informação sobre o quanto do hash já está certo.
  if (esperado.length !== recebido.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Normalização dos nomes de campanha
 * ──────────────────────────────────────────────────────────────────────────── */

/** Extrai as tags entre colchetes de um nome do Meta.
 *  "[Conversão] [Geração de Lead] [Formulário Nativo]" → ['Conversão','Geração de Lead','Formulário Nativo'] */
function tags(nome: string | null | undefined): string[] {
  if (!nome) return [];
  return [...nome.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
}

/** Nome do conjunto sem repetir o que já está no nome da campanha.
 *  "[Conversão] [Geração de Lead] [Formulário Nativo] [RMKT LP]" → "Formulário Nativo + RMKT LP"
 *  Cosmético: se o padrão de nome mudar, cai no nome cru — não quebra nada. */
function limpaConjunto(adsetName: string | null, campaignName: string | null): string | null {
  if (!adsetName) return null;
  const doCampaign = new Set(tags(campaignName));
  const restantes  = tags(adsetName).filter(t => !doCampaign.has(t));
  return restantes.length > 0 ? restantes.join(' + ').slice(0, 200) : adsetName.slice(0, 200);
}

/** "[...][Novos Criativos][05]" → "Criativo 05". Sem o padrão, devolve o nome cru. */
function limpaAnuncio(adName: string | null): string | null {
  if (!adName) return null;
  const numero = tags(adName).find(t => /^\d{1,3}$/.test(t));
  return numero ? `Criativo ${numero}` : adName.slice(0, 200);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Campos do formulário
 * ──────────────────────────────────────────────────────────────────────────── */

/** O nome de cada pergunta é escolhido por quem monta o formulário no Meta, então
 *  não dá pra confiar num nome só. O formulário atual usa `whatsapp_number`, mas
 *  um formulário novo pode vir com `phone_number` — daí a lista de sinônimos. */
const SINONIMOS: Record<string, string[]> = {
  nome:          ['full_name', 'nome', 'name', 'first_name'],
  email:         ['email', 'e-mail'],
  whatsapp:      ['whatsapp_number', 'phone_number', 'telefone', 'whatsapp', 'phone'],
  especialidade: ['job_title', 'especialidade', 'profissao', 'profissão', 'area'],
};

function extraiCampos(fieldData: Array<{ name: string; values: string[] }>): Record<string, string> {
  const cru: Record<string, string> = {};
  for (const f of fieldData ?? []) {
    const valor = (f.values ?? [])[0];
    if (valor) cru[f.name.toLowerCase()] = valor.trim();
  }

  const saida: Record<string, string> = {};
  for (const [destino, chaves] of Object.entries(SINONIMOS)) {
    const achou = chaves.find(k => cru[k]);
    if (achou) saida[destino] = cru[achou];
  }
  return saida;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Handler
 * ──────────────────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── 1. Handshake de verificação do endpoint ───────────────────────────────
  // Só acontece uma vez, quando o webhook é assinado no painel do Meta.
  if (req.method === 'GET') {
    const modo      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (modo === 'subscribe' && token === Deno.env.get('META_VERIFY_TOKEN') && challenge) {
      console.log('[meta-leads] handshake verificado');
      // O Meta exige o challenge cru no corpo. Devolver 'ok' reprova a verificação.
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    console.warn('[meta-leads] handshake recusado — verify_token não confere');
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── 2. Assinatura ─────────────────────────────────────────────────────────
  const appSecret = Deno.env.get('META_APP_SECRET');
  if (!appSecret) {
    console.error('[meta-leads] META_APP_SECRET ausente — recusando tudo');
    return new Response('Server misconfigured', { status: 500 });
  }

  const corpoCru = await req.text();
  if (!await assinaturaConfere(corpoCru, req.headers.get('x-hub-signature-256'), appSecret)) {
    console.warn('[meta-leads] assinatura inválida');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: {
    object?: string;
    entry?: Array<{ changes?: Array<{ field?: string; value?: Record<string, unknown> }> }>;
  };
  try {
    payload = JSON.parse(corpoCru);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const leadgenIds = (payload.entry ?? [])
    .flatMap(e => e.changes ?? [])
    .filter(c => c.field === 'leadgen')
    .map(c => c.value?.leadgen_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (leadgenIds.length === 0) {
    // Notificação de outro tipo (ou teste do painel). Nada a fazer, mas 200 —
    // qualquer outro código faz o Meta reenviar em loop.
    return new Response('ok', { status: 200 });
  }

  const pageToken = Deno.env.get('META_PAGE_ACCESS_TOKEN');
  if (!pageToken) {
    console.error('[meta-leads] META_PAGE_ACCESS_TOKEN ausente');
    return new Response('Server misconfigured', { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let houveFalhaTransitoria = false;

  for (const leadgenId of leadgenIds) {
    // `l:` é o prefixo que a integração Meta→Planilha usa. Mantido para os 22
    // leads já importados à mão baterem com os que chegarem por aqui — sem isso,
    // um lead reimportado da planilha entraria duplicado.
    const externalId = `l:${leadgenId}`;

    // ── Já existe? ──────────────────────────────────────────────────────────
    // O índice único parcial de external_id é a garantia final, mas checar antes
    // evita gastar chamada na Graph API à toa (o Meta reenvia o mesmo lead
    // quando não recebe 200 a tempo).
    const { data: existente } = await supabase
      .from('leads').select('id').eq('external_id', externalId).maybeSingle();
    if (existente) {
      console.log(`[meta-leads] ${externalId} já existe — ignorando reenvio`);
      continue;
    }

    // ── Busca os dados do lead ──────────────────────────────────────────────
    const campos = 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic';
    const resp = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}?fields=${campos}&access_token=${pageToken}`,
    );

    if (!resp.ok) {
      // Token expirado, versão da Graph recusada, indisponibilidade — todos
      // transitórios do ponto de vista do Meta. Devolver 500 no fim faz ele
      // reenviar, então o lead não se perde.
      console.error(`[meta-leads] Graph API falhou para ${leadgenId}: ${resp.status} ${await resp.text()}`);
      houveFalhaTransitoria = true;
      continue;
    }

    const lead = await resp.json() as {
      created_time?: string;
      field_data?: Array<{ name: string; values: string[] }>;
      ad_name?: string; adset_name?: string; campaign_name?: string; platform?: string;
    };

    const campos_ = extraiCampos(lead.field_data ?? []);

    // nome, whatsapp e email são NOT NULL na tabela. Sem eles não dá pra
    // trabalhar o lead — registra e segue, sem derrubar os outros do lote.
    if (!campos_.nome || !campos_.email || !campos_.whatsapp) {
      console.error(`[meta-leads] ${externalId} sem campo obrigatório — recebidos: ${JSON.stringify(Object.keys(campos_))}`);
      continue;
    }

    const { error } = await supabase.from('leads').insert({
      external_id:   externalId,
      created_at:    lead.created_time ?? new Date().toISOString(),
      nome:          campos_.nome.slice(0, 120),
      email:         campos_.email.slice(0, 160),
      whatsapp:      campos_.whatsapp.slice(0, 30),
      especialidade: campos_.especialidade?.slice(0, 120) ?? null,
      origem:        'meta_ads',
      status:        'novo',
      campanha:      lead.campaign_name?.slice(0, 200) ?? null,
      conjunto:      limpaConjunto(lead.adset_name ?? null, lead.campaign_name ?? null),
      anuncio:       limpaAnuncio(lead.ad_name ?? null),
      plataforma:    lead.platform === 'fb' ? 'facebook' : lead.platform === 'ig' ? 'instagram' : (lead.platform ?? null),
    });

    if (error) {
      // 23505 = violação de unicidade: dois webhooks do mesmo lead chegaram
      // juntos e passaram os dois pela checagem acima. O índice fez o trabalho.
      if (error.code === '23505') {
        console.log(`[meta-leads] ${externalId} duplicado na corrida — índice segurou`);
        continue;
      }
      console.error(`[meta-leads] erro ao gravar ${externalId}: ${error.message}`);
      houveFalhaTransitoria = true;
      continue;
    }

    console.log(`[meta-leads] lead ${externalId} gravado — ${campos_.nome}`);
  }

  // 500 faz o Meta reenviar o lote. Só usar quando a falha for recuperável —
  // lead sem campo obrigatório não entra aqui, porque reenviar não resolveria.
  if (houveFalhaTransitoria) {
    return new Response('Retry', { status: 500 });
  }
  return new Response('ok', { status: 200 });
});
