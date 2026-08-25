/**
 * Edge Function: send-patient-trigger
 *
 * Envia uma mensagem de template pro paciente (confirmação de consulta ou
 * lembrete véspera), disparada manualmente pela recepção a partir de uma
 * reserva. Sempre via template — é a OLI que inicia a conversa, fora da
 * janela de 24h, e a Meta exige template pré-aprovado nesse caso.
 *
 * Chamado pelo admin (service role) — verify_jwt padrão (true) é suficiente,
 * quem chama já tem uma chave/JWT válida do Supabase.
 *
 * Body: { reservationId: string, triggerType: 'confirmacao_consulta' | 'lembrete_vespera' }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { enviarTemplate, normalizaTelefone } from '../_shared/whatsapp.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  let body: { reservationId: string; triggerType: 'confirmacao_consulta' | 'lembrete_vespera' };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!body.reservationId || !body.triggerType) {
    return json({ error: 'reservationId e triggerType são obrigatórios' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, professional_id, patient_id, start_time')
    .eq('id', body.reservationId)
    .maybeSingle();
  if (!reservation)          return json({ error: 'Reserva não encontrada' }, 404);
  if (!reservation.patient_id) return json({ error: 'Reserva sem paciente vinculado' }, 400);

  const [{ data: patient }, { data: professional }, { data: template }] = await Promise.all([
    supabase.from('patients').select('id, nome, telefone').eq('id', reservation.patient_id).single(),
    supabase.from('profiles').select('nome, tratamento').eq('id', reservation.professional_id).single(),
    supabase.from('whatsapp_templates').select('*').eq('trigger_type', body.triggerType).single(),
  ]);

  if (!patient)      return json({ error: 'Paciente não encontrado' }, 404);
  if (!professional) return json({ error: 'Profissional não encontrado' }, 404);
  if (!template)     return json({ error: 'Template não configurado' }, 400);
  if (template.status_aprovacao !== 'aprovado') {
    return json({ error: `Template "${body.triggerType}" ainda não foi aprovado pela Meta (status atual: ${template.status_aprovacao})` }, 400);
  }
  if (!patient.telefone) return json({ error: 'Paciente sem telefone cadastrado' }, 400);

  const phone = normalizaTelefone(patient.telefone);
  const dataConsulta = new Date(reservation.start_time);
  const dataFmt    = dataConsulta.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long' });
  const horaFmt    = dataConsulta.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const nomeMedico = professional.tratamento ? `${professional.tratamento} ${professional.nome}` : professional.nome;
  const variaveis  = [patient.nome, nomeMedico, dataFmt, horaFmt];

  let { data: conversation } = await supabase.from('conversations').select('*').eq('phone_e164', phone).maybeSingle();
  if (!conversation) {
    const { data: criada, error } = await supabase.from('conversations').insert({
      kind: 'patient', patient_id: patient.id, professional_id: reservation.professional_id,
      phone_e164: phone, status: 'humano',
    }).select().single();
    if (error) return json({ error: error.message }, 500);
    conversation = criada;
  }

  try {
    const { wamid } = await enviarTemplate({
      to: phone, templateName: template.meta_template_name, idioma: template.idioma, variaveis,
    });

    await supabase.from('messages').insert({
      conversation_id: conversation.id, direction: 'outbound', sender_type: 'staff',
      body: template.corpo, wamid, status: 'enviada', template_name: template.meta_template_name,
    });

    return json({ ok: true, conversationId: conversation.id });
  } catch (err) {
    console.error('[send-patient-trigger] erro ao enviar:', err);
    return json({ error: String(err) }, 502);
  }
});
