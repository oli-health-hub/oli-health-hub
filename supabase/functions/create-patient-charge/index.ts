/**
 * Edge Function: create-patient-charge
 *
 * Gera cobrança de paciente usando a credencial da SUBCONTA do médico (não a
 * ASAAS_API_KEY master) — dinheiro cai direto na subconta, OLI não é
 * intermediário recebedor. CPF do paciente trafega só nesta chamada, nunca
 * persiste em patients (mesmo padrão do cpfClear do Communicare).
 *
 * ⚠️ NÃO DEPLOYADA — mesma pendência do asaas-create-subaccount, mais a
 * decisão do fundador sobre taxa da OLI. v1 assume 100% do valor pro médico,
 * sem split — ver "Decisões ainda em aberto" no plano da sessão de 19/ago
 * (docs/HANDOFF.md). Se a OLI decidir cobrar uma fatia, este é o ponto certo
 * pra entrar (reduzir `value` ou usar o split nativo da Asaas).
 *
 * Body: { reservationId, cpfPaciente, billingType }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { asaasBase } from '../_shared/asaas.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  let body: { reservationId: string; cpfPaciente: string; billingType: 'PIX' | 'BOLETO_BANCARIO' | 'CREDIT_CARD' };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!body.reservationId || !body.cpfPaciente || !body.billingType) {
    return json({ error: 'reservationId, cpfPaciente e billingType são obrigatórios' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, professional_id, patient_id, status, valor_consulta')
    .eq('id', body.reservationId)
    .maybeSingle();
  if (!reservation)                        return json({ error: 'Reserva não encontrada' }, 404);
  if (reservation.status !== 'concluido')  return json({ error: 'Reserva ainda não foi concluída' }, 400);
  if (!reservation.patient_id)             return json({ error: 'Reserva sem paciente vinculado' }, 400);
  if (!reservation.valor_consulta)         return json({ error: 'Valor da consulta não informado' }, 400);

  const { data: existingCharge } = await supabase
    .from('patient_charges').select('id').eq('reservation_id', reservation.id).maybeSingle();
  if (existingCharge) return json({ error: 'Já existe cobrança para esta reserva' }, 409);

  const { data: account } = await supabase
    .from('professional_asaas_accounts')
    .select('status, asaas_api_key_enc')
    .eq('professional_id', reservation.professional_id)
    .maybeSingle();
  if (!account || account.status !== 'aprovada') {
    return json({ error: 'Subconta Asaas do médico ainda não está aprovada' }, 400);
  }

  const { data: apiKey, error: decryptError } = await supabase.rpc('oli_decrypt', { cipher: account.asaas_api_key_enc });
  if (decryptError || !apiKey) return json({ error: 'Falha ao decriptar credencial da subconta' }, 500);

  const { data: patient } = await supabase.from('patients').select('nome, telefone').eq('id', reservation.patient_id).single();
  if (!patient) return json({ error: 'Paciente não encontrado' }, 404);

  const subHeaders = { 'Content-Type': 'application/json', 'access_token': apiKey as string, 'User-Agent': 'OLIHealthHub/1.0' };
  const base = asaasBase();

  // Cliente Asaas do paciente, sob a subconta do médico — não a conta master.
  const cpfDigits = body.cpfPaciente.replace(/\D/g, '');
  const customerSearch = await fetch(`${base}/customers?cpfCnpj=${cpfDigits}&limit=1`, { headers: subHeaders });
  const customerSearchData = await customerSearch.json();
  let customerId = customerSearchData.data?.[0]?.id as string | undefined;

  if (!customerId) {
    const customerRes = await fetch(`${base}/customers`, {
      method: 'POST',
      headers: subHeaders,
      body: JSON.stringify({ name: patient.nome, cpfCnpj: cpfDigits, mobilePhone: patient.telefone?.replace(/\D/g, '') }),
    });
    const customer = await customerRes.json();
    if (!customer.id) return json({ error: `Asaas: falha ao criar cliente — ${JSON.stringify(customer)}` }, 502);
    customerId = customer.id;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const chargeRes = await fetch(`${base}/payments`, {
    method: 'POST',
    headers: subHeaders,
    body: JSON.stringify({
      customer:          customerId,
      billingType:       body.billingType,
      value:             reservation.valor_consulta,
      dueDate:           dueDate.toISOString().split('T')[0],
      description:       'Consulta — OLI Health Hub',
      externalReference: `patient_charge::${reservation.id}`,
    }),
  });
  const charge = await chargeRes.json();
  if (!charge.id) return json({ error: `Asaas: falha na cobrança — ${JSON.stringify(charge)}` }, 502);

  const { data: created, error } = await supabase.from('patient_charges').insert({
    professional_id:        reservation.professional_id,
    patient_id:             reservation.patient_id,
    reservation_id:         reservation.id,
    valor:                  reservation.valor_consulta,
    billing_type:           body.billingType,
    asaas_payment_id_plain: charge.id,
    status:                 'pendente',
  }).select().single();

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, chargeId: created.id, invoiceUrl: charge.invoiceUrl });
});
