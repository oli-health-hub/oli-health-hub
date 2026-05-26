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
