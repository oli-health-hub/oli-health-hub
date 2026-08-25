/**
 * Edge Function: rd-setup-webhook (utilitária — rodar sob demanda)
 *
 * Cadastra os webhooks da RD Station CRM apontando pra `rd-leads-webhook`.
 * Existe pra tirar o passo manual do caminho: a função lê RD_CRM_TOKEN e
 * RD_WEBHOOK_SECRET do próprio ambiente e monta a URL de destino sozinha, então
 * o segredo nunca precisa ser digitado à mão em lugar nenhum — e não tem como
 * cadastrar com segredo diferente do que a função valida.
 *
 * Body: { "acao": "listar" | "criar" | "apagar", "uuid": "..." }
 *   listar (padrão) — só mostra o que já existe.
 *   criar          — cria os dois eventos, pulando o que já aponta pra cá.
 */

const CRM_API_BASE = Deno.env.get('RD_CRM_API_BASE') ?? 'https://crm.rdstation.com/api/v1';
const EVENTOS = ['crm_contact_created', 'crm_deal_created'];

Deno.serve(async (req: Request) => {
  const token   = Deno.env.get('RD_CRM_TOKEN');
  const segredo = Deno.env.get('RD_WEBHOOK_SECRET');
  const baseUrl = Deno.env.get('SUPABASE_URL');

  if (!token)   return Response.json({ erro: 'RD_CRM_TOKEN ausente' },      { status: 500 });
  if (!segredo) return Response.json({ erro: 'RD_WEBHOOK_SECRET ausente' }, { status: 500 });

  const destino = `${baseUrl}/functions/v1/rd-leads-webhook?secret=${encodeURIComponent(segredo)}`;

  let opts: { acao?: string; uuid?: string } = {};
  try { opts = await req.json(); } catch { /* padrão */ }
  const acao = opts.acao ?? 'listar';

  // ── O que já existe ──────────────────────────────────────────────────
  const rl = await fetch(`${CRM_API_BASE}/webhooks?token=${token}`);
  const bl = rl.ok ? await rl.json() : null;
  const existentes = Array.isArray(bl) ? bl : (bl?.webhooks ?? []);

  // Mascara o segredo antes de devolver: a resposta desta função vai parar em
  // log e em conversa. Nunca expõe o valor.
  const mascarar = (u: unknown) =>
    typeof u === 'string' ? u.replace(/secret=[^&]+/, 'secret=***') : u;

  const resumoExistentes = existentes.map((w: Record<string, unknown>) => ({
    uuid: w.uuid, event_type: w.event_type, url: mascarar(w.url),
    apontaPraCa: typeof w.url === 'string' && w.url.includes('rd-leads-webhook'),
  }));

  if (acao === 'listar') {
    return Response.json({
      listarStatus: rl.status,
      destino: mascarar(destino),
      existentes: resumoExistentes,
    });
  }

  if (acao === 'apagar' && opts.uuid) {
    const r = await fetch(`${CRM_API_BASE}/webhooks/${opts.uuid}?token=${token}`, { method: 'DELETE' });
    return Response.json({ apagado: opts.uuid, status: r.status });
  }

  // ── Criar ─────────────────────────────────────────────────────────
  const resultado: Record<string, unknown>[] = [];
  for (const evento of EVENTOS) {
    // Evita duplicar: cadastrar duas vezes o mesmo evento faria a RD entregar
    // o lead em dobro — a dedup por e-mail seguraria, mas é ruído à toa.
    const jaExiste = existentes.some((w: Record<string, unknown>) =>
      w.event_type === evento && typeof w.url === 'string' && w.url.includes('rd-leads-webhook'));
    if (jaExiste) { resultado.push({ evento, status: 'já existia' }); continue; }

    const r = await fetch(`${CRM_API_BASE}/webhooks?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event_type: evento, url: destino, http_method: 'POST' }),
    });
    const corpo = await r.text();
    resultado.push({ evento, status: r.status, resposta: mascarar(corpo.slice(0, 400)) });
  }

  return Response.json({ destino: mascarar(destino), resultado });
});
