/**
 * Edge Function: whatsapp-nutricao-comercial
 *
 * Dispara a régua de nutrição comercial (docs/WHATSAPP_NUTRICAO_COMERCIAL.md)
 * pra leads com opt-in registrado — primeiro contato + 4 etapas de retomada
 * (D+3, D+10, D+24, D+45, cada uma contada a partir do envio da anterior).
 * Chamada pelo cron via pg_net e pelo Admin para iniciar um lead específico,
 * nunca pelo Meta — `verify_jwt: true`.
 *
 * INERTE por padrão: só envia quando o template da etapa está com
 * `whatsapp_templates.status_aprovacao = 'aprovado'` — mesmo gate que
 * `send-patient-trigger` já usa. Enquanto não aprovado, a etapa continua
 * `agendada` e a função só espera — não marca erro, não cancela, tenta de
 * novo no próximo ciclo do cron sozinha assim que alguém aprovar o template.
 *
 * Nenhuma etapa é criada aqui: quem cria a primeira ('primeiro_contato') é o
 * admin, ao registrar o opt-in do lead (ver admin/app/actions.ts). Esta
 * função só processa o que já está na agenda e encadeia a etapa seguinte
 * depois de um envio bem-sucedido.
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { enviarTemplate, normalizaTelefone } from '../_shared/whatsapp.ts';

const PROXIMA_ETAPA: Record<string, { etapa: string; deltaDias: number } | null> = {
  primeiro_contato: { etapa: 'd3',  deltaDias: 3  },
  d3:                { etapa: 'd10', deltaDias: 10 },
  d10:               { etapa: 'd24', deltaDias: 24 },
  d24:               { etapa: 'd45', deltaDias: 45 },
  d45:               null, // encerramento — não agenda próxima
};

type Etapa = {
  id: string; lead_id: string; etapa: string; created_at: string;
};

type Lead = {
  id: string; nome: string; whatsapp: string | null; status: string;
  whatsapp_opt_out_at: string | null;
};

type Template = {
  meta_template_name: string; idioma: string; corpo: string; status_aprovacao: string;
};

/** Cancela a etapa com um motivo — usado quando o lead saiu de elegibilidade
 *  (opt-out, convertido/descartado, sem whatsapp) e não faz sentido reter na
 *  fila esperando aprovação de template que nunca vai disparar mesmo. */
async function cancela(supabase: SupabaseClient, etapaId: string, motivo: string) {
  await supabase.from('whatsapp_nutricao_etapas')
    .update({ status: 'cancelada', erro: motivo })
    .eq('id', etapaId);
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // O Admin envia { leadId } para tentar o primeiro contato imediatamente.
  // Cron e demais chamadas sem body processam a fila normal de até 20 etapas.
  let leadId: string | null = null;
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (typeof body?.leadId === 'string' && body.leadId.trim()) leadId = body.leadId;
    } catch {
      // pg_net pode enviar body vazio; nesse caso segue para a fila normal.
    }
  }

  let query = supabase
    .from('whatsapp_nutricao_etapas')
    .select('id, lead_id, etapa, created_at')
    .eq('status', 'agendada')
    .lte('data_prevista', new Date().toISOString());

  if (leadId) query = query.eq('lead_id', leadId);
  const { data: devidas, error } = await query.limit(leadId ? 1 : 20);

  if (error) {
    console.error('[whatsapp-nutricao] erro ao buscar etapas devidas:', error);
    return new Response('Erro ao buscar etapas', { status: 500 });
  }

  let enviados = 0, aguardandoAprovacao = 0, canceladas = 0, falhas = 0;

  for (const etapaRow of (devidas ?? []) as Etapa[]) {
    try {
      const [{ data: lead }, { data: template }, { data: conversa }] = await Promise.all([
        supabase.from('leads').select('id, nome, whatsapp, status, whatsapp_opt_out_at').eq('id', etapaRow.lead_id).maybeSingle(),
        supabase.from('whatsapp_templates').select('meta_template_name, idioma, corpo, status_aprovacao').eq('trigger_type', etapaRow.etapa).maybeSingle(),
        supabase.from('conversations').select('id, status, last_inbound_at').eq('kind', 'lead').eq('lead_id', etapaRow.lead_id).maybeSingle(),
      ]);

      const leadRow = lead as Lead | null;
      const templateRow = template as Template | null;

      if (!leadRow) { await cancela(supabase, etapaRow.id, 'lead não encontrado'); canceladas++; continue; }
      if (leadRow.whatsapp_opt_out_at) { await cancela(supabase, etapaRow.id, 'opt-out registrado'); canceladas++; continue; }
      if (leadRow.status === 'convertido' || leadRow.status === 'descartado') {
        await cancela(supabase, etapaRow.id, `lead já ${leadRow.status}`); canceladas++; continue;
      }
      if (!leadRow.whatsapp) { await cancela(supabase, etapaRow.id, 'lead sem whatsapp'); canceladas++; continue; }

      const primeiroNome = leadRow.nome.trim().split(/\s+/)[0];
      if (!primeiroNome || /^contato$/i.test(primeiroNome)) {
        await cancela(supabase, etapaRow.id, 'sem nome real — placeholder de WhatsApp'); canceladas++; continue;
      }

      // Reforço defensivo: a cancelação principal quando o lead responde
      // acontece no whatsapp-webhook, em tempo real. Isso aqui só cobre uma
      // corrida rara entre o inbound chegar e este cron já ter pego a etapa.
      if (conversa?.status === 'humano') { await cancela(supabase, etapaRow.id, 'conversa em atendimento humano'); canceladas++; continue; }
      if (conversa?.last_inbound_at && conversa.last_inbound_at > etapaRow.created_at) {
        await cancela(supabase, etapaRow.id, 'lead respondeu desde o agendamento'); canceladas++; continue;
      }

      if (!templateRow || templateRow.status_aprovacao !== 'aprovado') {
        // Não é erro — só ainda não pode disparar. Fica agendada, tenta de
        // novo no próximo ciclo.
        aguardandoAprovacao++; continue;
      }

      const phone = normalizaTelefone(leadRow.whatsapp);
      const { wamid } = await enviarTemplate({
        to: phone, templateName: templateRow.meta_template_name, idioma: templateRow.idioma,
        variaveis: [primeiroNome],
      });

      let conversationId = conversa?.id;
      if (!conversationId) {
        const { data: criada } = await supabase.from('conversations').insert({
          kind: 'lead', lead_id: leadRow.id, phone_e164: phone, status: 'ia',
        }).select('id').single();
        conversationId = criada?.id;
      }

      if (conversationId) {
        await supabase.from('messages').insert({
          conversation_id: conversationId, direction: 'outbound', sender_type: 'ia',
          body: templateRow.corpo.replace('{{1}}', primeiroNome), wamid, status: 'enviada',
          template_name: templateRow.meta_template_name,
        });
      }

      await supabase.from('whatsapp_nutricao_etapas')
        .update({ status: 'enviada', enviado_em: new Date().toISOString() })
        .eq('id', etapaRow.id);

      const proxima = PROXIMA_ETAPA[etapaRow.etapa];
      if (proxima) {
        const dataPrevista = new Date(Date.now() + proxima.deltaDias * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('whatsapp_nutricao_etapas')
          .insert({ lead_id: leadRow.id, etapa: proxima.etapa, status: 'agendada', data_prevista: dataPrevista })
          .select().maybeSingle(); // conflito com unique(lead_id,etapa) é esperado se já existir — ignora
      }

      enviados++;
    } catch (err) {
      console.error(`[whatsapp-nutricao] erro na etapa ${etapaRow.id}:`, err);
      await supabase.from('whatsapp_nutricao_etapas')
        .update({ status: 'falhou', erro: String(err) })
        .eq('id', etapaRow.id);
      falhas++;
    }
  }

  console.log(`[whatsapp-nutricao] devidas=${devidas?.length ?? 0} enviados=${enviados} aguardando_aprovacao=${aguardandoAprovacao} canceladas=${canceladas} falhas=${falhas}`);
  return new Response(JSON.stringify({ devidas: devidas?.length ?? 0, enviados, aguardandoAprovacao, canceladas, falhas }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
