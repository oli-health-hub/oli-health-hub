'use server';

import { createSupabaseAdmin } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

/** Altera o plano de um médico */
export async function changePlan(formData: FormData) {
  const professionalId = formData.get('professional_id') as string;
  const planId         = formData.get('plan_id')         as string;
  const planName       = formData.get('plan_name')       as string;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('profiles')
    .update({ plan: planName, plan_id: planId })
    .eq('id', professionalId);

  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${professionalId}`);
  revalidatePath('/planos');
  revalidatePath('/medicos');
}

/** Adiciona pacote de horas manualmente para um médico.
 *  Regra de negócio: venda sempre em múltiplos inteiros de 1h, mínimo 1h. */
export async function addHours(formData: FormData) {
  const professionalId = formData.get('professional_id') as string;
  const raw            = parseFloat(formData.get('horas') as string);
  const horas          = Math.floor(raw);          // garante inteiro — nunca 0.5h
  const minutos        = horas * 60;

  if (isNaN(horas) || horas < 1) throw new Error('Mínimo de 1 hora por pacote. Vendas somente em horas inteiras.');

  const expira_em = new Date();
  expira_em.setFullYear(expira_em.getFullYear() + 1);

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('hour_balance').insert({
    professional_id: professionalId,
    minutos_total:   minutos,
    minutos_usados:  0,
    expira_em:       expira_em.toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${professionalId}`);
  revalidatePath('/horas');
}

/** Convida usuário por e-mail via Supabase Auth */
export async function inviteUser(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase();
  if (!email) throw new Error('E-mail obrigatório.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) throw new Error(error.message);
  revalidatePath('/usuarios');
}

/** Altera user_type de um usuário */
export async function setUserType(formData: FormData) {
  const userId   = formData.get('user_id')   as string;
  const userType = formData.get('user_type') as string;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('profiles')
    .update({ user_type: userType })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath('/usuarios');
}

/** Ativa / desativa um módulo de um médico */
export async function setModuleStatus(formData: FormData) {
  const userModuleId = formData.get('user_module_id') as string;
  const status       = formData.get('status')         as string;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('user_modules')
    .update({ status })
    .eq('id', userModuleId);

  if (error) throw new Error(error.message);
  revalidatePath('/modulos');
}

/** Cria ou atualiza um fornecedor */
export async function upsertSupplier(formData: FormData) {
  const id          = formData.get('id')          as string | null;
  const nome        = (formData.get('nome')        as string).trim();
  const categoria   = (formData.get('categoria')   as string | null)?.trim() || null;
  const cnpj        = (formData.get('cnpj')        as string | null)?.trim() || null;
  const contato     = (formData.get('contato')     as string | null)?.trim() || null;
  const telefone    = (formData.get('telefone')    as string | null)?.trim() || null;
  const email       = (formData.get('email')       as string | null)?.trim() || null;
  const observacoes = (formData.get('observacoes') as string | null)?.trim() || null;

  if (!nome) throw new Error('Nome do fornecedor é obrigatório.');

  const supabase = await createSupabaseAdmin();
  const payload = { nome, categoria, cnpj, contato, telefone, email, observacoes };

  if (id) {
    const { error } = await supabase.from('suppliers').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('suppliers').insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/fornecedores');
}

/** Desativa (soft-delete) um fornecedor */
export async function deactivateSupplier(formData: FormData) {
  const id = formData.get('id') as string;
  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('suppliers').update({ ativo: false }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/fornecedores');
}

/** Cria ou atualiza uma conta a pagar / receber */
export async function upsertFinancialEntry(formData: FormData) {
  const id          = formData.get('id')           as string | null;
  const tipo        = formData.get('tipo')          as string;
  const descricao   = (formData.get('descricao')   as string).trim();
  const valor       = parseFloat(formData.get('valor') as string);
  const vencimento  = formData.get('vencimento')   as string;
  const pago_em     = (formData.get('pago_em')     as string | null) || null;
  const status      = formData.get('status')        as string;
  const supplier_id = (formData.get('supplier_id') as string | null) || null;
  const categoria   = (formData.get('categoria')   as string | null)?.trim() || null;
  const observacoes = (formData.get('observacoes') as string | null)?.trim() || null;
  const recorrente  = formData.get('recorrente') === 'true';

  if (!descricao || !vencimento || isNaN(valor)) throw new Error('Campos obrigatórios faltando.');
  if (!['pagar', 'receber'].includes(tipo)) throw new Error('Tipo inválido.');

  const supabase = await createSupabaseAdmin();
  const payload = { tipo, descricao, valor, vencimento, pago_em, status, supplier_id, categoria, observacoes, recorrente };

  if (id) {
    const { error } = await supabase.from('financial_entries').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('financial_entries').insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/contas');
}

/** Marca uma conta como paga */
export async function markEntryPaid(formData: FormData) {
  const id      = formData.get('id')      as string;
  const pago_em = formData.get('pago_em') as string;
  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('financial_entries')
    .update({ status: 'pago', pago_em })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/contas');
}

/** Cancela uma conta */
export async function cancelEntry(formData: FormData) {
  const id = formData.get('id') as string;
  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('financial_entries')
    .update({ status: 'cancelado' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/contas');
}
