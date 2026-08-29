/**
 * Edge Function: rd-vincular-deals
 *
 * Preenche `leads.rd_deal_id` cruzando por e-mail as negociações da RD, e em
 * seguida espelha o status dos que acabou de vincular.
 *
 * ┌─ Por que isto roda em cron, e não só uma vez ────────────────────────────┐
 * │ O webhook `crm_contact_created` entrega o CONTATO — e nesse instante a     │
 * │ negociação pode nem existir ainda na RD. O lead entra sem `rd_deal_id`, e  │
 * │ o trigger de sincronização pula quem não tem deal. Resultado observado em  │
 * │ 06/ago: 7 leads novos com status mudado no painel e NADA indo pra RD.     │
 * │ Vinculação precisa ser recorrente, não carga única.                       │
 * └───────────────────────────────────────────────────────────────┘
 *
 * Idempotente: só mexe em quem está sem `rd_deal_id`. Body: { "dryRun": true }.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CRM_API_BASE = Deno.env.get('RD_CRM_API_BASE') ?? 'https://crm.rdstation.com/api/v1';

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

  const r = await fetch(`${CRM_API_BASE}/deals?token=${token}&limit=200`);
  if (!r.ok) return Response.json({ erro: `deals HTTP ${r.status}` }, { status: 502 });
  const body = await r.json();
  const deals = Array.isArray(body) ? body : (body.deals ?? []);

  // e-mail -> deal. Havendo mais de uma negociação, fica a MAIS RECENTE: é a
  // que representa o momento atual da pessoa no funil.
  const porEmail = new Map<string, { id: string; criado: string; etapa: string }>();
  for (const d of deals) {
    for (const c of (d.contacts ?? [])) {
      for (const e of (c.emails ?? [])) {
        const em = e.email?.toLowerCase().trim();
        if (!em) continue;
        const atual = porEmail.get(em);
        if (!atual || String(d.created_at) > atual.criado) {
          porEmail.set(em, { id: d.id, criado: String(d.created_at), etapa: d.deal_stage?.name ?? '?' });
        }
      }
    }
  }

  const { data: leads } = await supabase
    .from('leads').select('id, nome, email, status').is('rd_deal_id', null);

  const { data: mapa } = await supabase.from('rd_stage_map').select('status, rd_stage_id, rd_stage_nome');
  const porStatus = new Map((mapa ?? []).map(m => [m.status, m]));

  const vinculados: string[] = [], semDeal: string[] = [], erros: string[] = [];

  for (const lead of leads ?? []) {
    // `email` é opcional desde 03/ago (lead pode ter só whatsapp) — sem essa
    // guarda, o primeiro lead sem e-mail (todo lead de origem='whatsapp')
    // derrubava a função inteira com "Internal Server Error" (TypeError em
    // `null.toLowerCase()`), abortando o lote inteiro a cada rodada do cron
    // e travando a vinculação de QUALQUER lead, com ou sem e-mail — achado
    // em produção em 29/ago (44 leads presos abertos na RD).
    if (!lead.email) { semDeal.push(`${lead.nome} <sem e-mail>`); continue; }

    const deal = porEmail.get(lead.email.toLowerCase().trim());
    if (!deal) { semDeal.push(`${lead.nome} <${lead.email}>`); continue; }
    if (dryRun) { vinculados.push(`${lead.nome} → deal ${deal.id}`); continue; }

    const { error } = await supabase.from('leads').update({ rd_deal_id: deal.id }).eq('id', lead.id);
    if (error) { erros.push(`${lead.email}: ${error.message}`); continue; }

    // Vincular por UPDATE de `rd_deal_id` NÃO dispara o trigger, que só escuta
    // `update of status`. Então o espelhamento tem que ser feito aqui — senão
    // o lead fica vinculado mas parado na etapa errada da RD até alguém mexer
    // no status de novo. Foi exatamente esse buraco que deixou 7 leads pra trás.
    const destino = porStatus.get(lead.status);
    if (destino && destino.rd_stage_id !== undefined) {
      const rp = await fetch(`${CRM_API_BASE}/deals/${deal.id}?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal: { deal_stage_id: destino.rd_stage_id } }),
      });
      // 422 = já está na etapa. Não é falha.
      const ok = rp.ok || rp.status === 422;
      await supabase.from('leads').update(
        ok ? { rd_sync_em: new Date().toISOString(), rd_sync_erro: null }
           : { rd_sync_erro: `HTTP ${rp.status} ao espelhar após vincular` },
      ).eq('id', lead.id);
    }

    vinculados.push(`${lead.nome} → ${deal.id} (${destino?.rd_stage_nome ?? lead.status})`);
  }

  return Response.json({
    dryRun, dealsLidos: deals.length,
    vinculados: vinculados.length, semDealNaRD: semDeal.length,
    detalheVinculados: vinculados, detalheSemDeal: semDeal, erros,
  });
});
