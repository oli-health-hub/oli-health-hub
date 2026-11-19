import { createSupabaseAdmin } from '@/lib/supabase-server';
import { spDayRange } from '@/lib/hoje';

/**
 * Auditoria de acesso a dado de paciente no Admin (LGPD Art. 37).
 * Regra: o TEXTO do rótulo de paciente nunca vai para o log, só ids e contagens.
 * Falha de auditoria não derruba a ação principal.
 */

export type AuditMetadata = Record<string, string | number | boolean | null>;

export async function registrarAuditoriaAdmin(p: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata?: AuditMetadata;
}): Promise<void> {
  try {
    const supabase = await createSupabaseAdmin();
    const { error } = await supabase.from('audit_logs').insert({
      professional_id: p.adminId,
      action: p.action,
      target_type: p.targetType,
      target_id: p.targetId,
      metadata: p.metadata ?? null,
    });
    if (error) console.error('[audit] falha ao registrar', p.action, error.code);
  } catch {
    console.error('[audit] falha ao registrar', p.action);
  }
}

/** Grava `view_patient_labels` no máximo uma vez por dia (de São Paulo) por admin. */
export async function registrarVisualizacaoUmaVezPorDia(adminId: string, qtdRotulos: number): Promise<void> {
  if (qtdRotulos <= 0) return;
  try {
    const supabase = await createSupabaseAdmin();
    const { startISO } = spDayRange(new Date());
    const { data } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('professional_id', adminId)
      .eq('action', 'view_patient_labels')
      .gte('created_at', startISO)
      .limit(1);
    if (data && data.length > 0) return;
    await registrarAuditoriaAdmin({
      adminId,
      action: 'view_patient_labels',
      targetType: 'reservation_list',
      targetId: null,
      metadata: { count: qtdRotulos },
    });
  } catch {
    console.error('[audit] falha ao registrar visualização');
  }
}
