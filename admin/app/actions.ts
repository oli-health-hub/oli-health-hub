'use server';

import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';

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
  // No-op pra perfil que não é médico (founder/specialist/partner/team) —
  // essa rota não existe pra eles. Revalida mesmo assim: é de lá (modo
  // demonstração em /equipe/[id]) que este action também é chamado.
  revalidatePath(`/equipe/${professionalId}`);
  revalidatePath('/horas');
}

/** Zera na hora o saldo de horas de um perfil — usado pelo "Modo
 *  demonstração" em /equipe/[id] (founder), pra desligar o acesso a
 *  reserva/checkout no app assim que a visita do cliente terminar, sem
 *  esperar a validade de 1 ano expirar sozinha. Expira em vez de apagar:
 *  mantém o histórico de quanto já foi concedido. */
export async function desativarHorasDemonstracao(formData: FormData) {
  const professionalId = formData.get('professional_id') as string;
  const agora = new Date().toISOString();

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('hour_balance')
    .update({ expira_em: agora })
    .eq('professional_id', professionalId)
    .gt('expira_em', agora);

  if (error) throw new Error(error.message);
  revalidatePath(`/equipe/${professionalId}`);
  revalidatePath(`/medicos/${professionalId}`);
  revalidatePath('/horas');
}

/** Convida usuário por e-mail via Supabase Auth */
export async function inviteUser(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase();
  if (!email) throw new Error('E-mail obrigatório.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://admin.olihealthhub.com.br/definir-senha',
  });
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

  // Mesmo provisionamento automático de createTeamProfile — cobre conversão
  // de conta existente em parceiro via /usuarios.
  if (userType === 'partner') {
    await supabase.rpc('generate_referral_code', { p_user_id: userId });
    await supabase.from('partner_commission_config').upsert({ partner_id: userId }, { onConflict: 'partner_id', ignoreDuplicates: true });
  }

  revalidatePath('/usuarios');
}

/** Concede/revoga acesso ao painel admin — independente do user_type (papel na Comunidade) */
export async function toggleAdminAccess(formData: FormData) {
  const userId   = formData.get('user_id')  as string;
  const isAdmin  = formData.get('is_admin') === 'true';

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
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
  revalidatePath('/equipe');
}

/** Hard delete: apaga completamente do auth + todos os dados relacionados (irreversível). */
export async function hardDeleteUser(formData: FormData) {
  const userId = formData.get('user_id') as string;
  if (!userId) throw new Error('user_id obrigatório');

  const supabase = await createSupabaseAdmin();

  // Limpar FKs sem CASCADE antes do delete principal
  await supabase.from('coupon_redemptions').delete().eq('professional_id', userId);
  await supabase.from('coupons').update({ created_by: null }).eq('created_by', userId);
  await supabase.from('profiles').update({ referido_por: null }).eq('referido_por', userId);

  // Deletar do auth.users — cascata para profiles e todas as tabelas com CASCADE
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath('/medicos');
  revalidatePath('/equipe');
}

// ─── Cobrança de paciente via subconta Asaas ───────────────────────────────────

/** Salva/atualiza os dados de onboarding da subconta Asaas de um médico.
 *  Status fica 'rascunho' — o envio real pra Asaas (asaas-create-subaccount)
 *  ainda não está deployado, depende de confirmação do produto de subconta
 *  com o comercial deles. CPF/CNPJ não é coletado aqui de propósito: só
 *  trafega na hora do envio real, nunca fica guardado em texto puro. */
export async function saveAsaasAccountDraft(formData: FormData) {
  const professionalId = formData.get('professional_id') as string;
  const tipoPessoa       = formData.get('tipo_pessoa')     as string;
  const nomeCompleto      = (formData.get('nome_completo') as string ?? '').trim();
  const email              = (formData.get('email')         as string ?? '').trim();
  const telefone            = (formData.get('telefone')     as string ?? '').trim();

  if (!nomeCompleto || !email) throw new Error('Nome completo e e-mail são obrigatórios.');
  if (!['pf', 'pj'].includes(tipoPessoa)) throw new Error('Tipo de pessoa inválido.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('professional_asaas_accounts').upsert({
    professional_id: professionalId,
    tipo_pessoa:      tipoPessoa,
    nome_completo:    nomeCompleto,
    email,
    telefone,
    status:           'rascunho',
  }, { onConflict: 'professional_id' });
  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${professionalId}`);
}

/** Vincula um paciente + valor a uma reserva concluída — pré-requisito pra
 *  gerar cobrança. */
export async function linkPatientToReservation(formData: FormData) {
  const reservationId  = formData.get('reservation_id')  as string;
  const professionalId = formData.get('professional_id') as string;
  const patientId       = formData.get('patient_id')      as string;
  const valor            = parseFloat(formData.get('valor_consulta') as string);

  if (!patientId) throw new Error('Selecione um paciente.');
  if (isNaN(valor) || valor <= 0) throw new Error('Valor da consulta deve ser maior que zero.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('reservations')
    .update({ patient_id: patientId, valor_consulta: valor })
    .eq('id', reservationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/medicos/${professionalId}`);
}

/** Gera a cobrança na subconta Asaas do médico. Só funciona depois que
 *  create-patient-charge for deployado (pendente de decisão de taxa/produto
 *  — ver docs/HANDOFF.md) e a subconta estiver com status 'aprovada'. */
export async function generatePatientCharge(formData: FormData) {
  const reservationId  = formData.get('reservation_id')  as string;
  const professionalId = formData.get('professional_id') as string;
  const cpfPaciente      = (formData.get('cpf_paciente') as string ?? '').replace(/\D/g, '');
  const billingType       = formData.get('billing_type') as string;

  if (!cpfPaciente) throw new Error('CPF do paciente é obrigatório para gerar a cobrança.');

  const supabase = await createSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke('create-patient-charge', {
    body: { reservationId, cpfPaciente, billingType },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath(`/medicos/${professionalId}`);
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

// ─── Cupons de desconto ───────────────────────────────────────────────────────

/** Cria um cupom de desconto */
export async function createCoupon(formData: FormData) {
  const code             = (formData.get('code') as string ?? '').trim().toUpperCase();
  const tipo             = formData.get('tipo') as string;            // 'percentual' | 'fixo'
  const valor            = parseFloat(formData.get('valor') as string);
  const aplicavel_a      = (formData.get('aplicavel_a') as string) || 'todos';
  const validadeRaw      = (formData.get('validade') as string) || '';
  const limiteRaw        = (formData.get('limite_uso') as string) || '';
  const plano_recorrente = formData.get('plano_recorrente') === 'on';
  const descricao        = (formData.get('descricao') as string) || null;

  if (!code) throw new Error('Código obrigatório');
  if (!['percentual', 'fixo'].includes(tipo)) throw new Error('Tipo inválido');
  if (isNaN(valor) || valor <= 0) throw new Error('Valor deve ser maior que zero');
  if (tipo === 'percentual' && valor > 100) throw new Error('Percentual não pode passar de 100');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('coupons').insert({
    code,
    tipo,
    valor,
    aplicavel_a,
    plano_recorrente,
    validade:   validadeRaw ? new Date(`${validadeRaw}T23:59:59`).toISOString() : null,
    limite_uso: limiteRaw ? parseInt(limiteRaw, 10) : null,
    descricao,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/cupons');
}

/** Ativa/desativa um cupom (recebe o estado atual e inverte) */
export async function toggleCoupon(formData: FormData) {
  const id        = formData.get('id') as string;
  const ativoAtual = formData.get('ativo') === 'true';

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('coupons').update({ ativo: !ativoAtual }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/cupons');
}

/** Apaga um cupom. Resgate pendente/cancelado some junto; cupom com resgate
 *  confirmado só pode ser desativado (auditoria) — a tela nem oferece o botão. */
export async function deleteCoupon(formData: FormData) {
  const id = formData.get('id') as string;

  const supabase = await createSupabaseAdmin();
  const { count, error: countError } = await supabase
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', id)
    .eq('status', 'confirmed');
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const { error: redError } = await supabase
    .from('coupon_redemptions').delete().eq('coupon_id', id);
  if (redError) throw new Error(redError.message);

  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/cupons');
}

/** Apaga um post da comunidade (moderação) */
export async function deletePost(formData: FormData) {
  const postId = formData.get('post_id') as string;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
  revalidatePath('/comunidade');
}

/** Envia push broadcast (ou pra 1 médico) pra todos os tokens registrados.
 *  Chama a Expo Push API direto — já estamos server-side com service role. */
export async function sendBroadcastPush(formData: FormData) {
  const title            = formData.get('title') as string;
  const body             = formData.get('body') as string;
  const professionalId   = (formData.get('professional_id') as string) || null;

  if (!title?.trim() || !body?.trim()) throw new Error('Título e mensagem são obrigatórios.');

  const supabase = await createSupabaseAdmin();
  let query = supabase.from('push_tokens').select('token');
  if (professionalId) query = query.eq('professional_id', professionalId);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { sent: 0, total: 0 };

  const messages = rows.map((r) => ({ to: r.token, title, body, sound: 'default' as const }));
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) continue;
    const result = await res.json() as { data?: { status: string }[] };
    sent += result.data?.filter((t) => t.status === 'ok').length ?? 0;
  }

  revalidatePath('/notificacoes');
  return { sent, total: messages.length };
}

// ─── Equipe (founder / especialista / parceiro / equipe OLI) ──────────────────

const TEAM_USER_TYPES = ['founder', 'specialist', 'partner', 'team'] as const;
type TeamUserType = (typeof TEAM_USER_TYPES)[number];

function slugify(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Cria um perfil de equipe (founder/especialista/parceiro) — não é login real,
 *  só existe pra ter presença na Comunidade do app. Cria um auth.users interno
 *  (sem enviar e-mail de convite) + preenche os campos relevantes no profiles. */
export async function createTeamProfile(formData: FormData) {
  const nome          = (formData.get('nome') as string ?? '').trim();
  const userType      = formData.get('user_type') as string;
  const especialidade = (formData.get('especialidade') as string | null)?.trim() || null;
  const bio            = (formData.get('bio')          as string | null)?.trim() || null;
  const fotoUrl         = (formData.get('foto_url')     as string | null)?.trim() || null;
  const instagram       = (formData.get('instagram')    as string | null)?.trim() || null;
  const linkedin        = (formData.get('linkedin')     as string | null)?.trim() || null;
  const website          = (formData.get('website')      as string | null)?.trim() || null;
  const whatsapp         = (formData.get('whatsapp')     as string | null)?.trim() || null;

  if (!nome) throw new Error('Nome é obrigatório.');
  if (!TEAM_USER_TYPES.includes(userType as TeamUserType)) throw new Error('Tipo de perfil inválido.');

  const supabase = await createSupabaseAdmin();
  const email = `equipe+${slugify(nome)}-${Date.now().toString(36)}@olihealthhub.com.br`;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomUUID(),
    user_metadata: { nome },
  });
  if (createError) throw new Error(createError.message);

  const userId = created.user.id;

  // A linha em profiles já foi criada pelo trigger handle_new_user (plan=START,
  // user_type=subscriber) — só falta ajustar pros campos de equipe.
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      user_type: userType,
      especialidade,
      bio,
      foto_url: fotoUrl,
      instagram,
      linkedin,
      website,
      whatsapp,
      onboarding_complete: true,
      // Perfis de equipe não são médicos — nunca carregam campos clínicos.
      tratamento: null,
      crm: null,
      subespecialidades: null,
      tipos_atendimento: null,
      convenios: null,
    })
    .eq('id', userId);
  if (updateError) throw new Error(updateError.message);

  // Parceiro precisa de código de indicação (link /baixar?ref=) + config de
  // comissão (default: comissiona, valores do modelo-padrão) pra funcionar
  // sem precisar de SQL manual.
  if (userType === 'partner') {
    await supabase.rpc('generate_referral_code', { p_user_id: userId });
    await supabase.from('partner_commission_config').insert({ partner_id: userId });
  }

  revalidatePath('/equipe');
}

/** Atualiza dados de um perfil de equipe (founder/especialista/parceiro) */
export async function updateTeamProfileFields(formData: FormData) {
  const userId = formData.get('user_id') as string;
  if (!userId) throw new Error('user_id obrigatório');

  const updates: Record<string, unknown> = {};
  const setIfPresent = (key: string, formKey: string) => {
    const v = formData.get(formKey);
    if (v !== null) updates[key] = (v as string).trim() || null;
  };

  const userType = formData.get('user_type') as string | null;
  if (userType !== null) {
    if (!TEAM_USER_TYPES.includes(userType as TeamUserType)) throw new Error('Tipo de perfil inválido.');
    updates.user_type = userType;
  }

  setIfPresent('nome',          'nome');
  setIfPresent('especialidade', 'especialidade');
  setIfPresent('bio',           'bio');
  setIfPresent('foto_url',      'foto_url');
  setIfPresent('instagram',     'instagram');
  setIfPresent('linkedin',      'linkedin');
  setIfPresent('website',       'website');
  setIfPresent('whatsapp',      'whatsapp');
  setIfPresent('admin_notes',   'admin_notes');

  // Perfis de equipe não são médicos — nunca carregam campos clínicos,
  // mesmo que tenham sido herdados de um cadastro de médico convertido.
  updates.tratamento = null;
  updates.crm = null;
  updates.subespecialidades = null;
  updates.tipos_atendimento = null;
  updates.convenios = null;

  if (Object.keys(updates).length === 0) return;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/equipe/${userId}`);
  revalidatePath('/equipe');
}

/** Atualiza etapa, qualificação e observações de um lead (site ou Meta Ads) */
export async function updateLead(formData: FormData) {
  const id          = formData.get('id') as string;
  const status      = formData.get('status') as string;
  const observacoes = (formData.get('observacoes') as string) || null;
  const temperatura = (formData.get('temperatura') as string) || null;
  const perfil      = (formData.get('perfil')      as string) || null;
  const atendente_id = (formData.get('atendente_id') as string) || null;
  const canal_primeiro_contato = (formData.get('canal_primeiro_contato') as string) || null;

  // O banco tem CHECK recusando motivo em lead que não está descartado. O select
  // do motivo fica sempre visível na tela, então limpar aqui evita que mover um
  // lead de volta pra esteira estoure com erro de constraint.
  const motivoInformado  = (formData.get('motivo_descarte') as string) || null;
  const motivo_descarte  = status === 'descartado' ? motivoInformado : null;

  // Revisita da base herdada da agência anterior. A data não é pedida na tela:
  // quem está atendendo não deveria ter que digitar "hoje". Fica valendo como
  // "última vez que mexeram na revisita" — voltar o lead pra 'pendente' limpa a
  // data, senão um lead recolocado na fila apareceria como já revisitado.
  const revisita_status    = (formData.get('revisita_status')    as string) || null;
  const revisita_resultado = (formData.get('revisita_resultado') as string) || null;
  const revisita_por       = (formData.get('revisita_por')       as string) || null;
  const revisita_em = revisita_status && revisita_status !== 'pendente'
    ? new Date().toISOString()
    : null;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('leads')
    .update({
      status, observacoes, temperatura, perfil, motivo_descarte, atendente_id, canal_primeiro_contato,
      revisita_status, revisita_resultado, revisita_por, revisita_em,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/leads');
}

/** Registra o opt-in de WhatsApp do lead e inicia a régua comercial pela
 *  Olivia (docs/WHATSAPP_NUTRICAO_COMERCIAL.md). Sem opt-in não existe etapa.
 *  A function é chamada para este lead em particular: se o template ainda não
 *  foi aprovado pela Meta, ela preserva a etapa agendada e não envia nada. */
export async function optInLeadWhatsapp(formData: FormData) {
  const id     = formData.get('id')     as string;
  const source = formData.get('source') as string;
  if (!source) throw new Error('Origem do opt-in é obrigatória.');

  const supabase = await createSupabaseAdmin();

  // Olivia funciona como um atendente a mais — clicar o botão já classifica
  // o lead como contatado por ela (atendido_por_ia) e tira da esteira de
  // "novo", sem depender do webhook confirmar entrega antes. Só avança quem
  // ainda estava em 'novo': se o lead já passou disso, não retrocede etapa.
  const { data: leadAtual } = await supabase
    .from('leads').select('status').eq('id', id).single();

  const { error: leadError } = await supabase
    .from('leads')
    .update({
      whatsapp_opt_in_at: new Date().toISOString(),
      whatsapp_opt_in_source: source,
      atendido_por_ia: true,
      ...(leadAtual?.status === 'novo' ? { status: 'contatado' } : {}),
    })
    .eq('id', id);
  if (leadError) throw new Error(leadError.message);

  // ON CONFLICT (lead_id, etapa) — se por algum motivo já existir a etapa
  // (reenvio do form), não duplica nem reagenda.
  const { error: etapaError } = await supabase
    .from('whatsapp_nutricao_etapas')
    .insert({ lead_id: id, etapa: 'primeiro_contato', status: 'agendada', data_prevista: new Date().toISOString() });
  if (etapaError && etapaError.code !== '23505') throw new Error(etapaError.message);

  // Não processa a fila inteira aqui. O cron continua responsável pelas
  // retomadas; este invoke tenta somente o primeiro contato deste lead agora.
  // Best-effort: se falhar (template pendente, erro transitório), a etapa
  // continua 'agendada' e o cron tenta de novo no próximo ciclo — por isso
  // NÃO propaga erro daqui. Um throw aqui já aconteceu de deixar o lead
  // corretamente atualizado no banco (status/atendido_por_ia acima) mas sem
  // nunca rodar o revalidatePath abaixo, e o admin via página de erro em vez
  // do estado novo — parecia que o clique "não tinha feito nada".
  const { error: invokeError } = await supabase.functions.invoke('whatsapp-nutricao-comercial', {
    body: { leadId: id },
  });
  if (invokeError) console.error(`[optInLeadWhatsapp] invoke falhou pro lead ${id}:`, invokeError.message);

  revalidatePath('/leads');
  revalidatePath('/conversas');
}

/** Pausa a régua: marca opt-out e cancela toda etapa ainda não enviada.
 *  Não desfaz o que já saiu — só impede os próximos disparos. */
export async function pauseLeadWhatsappNutricao(formData: FormData) {
  const id = formData.get('id') as string;
  const supabase = await createSupabaseAdmin();

  const { error: leadError } = await supabase
    .from('leads').update({ whatsapp_opt_out_at: new Date().toISOString() }).eq('id', id);
  if (leadError) throw new Error(leadError.message);

  const { error: etapaError } = await supabase
    .from('whatsapp_nutricao_etapas')
    .update({ status: 'cancelada', erro: 'pausado manualmente no admin' })
    .eq('lead_id', id).eq('status', 'agendada');
  if (etapaError) throw new Error(etapaError.message);

  revalidatePath('/leads');
}

/* Mesma sequência de PROXIMA_ETAPA da edge function whatsapp-nutricao-comercial
   — pequena demais (4 entradas) pra justificar um módulo compartilhado entre
   Next.js e Deno. Mudar uma implica mudar a outra. */
const PROXIMA_ETAPA_NUTRICAO: Record<string, { etapa: string; deltaDias: number } | null> = {
  primeiro_contato: { etapa: 'd3',  deltaDias: 3  },
  d3:                { etapa: 'd10', deltaDias: 10 },
  d10:               { etapa: 'd24', deltaDias: 24 },
  d24:               { etapa: 'd45', deltaDias: 45 },
  d45:               null,
};

/** Retoma a régua depois de uma pausa: limpa o opt-out e reativa (ou cria) a
 *  próxima etapa elegível, sempre pra "agora" — não faz o lead esperar o
 *  resto do intervalo original. Nunca substitui um opt-in ausente: sem
 *  `whatsapp_opt_in_at`, não há o que retomar. */
export async function resumeLeadWhatsappNutricao(formData: FormData) {
  const id = formData.get('id') as string;
  const supabase = await createSupabaseAdmin();

  const { data: lead } = await supabase.from('leads').select('whatsapp_opt_in_at').eq('id', id).maybeSingle();
  if (!lead?.whatsapp_opt_in_at) throw new Error('Lead sem opt-in registrado — não há régua para retomar.');

  const { error: leadError } = await supabase.from('leads').update({ whatsapp_opt_out_at: null }).eq('id', id);
  if (leadError) throw new Error(leadError.message);

  const { data: ultimaEtapa } = await supabase
    .from('whatsapp_nutricao_etapas')
    .select('id, etapa, status')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const agora = new Date().toISOString();

  if (!ultimaEtapa) {
    await supabase.from('whatsapp_nutricao_etapas')
      .insert({ lead_id: id, etapa: 'primeiro_contato', status: 'agendada', data_prevista: agora });
  } else if (ultimaEtapa.status === 'cancelada' || ultimaEtapa.status === 'falhou') {
    await supabase.from('whatsapp_nutricao_etapas')
      .update({ status: 'agendada', data_prevista: agora, erro: null })
      .eq('id', ultimaEtapa.id);
  } else if (ultimaEtapa.status === 'enviada') {
    const proxima = PROXIMA_ETAPA_NUTRICAO[ultimaEtapa.etapa];
    if (proxima) {
      const { error } = await supabase.from('whatsapp_nutricao_etapas')
        .insert({ lead_id: id, etapa: proxima.etapa, status: 'agendada', data_prevista: agora });
      if (error && error.code !== '23505') throw new Error(error.message);
    }
  }
  // status 'agendada': já está no lugar certo, retomar só limpou o opt-out.

  revalidatePath('/leads');
}

/** Registra o pagamento de uma comissão de parceiro (Programa de Indicação de
 *  Parceiros Externos). O valor devido é calculado em runtime na página —
 *  aqui só grava que aquela comissão específica (por indicado + tipo) foi paga. */
export async function registerCommissionPayment(formData: FormData) {
  const partnerId  = formData.get('partner_id')  as string;
  const referredId = formData.get('referred_id') as string;
  const tipo       = formData.get('tipo')        as string;
  const valor      = parseFloat(formData.get('valor') as string);
  const observacoes = (formData.get('observacoes') as string) || null;

  if (isNaN(valor) || valor <= 0) throw new Error('Valor de comissão inválido.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('partner_commission_payments').insert({
    partner_id:               partnerId,
    referred_professional_id: referredId,
    tipo,
    valor,
    observacoes,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/parceiros');
}

/** Atualiza a regra de comissão de um parceiro (comissiona sim/não + valores
 *  por tier). Editável no admin pra não depender de código a cada parceiro
 *  novo — cada parceiro pode ter valores diferentes do modelo-padrão. */
export async function updatePartnerCommissionConfig(formData: FormData) {
  const partnerId = formData.get('partner_id') as string;
  if (!partnerId) throw new Error('partner_id obrigatório.');

  const config = {
    partner_id:           partnerId,
    comissiona:           formData.get('comissiona') === 'true',
    primeira_hora_pct:    parseFloat(formData.get('primeira_hora_pct') as string) || 0,
    valor_base_anual:     parseFloat(formData.get('valor_base_anual') as string) || 0,
    valor_pro_anual:      parseFloat(formData.get('valor_pro_anual') as string) || 0,
    valor_base_mensal:    parseFloat(formData.get('valor_base_mensal') as string) || 0,
    valor_pro_mensal:     parseFloat(formData.get('valor_pro_mensal') as string) || 0,
    carencia_dias_mensal: parseInt(formData.get('carencia_dias_mensal') as string, 10) || 0,
    updated_at:           new Date().toISOString(),
  };

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('partner_commission_config').upsert(config, { onConflict: 'partner_id' });
  if (error) throw new Error(error.message);

  revalidatePath('/parceiros');
  revalidatePath(`/equipe/${partnerId}`);
}

// ─── Conversas WhatsApp (leads + pacientes, número único da OLI) ──────────────

/** Resposta manual da recepção numa conversa — texto livre, só funciona
 *  dentro da janela de 24h (a Edge Function recusa fora disso). */
export async function sendConversationReply(formData: FormData) {
  const conversationId = formData.get('conversation_id') as string;
  const texto           = (formData.get('texto') as string ?? '').trim();
  if (!texto) throw new Error('Mensagem vazia.');

  const supabase = await createSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke('send-whatsapp-reply', {
    body: { conversationId, texto },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath('/conversas');
}

/** Envia uma foto anexada pela equipe numa conversa — mesma janela de 24h do
 *  texto livre. O arquivo sobe pro Media Storage da Meta na Edge Function,
 *  não passa por storage nosso. */
export async function sendConversationImage(formData: FormData) {
  const conversationId = formData.get('conversation_id') as string;
  const imagem          = formData.get('imagem') as File | null;
  if (!imagem || imagem.size === 0) throw new Error('Selecione uma imagem.');

  const fd = new FormData();
  fd.set('conversationId', conversationId);
  fd.set('imagem', imagem);
  const legenda = (formData.get('legenda') as string ?? '').trim();
  if (legenda) fd.set('legenda', legenda);

  const supabase = await createSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke('send-whatsapp-image', { body: fd });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath('/conversas');
}

/** Marca a conversa como vista pela equipe agora — usado pelo /conversas pra
 *  saber quais linhas mostrar como não lidas (last_message_at mais recente
 *  que admin_last_read_at). Sem revalidatePath: é uma atualização leve e
 *  frequente (toda troca de conversa), o realtime de UPDATE em conversations
 *  já propaga pra outras abas/pessoas com o painel aberto. */
export async function markConversationRead(conversationId: string) {
  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from('conversations')
    .update({ admin_last_read_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) throw new Error(error.message);
}

/** Alterna uma conversa de lead entre IA e humano. Conversa de paciente nunca
 *  aceita 'ia' — o CHECK do banco (chk_patient_never_ia) barra isso mesmo que
 *  esta action seja chamada errado. */
export async function toggleConversationMode(formData: FormData) {
  const conversationId = formData.get('conversation_id') as string;
  const novoStatus       = formData.get('novo_status') as string;
  if (!['ia', 'humano'].includes(novoStatus)) throw new Error('Status inválido.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.from('conversations').update({ status: novoStatus }).eq('id', conversationId);
  if (error) throw new Error(error.message);
  revalidatePath('/conversas');
}

/** Dispara mensagem de template pro paciente (confirmação/lembrete) a partir
 *  de uma reserva já vinculada a paciente + valor. */
export async function triggerPatientMessage(formData: FormData) {
  const reservationId  = formData.get('reservation_id')  as string;
  const professionalId = formData.get('professional_id') as string;
  const triggerType     = formData.get('trigger_type')    as string;

  const supabase = await createSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke('send-patient-trigger', {
    body: { reservationId, triggerType },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath(`/medicos/${professionalId}`);
  revalidatePath('/conversas');
}

/** Gera o código de indicação de um parceiro que ainda não tem (fallback pra
 *  perfis criados antes deste provisionamento automático existir). */
export async function ensurePartnerReferralCode(formData: FormData) {
  const partnerId = formData.get('partner_id') as string;
  if (!partnerId) throw new Error('partner_id obrigatório.');

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase.rpc('generate_referral_code', { p_user_id: partnerId });
  if (error) throw new Error(error.message);
  await supabase.from('partner_commission_config').upsert({ partner_id: partnerId }, { onConflict: 'partner_id', ignoreDuplicates: true });

  revalidatePath(`/equipe/${partnerId}`);
}

/** Resultado devolvido às telas: mensagem de sucesso ou o erro legível. */
export type ActionResult = { ok: boolean; message: string };

/** Executa a ação e devolve o resultado em vez de lançar: erro lançado numa
 *  server action em produção vira uma mensagem genérica (ou nada na tela). */
async function comFeedback(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.' };
  }
}

/** Converte "299", "299,00" ou "1.299,50" em número. NaN se inválido. */
function parseValorBR(raw: string): number {
  const s = raw.trim().replace(/\s/g, '');
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return Number(normalizado);
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Janela em que um lançamento idêntico é tratado como clique duplicado. */
const JANELA_DUPLICIDADE_MS = 2 * 60 * 1000;

/** Registra recebimento em dinheiro e ativa o que foi pago (plano PRO ou
 *  pacote de horas), tudo numa transação via RPC `register_cash_receipt`.
 *  Campo `item`: "plano:<plan_id>:<mensal|semestral>" ou "pacote:<package_id>". */
export async function registrarRecebimentoDinheiro(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const professionalId = formData.get('professional_id') as string;
    const item           = formData.get('item')            as string;
    const valor          = parseValorBR(formData.get('valor') as string);
    const recebidoEm     = formData.get('recebido_em')     as string;
    const meses          = parseInt((formData.get('meses') as string) || '1', 10);
    const observacoes    = (formData.get('observacoes') as string | null)?.trim() || null;

    if (!professionalId) throw new Error('Selecione o profissional.');
    if (!item)           throw new Error('Selecione o que foi pago.');
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe um valor maior que zero.');
    if (!DATA_ISO.test(recebidoEm)) throw new Error('Data de recebimento inválida.');

    const [kind, refId, ciclo] = item.split(':');
    const isPlano = kind === 'plano';
    if (!isPlano && kind !== 'pacote') throw new Error('Item inválido.');
    const tipo = isPlano ? 'plano' : 'pacote_horas';

    const { data: { user } } = await (await createSupabaseServer()).auth.getUser();
    const supabase = await createSupabaseAdmin();

    const { data: repetido } = await supabase
      .from('cash_receipts')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('tipo', tipo)
      .eq('valor', valor)
      .is('estornado_em', null)
      .gte('created_at', new Date(Date.now() - JANELA_DUPLICIDADE_MS).toISOString())
      .limit(1);
    if (repetido && repetido.length > 0) {
      throw new Error('Já existe um recebimento idêntico registrado há menos de 2 minutos. Confira o histórico abaixo antes de repetir.');
    }

    const { data: receiptId, error } = await supabase.rpc('register_cash_receipt', {
      p_professional_id: professionalId,
      p_tipo:            tipo,
      p_valor:           valor,
      p_recebido_em:     recebidoEm,
      p_plan_id:         isPlano ? refId : null,
      p_ciclo:           isPlano ? ciclo : null,
      p_meses:           isPlano ? (Number.isFinite(meses) && meses >= 1 ? meses : 1) : null,
      p_package_id:      isPlano ? null : refId,
      p_observacoes:     observacoes,
      p_created_by:      user?.id ?? null,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/recebimentos');
    revalidatePath('/fluxo-de-caixa');
    revalidatePath('/horas');
    revalidatePath('/planos');
    revalidatePath(`/medicos/${professionalId}`);

    // Promoções aplicadas automaticamente pelo banco neste recebimento
    const { data: resgates } = await supabase
      .from('promotion_redemptions')
      .select('minutos, promotions(nome)')
      .eq('origem', 'dinheiro')
      .eq('origem_ref', receiptId as string);
    const promo = ((resgates ?? []) as unknown as { minutos: number; promotions: { nome: string } | null }[])
      .map(r => `${r.promotions?.nome ?? 'Promoção'} (+${formatarDuracao(r.minutos)})`)
      .join('; ');

    const base = isPlano
      ? 'Recebimento registrado e plano ativado.'
      : 'Recebimento registrado e horas creditadas.';
    return promo ? `${base} Promoção aplicada: ${promo}.` : `${base} Ele aparece no histórico abaixo.`;
  });
}

/** Lança uma saída (conta a pagar) em financial_entries. "pago" grava pago_em
 *  na própria data; "pendente" fica como previsto até ser quitada. */
export async function registrarSaida(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const descricao   = ((formData.get('descricao') as string) ?? '').trim();
    const valor       = parseValorBR(formData.get('valor') as string);
    const data        = formData.get('data')       as string;
    const situacao    = formData.get('situacao')   as string;
    const categoria   = (formData.get('categoria')   as string | null)?.trim() || null;
    const supplierId  = (formData.get('supplier_id') as string | null) || null;
    const observacoes = (formData.get('observacoes') as string | null)?.trim() || null;

    if (!descricao) throw new Error('Descrição obrigatória.');
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe um valor maior que zero.');
    if (!DATA_ISO.test(data)) throw new Error('Data inválida.');
    if (situacao !== 'pago' && situacao !== 'pendente') throw new Error('Situação inválida.');

    const supabase = await createSupabaseAdmin();

    const { data: repetida } = await supabase
      .from('financial_entries')
      .select('id')
      .eq('tipo', 'pagar')
      .eq('descricao', descricao)
      .eq('valor', valor)
      .eq('vencimento', data)
      .gte('created_at', new Date(Date.now() - JANELA_DUPLICIDADE_MS).toISOString())
      .limit(1);
    if (repetida && repetida.length > 0) {
      throw new Error('Esta saída já foi lançada há menos de 2 minutos. Confira a lista antes de repetir.');
    }

    const { error } = await supabase.from('financial_entries').insert({
      tipo:        'pagar',
      descricao,
      valor,
      vencimento:  data,
      pago_em:     situacao === 'pago' ? data : null,
      status:      situacao,
      supplier_id: supplierId,
      categoria,
      observacoes,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/fluxo-de-caixa');
    return situacao === 'pago'
      ? 'Saída lançada como paga e incluída no fluxo de caixa.'
      : 'Saída lançada em contas a pagar.';
  });
}

/** Marca uma saída pendente como paga hoje (data de São Paulo). */
export async function quitarSaida(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const id = formData.get('id') as string;
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    const supabase = await createSupabaseAdmin();
    const { error } = await supabase
      .from('financial_entries')
      .update({ status: 'pago', pago_em: hoje })
      .eq('id', id)
      .eq('tipo', 'pagar');
    if (error) throw new Error(error.message);

    revalidatePath('/fluxo-de-caixa');
    return 'Conta marcada como paga.';
  });
}

/** "2h 30min", "45min" ou "3h" — para textos enviados ao cliente. */
function formatarDuracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  return h > 0 ? `${h}h` : `${m}min`;
}

/** Remove horas do saldo de um profissional (ajuste manual) e avisa o cliente.
 *  O motivo é obrigatório e vai no aviso. A remoção e o registro (hour_adjustments)
 *  acontecem numa transação via RPC `remove_hours`; o push vem depois e seu
 *  resultado fica gravado em `push_status`. Quem não recebe push (sem o app
 *  instalado) é avisado pelo WhatsApp, a partir da ficha do profissional. */
export async function removerHoras(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const professionalId = formData.get('professional_id') as string;
    const horas          = parseInt((formData.get('horas')   as string) || '0', 10);
    const minutosExtra   = parseInt((formData.get('minutos') as string) || '0', 10);
    const motivo         = ((formData.get('motivo') as string) ?? '').trim();

    if (!professionalId) throw new Error('Profissional não informado.');
    if (!Number.isFinite(horas) || horas < 0 || !Number.isFinite(minutosExtra) || minutosExtra < 0 || minutosExtra > 59) {
      throw new Error('Quantidade inválida: use horas inteiras e minutos de 0 a 59.');
    }
    const minutos = horas * 60 + minutosExtra;
    if (minutos <= 0) throw new Error('Informe ao menos 1 minuto para remover.');
    if (motivo.length < 10) throw new Error('Informe o motivo (mínimo de 10 caracteres). Ele será enviado ao cliente.');

    const supabase = await createSupabaseAdmin();

    const { data: profile } = await supabase.from('profiles').select('nome').eq('id', professionalId).single();
    if (!profile) throw new Error('Profissional não encontrado.');

    const { data: repetido } = await supabase
      .from('hour_adjustments')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('minutos_removidos', minutos)
      .gte('created_at', new Date(Date.now() - JANELA_DUPLICIDADE_MS).toISOString())
      .limit(1);
    if (repetido && repetido.length > 0) {
      throw new Error('Já existe uma remoção idêntica registrada há menos de 2 minutos. Confira o histórico de ajustes antes de repetir.');
    }

    const primeiroNome = (profile.nome ?? '').trim().split(/\s+/)[0];
    const duracao      = formatarDuracao(minutos);
    const mensagem =
      `Olá${primeiroNome ? `, ${primeiroNome}` : ''}. Ajustamos o seu saldo de horas no OLI Health Hub: ` +
      `foram removidas ${duracao} do seu saldo. Motivo: ${motivo.replace(/[.\s]+$/, '')}. ` +
      'Em caso de dúvida, responda esta mensagem ou fale com a recepção.';

    const { data: { user } } = await (await createSupabaseServer()).auth.getUser();

    const { data: adjustmentId, error } = await supabase.rpc('remove_hours', {
      p_professional_id: professionalId,
      p_minutos:         minutos,
      p_motivo:          motivo,
      p_mensagem:        mensagem,
      p_created_by:      user?.id ?? null,
    });
    if (error) throw new Error(error.message);

    // A remoção já está feita e registrada; falha no push não a desfaz.
    let pushStatus: 'enviado' | 'sem_dispositivo' | 'falhou' = 'falhou';
    try {
      const { data, error: pushError } = await supabase.functions.invoke('send-push', {
        body: {
          professionalId,
          title: 'Ajuste no seu saldo de horas',
          body:  `Removemos ${duracao} do seu saldo. Motivo: ${motivo}`.slice(0, 178),
          data:  { type: 'ajuste_horas' },
        },
      });
      if (!pushError) pushStatus = (data?.sent ?? 0) > 0 ? 'enviado' : 'sem_dispositivo';
    } catch {
      pushStatus = 'falhou';
    }
    await supabase.from('hour_adjustments').update({ push_status: pushStatus }).eq('id', adjustmentId as string);

    revalidatePath(`/medicos/${professionalId}`);
    revalidatePath('/horas');

    const base = `${duracao} removidas do saldo.`;
    if (pushStatus === 'enviado') return `${base} Aviso enviado por push.`;
    if (pushStatus === 'sem_dispositivo') {
      return `${base} O cliente não tem o app instalado, então o push não chegou: envie o aviso pelo WhatsApp (botão em "Ajustes de horas").`;
    }
    return `${base} O push falhou: envie o aviso pelo WhatsApp (botão em "Ajustes de horas").`;
  });
}

/** Registra que o aviso de remoção de horas foi enviado por WhatsApp (envio manual). */
export async function marcarAvisoWhatsapp(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const id             = formData.get('id') as string;
    const professionalId = formData.get('professional_id') as string;

    const supabase = await createSupabaseAdmin();
    const { error } = await supabase
      .from('hour_adjustments')
      .update({ whatsapp_enviado_em: new Date().toISOString() })
      .eq('id', id)
      .is('whatsapp_enviado_em', null);
    if (error) throw new Error(error.message);

    revalidatePath(`/medicos/${professionalId}`);
    return 'Envio por WhatsApp registrado.';
  });
}

/** Estorna um recebimento em dinheiro: desfaz a ativação (plano ou horas) e o
 *  tira do fluxo de caixa. A linha fica para auditoria. */
export async function estornarRecebimento(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const id     = formData.get('id') as string;
    const motivo = ((formData.get('motivo') as string) ?? '').trim();
    if (motivo.length < 5) throw new Error('Informe o motivo do estorno (mínimo de 5 caracteres).');

    const { data: { user } } = await (await createSupabaseServer()).auth.getUser();

    const supabase = await createSupabaseAdmin();
    const { error } = await supabase.rpc('reverse_cash_receipt', {
      p_receipt_id: id,
      p_motivo:     motivo,
      p_created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/recebimentos');
    revalidatePath('/fluxo-de-caixa');
    revalidatePath('/horas');
    revalidatePath('/planos');
    revalidatePath('/medicos', 'layout');
    return 'Recebimento estornado.';
  });
}

/** Cria uma promoção: horas bônus concedidas quando o produto da condição é pago.
 *  Aplicada automaticamente nos recebimentos em dinheiro (apply_promotions). */
export async function criarPromocao(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const nome       = ((formData.get('nome') as string) ?? '').trim();
    const descricao  = ((formData.get('descricao') as string) ?? '').trim() || null;
    const aplicaA    = formData.get('aplica_a') as string;
    const planId     = ((formData.get('plan_id') as string) ?? '') || null;
    const ciclo      = ((formData.get('ciclo') as string) ?? '') || null;
    const packageId  = ((formData.get('package_id') as string) ?? '') || null;
    const horas      = parseValorBR((formData.get('horas_bonus') as string) ?? '');
    const validade   = parseInt((formData.get('validade_dias') as string) || '365', 10);
    const inicio     = ((formData.get('vigencia_inicio') as string) ?? '') || null;
    const fim        = ((formData.get('vigencia_fim') as string) ?? '') || null;
    const umaVez     = formData.get('uma_vez_por_profissional') === 'on';
    const limiteRaw  = ((formData.get('limite_usos') as string) ?? '').trim();
    const limite     = limiteRaw ? parseInt(limiteRaw, 10) : null;

    if (nome.length < 3) throw new Error('Informe o nome da promoção (mínimo de 3 caracteres).');
    if (aplicaA !== 'plano' && aplicaA !== 'pacote_horas') throw new Error('Escolha a que a promoção se aplica.');
    if (aplicaA === 'plano' && !planId) throw new Error('Escolha o plano da promoção.');
    if (!Number.isFinite(horas) || horas <= 0) throw new Error('Informe as horas de bônus (maior que zero).');
    if (!Number.isFinite(validade) || validade < 1) throw new Error('Validade das horas inválida (mínimo de 1 dia).');
    if (inicio && !DATA_ISO.test(inicio)) throw new Error('Data de início inválida.');
    if (fim && !DATA_ISO.test(fim)) throw new Error('Data de fim inválida.');
    if (inicio && fim && fim < inicio) throw new Error('A data de fim não pode ser anterior à de início.');
    if (limite !== null && (!Number.isFinite(limite) || limite < 1)) throw new Error('Limite de usos inválido.');

    const { data: { user } } = await (await createSupabaseServer()).auth.getUser();
    const supabase = await createSupabaseAdmin();

    const { data: repetida } = await supabase
      .from('promotions')
      .select('id')
      .eq('nome', nome)
      .gte('created_at', new Date(Date.now() - JANELA_DUPLICIDADE_MS).toISOString())
      .limit(1);
    if (repetida && repetida.length > 0) {
      throw new Error('Esta promoção já foi criada há menos de 2 minutos. Confira a lista abaixo.');
    }

    const { error } = await supabase.from('promotions').insert({
      nome,
      descricao,
      aplica_a:                 aplicaA,
      plan_id:                  aplicaA === 'plano' ? planId : null,
      ciclo:                    aplicaA === 'plano' ? ciclo : null,
      package_id:               aplicaA === 'pacote_horas' ? packageId : null,
      horas_bonus:              horas,
      validade_dias:            validade,
      vigencia_inicio:          inicio,
      vigencia_fim:             fim,
      uma_vez_por_profissional: umaVez,
      limite_usos:              limite,
      created_by:               user?.id ?? null,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/promocoes');
    return 'Promoção criada e ativa. Vale para os próximos pagamentos em dinheiro, cartão e PIX.';
  });
}

/** Pausa ou reativa uma promoção. Não afeta o que já foi concedido. */
export async function alternarPromocao(formData: FormData): Promise<ActionResult> {
  return comFeedback(async () => {
    const id    = formData.get('id') as string;
    const ativo = formData.get('ativo') === 'true';

    const supabase = await createSupabaseAdmin();
    const { error } = await supabase.from('promotions').update({ ativo }).eq('id', id);
    if (error) throw new Error(error.message);

    revalidatePath('/promocoes');
    return ativo ? 'Promoção reativada.' : 'Promoção pausada.';
  });
}
