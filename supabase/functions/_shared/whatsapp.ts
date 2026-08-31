/**
 * Utilitários compartilhados para integração com o WhatsApp Business Cloud API
 * (Meta), número único da OLI. Usado por whatsapp-webhook, send-patient-trigger
 * e send-whatsapp-reply.
 *
 * Segredos necessários (Supabase → Edge Functions → Secrets):
 *   WHATSAPP_PHONE_NUMBER_ID — ID do número comercial no Meta Business Manager.
 *   WHATSAPP_ACCESS_TOKEN    — token de acesso do WhatsApp Business Account.
 *   META_APP_SECRET          — já existe (usado por meta-leads-webhook), o
 *                              mesmo App do Meta cobre os dois produtos.
 *   WHATSAPP_VERIFY_TOKEN    — string inventada por nós para o handshake do
 *                              webhook de mensagens (separado do
 *                              META_VERIFY_TOKEN do webhook de leads).
 */

const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') ?? 'v23.0';

/** HMAC-SHA256 do corpo cru — mesmo mecanismo do meta-leads-webhook. */
export async function assinaturaConfere(corpoCru: string, header: string | null, segredo: string): Promise<boolean> {
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

  if (esperado.length !== recebido.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}

/** Normaliza telefone para o formato que o Graph API usa (E.164 sem '+').
 *  Assume Brasil (55) quando o número não vier com código de país. */
export function normalizaTelefone(raw: string): string {
  const digitos = raw.replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

/** Baixa uma mídia recebida pelo webhook do WhatsApp. A URL temporária da
 * Meta nunca é persistida; o chamador descarta o Blob após processá-lo. */
export async function baixarMidiaWhatsApp(mediaId: string): Promise<{ arquivo: Blob; mimeType: string }> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN ausente — mensageria ainda não configurada');

  const metadataResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const metadata = await metadataResponse.json() as { url?: string; mime_type?: string };
  if (!metadataResponse.ok || !metadata.url) {
    throw new Error(`Meta não retornou a mídia ${mediaId}: ${metadataResponse.status}`);
  }

  const mediaResponse = await fetch(metadata.url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!mediaResponse.ok) throw new Error(`Falha ao baixar mídia do WhatsApp: ${mediaResponse.status}`);

  return {
    arquivo: new Blob([await mediaResponse.arrayBuffer()], { type: metadata.mime_type ?? 'audio/ogg' }),
    mimeType: metadata.mime_type ?? 'audio/ogg',
  };
}

async function chamarGraphMessages(payload: Record<string, unknown>): Promise<{ wamid: string }> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken    = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN ausente — mensageria ainda não configurada');
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`WhatsApp Graph API falhou: ${res.status} ${JSON.stringify(data)}`);

  const wamid = data.messages?.[0]?.id as string | undefined;
  if (!wamid) throw new Error(`WhatsApp Graph API respondeu sem message id: ${JSON.stringify(data)}`);
  return { wamid };
}

/** Mensagem de texto livre — só aceita pela Meta dentro da janela de 24h
 *  desde a última mensagem recebida do destinatário. */
export async function enviarTexto(opts: { to: string; body: string }): Promise<{ wamid: string }> {
  return chamarGraphMessages({
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'text',
    text: { body: opts.body },
  });
}

/** Mensagem de imagem por link público (mesma janela de 24h do texto livre). */
export async function enviarImagem(opts: { to: string; link: string; caption?: string }): Promise<{ wamid: string }> {
  return chamarGraphMessages({
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'image',
    image: { link: opts.link, caption: opts.caption },
  });
}

/** Sobe um arquivo pro Media Storage da Meta e devolve o media id — usado
 *  quando a imagem vem de upload direto (equipe anexando no /conversas), sem
 *  passar por um bucket público como as fotos fixas de FOTO_POR_ESPECIALIDADE
 *  exigem. Media id expira em ~30 dias, mas a mensagem já foi enviada. */
export async function subirMidiaWhatsApp(arquivo: Blob, mimeType: string): Promise<{ mediaId: string }> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken    = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN ausente — mensageria ainda não configurada');
  }

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', arquivo, 'imagem');
  form.append('type', mimeType);

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`Upload de mídia falhou: ${res.status} ${JSON.stringify(data)}`);
  return { mediaId: data.id as string };
}

/** Mensagem de imagem por media id já enviado à Meta (ver subirMidiaWhatsApp) —
 *  caminho pra anexo de upload direto, diferente de enviarImagem (link público). */
export async function enviarImagemPorId(opts: { to: string; mediaId: string; caption?: string }): Promise<{ wamid: string }> {
  return chamarGraphMessages({
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'image',
    image: { id: opts.mediaId, caption: opts.caption },
  });
}

/** Mensagem via template pré-aprovado — única forma de iniciar conversa fora
 *  da janela de 24h. `variaveis` preenche {{1}}, {{2}}... na ordem.
 *  `headerImageUrl` só se aplica a template cujo cabeçalho aprovado na Meta
 *  é do tipo Imagem — mandar num template de cabeçalho texto (ou sem
 *  cabeçalho) faz a Meta recusar a mensagem. */
export async function enviarTemplate(opts: {
  to: string; templateName: string; idioma: string; variaveis: string[]; headerImageUrl?: string;
}): Promise<{ wamid: string }> {
  const components: unknown[] = [];
  if (opts.headerImageUrl) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { link: opts.headerImageUrl } }] });
  }
  if (opts.variaveis.length > 0) {
    components.push({ type: 'body', parameters: opts.variaveis.map(v => ({ type: 'text', text: v })) });
  }
  return chamarGraphMessages({
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: opts.idioma },
      components: components.length > 0 ? components : undefined,
    },
  });
}
