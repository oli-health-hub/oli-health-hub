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

// ─────────────────────────────────────────────────────────────────────────────
// GESTÃO DE MÉDICOS / CONTRATO / ACESSO
// ─────────────────────────────────────────────────────────────────────────────

type AccountStatus = 'active' | 'paused' | 'suspended' | 'banned' | 'deleted';

/** Altera o status da conta (active/paused/suspended/banned).
 *  paused = pausa temporária (médico em férias, sem renovação). Pode reativar.
 *  suspended = suspenso por inadimplência ou problema operacional.
 *  banned = banido por violação de regras (irreversível administrativamente). */
export async function changeAccountStatus(formData: FormData) {
  const userId = formData.get('user_id') as string;
  const status = formData.get('status') as AccountStatus;
  const reason = (formData.get('reason') as string | null)?.trim() || null;

  const supabase = await createSupabaseAdmin();

  const { error } = await supabase
    .from('profiles')
    .update({
      account_status:    status,
      status_reason:     reason,
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  // Se status != active, força logout em todas as sessões
  if (status !== 'active') {
    await supabase.auth.admin.signOut(userId, 'global').catch(() => {});
  }

  revalidatePath(`/medicos/${userId}`);
  revalidatePath('/medicos');
}

/** Bloqueia/libera o acesso do médico à área de Comunidade do app */
export async function toggleComunidadeAccess(formData: FormData) {
  const userId  = formData.get('user_id')  as string;
  const banned  = formData.get('banned')   === 'true';
  const reason  = (formData.get('reason')  as string | null)?.trim() || null;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('profiles')
    .update({
      comunidade_banned:    banned,
      comunidade_ban_reason: banned ? reason : null,
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${userId}`);
}

/** Atualiza datas e URL do contrato */
export async function updateContract(formData: FormData) {
  const userId    = formData.get('user_id')         as string;
  const startDate = (formData.get('start_date')     as string | null) || null;
  const endDate   = (formData.get('end_date')       as string | null) || null;
  const docUrl    = (formData.get('contract_doc_url') as string | null)?.trim() || null;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('profiles')
    .update({
      contract_start_date: startDate,
      contract_end_date:   endDate,
      contract_doc_url:    docUrl,
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${userId}`);
}

/** Atualiza dados de perfil que o admin pode modificar diretamente */
export async function updateProfileFields(formData: FormData) {
  const userId = formData.get('user_id') as string;

  const updates: Record<string, unknown> = {};
  const setIfPresent = (key: string, formKey: string) => {
    const v = formData.get(formKey);
    if (v !== null) updates[key] = (v as string).trim() || null;
  };

  setIfPresent('nome',          'nome');
  setIfPresent('crm',           'crm');
  setIfPresent('especialidade', 'especialidade');
  setIfPresent('tratamento',    'tratamento');
  setIfPresent('cidade_uf',     'cidade_uf');
  setIfPresent('admin_notes',   'admin_notes');

  if (Object.keys(updates).length === 0) return;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${userId}`);
}

/** Soft delete: marca account_status='deleted', deleted_at=now, força logout.
 *  Mantém dados históricos (reservas, cobranças, LGPD audit). */
export async function softDeleteUser(formData: FormData) {
  const userId = formData.get('user_id') as string;
  const reason = (formData.get('reason') as string | null)?.trim() || 'Excluído pelo admin';

  const supabase = await createSupabaseAdmin();

  const { error } = await supabase
    .from('profiles')
    .update({
      account_status:    'deleted',
      status_reason:     reason,
      status_changed_at: new Date().toISOString(),
      deleted_at:        new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  await supabase.auth.admin.signOut(userId, 'global').catch(() => {});

  revalidatePath('/medicos');
  revalidatePath(`/medicos/${userId}`);
}

/** Adiciona documento ao prontuário do médico (URL já no Storage) */
export async function addProfessionalDocument(formData: FormData) {
  const userId    = formData.get('user_id')   as string;
  const type      = formData.get('doc_type')  as string;
  const name      = (formData.get('name')      as string).trim();
  const url       = (formData.get('url')       as string).trim();
  const sizeBytes = parseInt(formData.get('size_bytes') as string, 10) || null;
  const expiresAt = (formData.get('expires_at') as string | null) || null;

  if (!name || !url) throw new Error('Nome e URL são obrigatórios.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('professional_documents').insert({
    professional_id: userId,
    type,
    name,
    url,
    size_bytes:      sizeBytes,
    expires_at:      expiresAt,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${userId}`);
}

/** Remove documento (admin) */
export async function removeProfessionalDocument(formData: FormData) {
  const id     = formData.get('id')      as string;
  const userId = formData.get('user_id') as string;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('professional_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${userId}`);
}
