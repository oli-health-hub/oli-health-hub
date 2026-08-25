/**
 * Edge Function: rd-backfill
 *
 * Carga única dos contatos que JÁ existiam na RD Station CRM antes do webhook.
 * Ver docs/HANDOFF.md §24.
 *
 * ┌─ A descoberta que fez esta função funcionar ───────────────────────────┐
 * │ GET /contacts devolve `job_title` VAZIO em 100% dos casos e telefone em    │
 * │ menos da metade. GET /deals embute o contato com `title` (o cargo) e      │
 * │ `phones` preenchidos. Ler só /contacts descartaria 19 de 40 contatos e    │
 * │ perderia a especialidade de todos. Por isso as duas fontes são cruzadas.  │
 * └───────────────────────────────────────────────────────────────┘
 *
 * Body: { "dryRun": true }  — padrão true, não grava nada.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CRM_API_BASE = Deno.env.get('RD_CRM_API_BASE') ?? 'https://crm.rdstation.com/api/v1';

/** Registros de teste da configuração da integração + o próprio fundador.
 *  Lista explícita, não heurística: "contém teste" descartaria alguém chamado
 *  Modesto por acidente. Revisável — está tudo listado no HANDOFF §24. */
const IGNORAR = new Set([
  'test@meta.com',
  'teste@gmail.com',
  'gabriel_aristoteles@hotmail.com',
  'gabriel.aristoteles@gmail.com',
  'meloi.michelle@gmail.com',
  'm-eloi@hotmail.com',
  'guilherme.pasquetti@gmail.com',
  'guilhermeissa@hotmail.com',
]);

/** A RD guarda telefone como a pessoa digitou: "+5511988395090", "11954080860"
 *  (sem +55) e "922222799" (sem DDD). Normaliza o que dá e devolve
 *  `suspeito` quando falta dígito — esse caso vira observação, não palpite. */
function normalizaTelefone(bruto: string | null): { valor: string | null; suspeito: boolean } {
  if (!bruto) return { valor: null, suspeito: false };
  const d = bruto.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) return { valor: `+${d}`, suspeito: false };
  if (d.length === 10 || d.length === 11)   return { valor: `+55${d}`, suspeito: false };
  return { valor: bruto.slice(0, 30), suspeito: true }; // sem DDD: não dá pra inventar
}

Deno.serve(async (req: Request) => {
  const token = Deno.env.get('RD_CRM_TOKEN');
  if (!token) return Response.json({ erro: 'RD_CRM_TOKEN ausente' }, { status: 500 });

  let opts: { dryRun?: boolean } = {};
  try { opts = await req.json(); } catch { /* padrão */ }
  const dryRun = opts.dryRun !== false;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const rc = await fetch(`${CRM_API_BASE}/contacts?token=${token}&limit=200`);
  if (!rc.ok) return Response.json({ erro: `contacts HTTP ${rc.status}` }, { status: 502 });
  const bc = await rc.json();
  const contatos = Array.isArray(bc) ? bc : (bc.contacts ?? []);

  const rd = await fetch(`${CRM_API_BASE}/deals?token=${token}&limit=200`);
  if (!rd.ok) return Response.json({ erro: `deals HTTP ${rd.status}` }, { status: 502 });
  const bd = await rd.json();
  const deals = Array.isArray(bd) ? bd : (bd.deals ?? []);

  // Indexa por e-mail o que a negociação sabe — cargo, telefone, fonte, campanha
  const doDeal = new Map<string, { title: string | null; telefone: string | null; fonte: string | null; campanha: string | null }>();
  for (const d of deals) {
    for (const c of (d.contacts ?? [])) {
      const em = (c.emails ?? []).find((e: { email?: string }) => e.email)?.email?.toLowerCase().trim();
      if (!em) continue;
      const anterior = doDeal.get(em);
      doDeal.set(em, {
        title:    c.title ?? anterior?.title ?? null,
        telefone: (c.phones ?? []).find((p: { phone?: string }) => p.phone)?.phone ?? anterior?.telefone ?? null,
        fonte:    d.deal_source?.name ?? anterior?.fonte ?? null,
        campanha: d.campaign?.name    ?? anterior?.campanha ?? null,
      });
    }
  }

  const inseridos: string[] = [], enriquecidos: string[] = [], ignorados: string[] = [], semDados: string[] = [];
  const erros: string[] = [];

  for (const c of contatos) {
    const email = (c.emails ?? []).find((e: { email?: string }) => e.email)?.email?.toLowerCase().trim();
    const nome  = c.name?.trim();
    if (!email || !nome) { semDados.push(email ?? '(sem e-mail)'); continue; }
    if (IGNORAR.has(email)) { ignorados.push(email); continue; }

    const extra = doDeal.get(email);
    const tel   = normalizaTelefone(
      (c.phones ?? []).find((p: { phone?: string }) => p.phone)?.phone ?? extra?.telefone ?? null,
    );
    const cargo = (c.job_title ?? extra?.title ?? null)?.trim() || null;

    const { data: existente } = await supabase
      .from('leads').select('id, fonte, especialidade').ilike('email', email).limit(1).maybeSingle();

    // ── Já existe: só enriquece o que está vazio ─────────────────────────────
    // NUNCA sobrescreve campanha/conjunto/anuncio: neles está o criativo do
    // Meta, que a RD não tem. `fonte` é coluna nova, por isso pode receber.
    if (existente) {
      const patch: Record<string, string> = {};
      if (!existente.fonte && extra?.fonte)                 patch.fonte = extra.fonte.slice(0, 120);
      if (!existente.especialidade && cargo)                patch.especialidade = cargo.slice(0, 120);
      if (Object.keys(patch).length === 0) continue;

      if (!dryRun) {
        const { error } = await supabase.from('leads').update(patch).eq('id', existente.id);
        if (error) { erros.push(`${email}: ${error.message}`); continue; }
      }
      enriquecidos.push(`${email} ← ${Object.keys(patch).join('+')}`);
      continue;
    }

    // ── Novo ─────────────────────────────────────────────────────────
    const obs: string[] = [];
    if (!tel.valor)     obs.push('Sem telefone na RD — contato por e-mail.');
    if (tel.suspeito)   obs.push(`Telefone incompleto na RD ("${tel.valor}") — confirmar DDD antes de chamar no WhatsApp.`);

    if (!dryRun) {
      const { error } = await supabase.from('leads').insert({
        external_id:   `rd_contact:${c.id}`,
        created_at:    c.created_at ?? new Date().toISOString(),
        nome:          nome.slice(0, 120),
        email:         email.slice(0, 160),
        whatsapp:      tel.suspeito ? null : tel.valor,  // incompleto não vira WhatsApp
        especialidade: cargo?.slice(0, 120) ?? null,
        origem:        'rd_station',
        status:        'novo',
        fonte:         extra?.fonte?.slice(0, 120) ?? null,
        campanha:      extra?.campanha?.slice(0, 200) ?? null,
        observacoes:   obs.length ? obs.join(' ') : null,
      });
      if (error && error.code !== '23505') { erros.push(`${email}: ${error.message}`); continue; }
    }
    inseridos.push(`${nome} <${email}> tel=${tel.valor ?? 'nenhum'} cargo=${cargo ?? '-'}`);
  }

  return Response.json({
    dryRun,
    resumo: {
      contatosRD: contatos.length, dealsRD: deals.length,
      inseridos: inseridos.length, enriquecidos: enriquecidos.length,
      ignorados: ignorados.length, semDados: semDados.length, erros: erros.length,
    },
    inseridos, enriquecidos, ignorados, erros,
  });
});
