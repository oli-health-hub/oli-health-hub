'use server';

import { createSupabaseAdmin } from '@/lib/supabase-server';
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
