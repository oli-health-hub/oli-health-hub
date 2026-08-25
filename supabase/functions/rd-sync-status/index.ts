/**
 * Edge Function: rd-sync-status
 *
 * Espelha na RD Station CRM a mudança de etapa feita no painel. O painel é a
 * fonte de verdade do status — a equipe não mexe no funil da RD.
 * Ver docs/HANDOFF.md §25.
 *
 * Chamada pelo trigger `trg_lead_status_para_rd` via pg_net a cada mudança, ou
 * à mão para manutenção:
 *   { "leadId": "..." }           — um lead
 *   { "reprocessarFalhas": true } — só quem está com rd_sync_erro
 *   { "todos": true }             — alinhamento geral
 *
 * verify_jwt = true: só service role chama.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CRM_API_BASE = Deno.env.get('RD_CRM_API_BASE') ?? 'https://crm.rdstation.com/api/v1';

Deno.serve(async (req: Request) => {
  const token = Deno.env.get('RD_CRM_TOKEN');
  if (!token) return Response.json({ erro: 'RD_CRM_TOKEN ausente' }, { status: 500 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let opts: { leadId?: string; reprocessarFalhas?: boolean; todos?: boolean } = {};
  try { opts = await req.json(); } catch { /* sem body */ }

  // Mapa em tabela, lido a cada execução: mudar a tradução de uma etapa é um
  // UPDATE, sem redeploy.
  const { data: mapa } = await supabase.from('rd_stage_map').select('status, rd_stage_id, rd_stage_nome');
  const porStatus = new Map((mapa ?? []).map(m => [m.status, m]));

  let query = supabase.from('leads').select('id, nome, status, rd_deal_id').not('rd_deal_id', 'is', null);
  if (opts.leadId)                 query = query.eq('id', opts.leadId);
  else if (opts.reprocessarFalhas) query = query.not('rd_sync_erro', 'is', null);
  else if (!opts.todos)            return Response.json({ erro: 'informe leadId, reprocessarFalhas ou todos' }, { status: 400 });

  const { data: leads, error: erroLeitura } = await query;
  if (erroLeitura) return Response.json({ erro: erroLeitura.message }, { status: 500 });

  const ok: string[] = [], jaEstava: string[] = [], falhas: string[] = [];

  async function marcarOk(id: string) {
    await supabase.from('leads')
      .update({ rd_sync_em: new Date().toISOString(), rd_sync_erro: null }).eq('id', id);
  }

  for (const lead of leads ?? []) {
    const destino = porStatus.get(lead.status);
    if (!destino) {
      const msg = `status "${lead.status}" não está em rd_stage_map`;
      await supabase.from('leads').update({ rd_sync_erro: msg }).eq('id', lead.id);
      falhas.push(`${lead.nome}: ${msg}`);
      continue;
    }

    const r = await fetch(`${CRM_API_BASE}/deals/${lead.rd_deal_id}?token=${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal: { deal_stage_id: destino.rd_stage_id } }),
    });

    if (r.ok) {
      await marcarOk(lead.id);
      ok.push(`${lead.nome} → ${destino.rd_stage_nome}`);
      console.log(`[rd-sync] ${lead.nome} → ${destino.rd_stage_nome}`);
      continue;
    }

    const corpo = await r.text();

    // A RD devolve 422 quando se manda mover a negociação para a etapa em que
    // ela JÁ ESTÁ. Isso não é falha — o destino desejado foi alcançado. Tratar
    // como erro encheria a tela de alerta falso e faria o alinhamento geral
    // nunca convergir.
    // O corpo do 422 traz a negociação inteira, então dá pra confirmar sem
    // gastar uma requisição extra de GET.
    if (r.status === 422) {
      try {
        const d = JSON.parse(corpo);
        if (d?.deal_stage?.id === destino.rd_stage_id) {
          await marcarOk(lead.id);
          jaEstava.push(`${lead.nome} (já em ${destino.rd_stage_nome})`);
          continue;
        }
      } catch { /* corpo não é JSON — cai como falha real abaixo */ }
    }

    const msg = `HTTP ${r.status}: ${corpo.slice(0, 200)}`;
    // Grava o erro na própria linha: sem isso a falha some, e lead
    // dessincronizado em silêncio é exatamente o problema que esta feature
    // existe pra resolver.
    await supabase.from('leads').update({ rd_sync_erro: msg }).eq('id', lead.id);
    falhas.push(`${lead.nome}: ${msg}`);
    console.error(`[rd-sync] ${lead.nome}: ${msg}`);
  }

  return Response.json({
    movidos: ok.length, jaEstavamNaEtapa: jaEstava.length, falhas: falhas.length,
    ok, jaEstava, falhas,
  });
});
