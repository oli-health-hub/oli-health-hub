'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase-server';
import { registrarAuditoriaAdmin } from '@/lib/audit';
import { sanitizePatientLabel, patientLabelAuditAction } from '@/lib/patient-label';
import { startNoDia } from '@/lib/hoje';
import type { ActionResult } from '@/app/actions';

const ERRO_GENERICO = 'Não foi possível salvar. Tente novamente em instantes.';

/**
 * Informa (ou apaga) o paciente de uma reserva de hoje. Texto livre: nome + inicial do sobrenome.
 * O texto nunca é gravado em audit_logs nem repetido em mensagens de erro.
 */
export async function setReservationPatientLabel(formData: FormData): Promise<ActionResult> {
  try {
    const reservationId = String(formData.get('reservation_id') ?? '').trim();
    if (!reservationId) return { ok: false, message: 'Reserva não informada.' };

    const parsed = sanitizePatientLabel(formData.get('patient_label') as string | null);
    if (!parsed.ok) return { ok: false, message: parsed.message };

    const sessao = await createSupabaseServer();
    const { data: { user } } = await sessao.auth.getUser();
    if (!user) return { ok: false, message: 'Sessão expirada. Entre novamente.' };

    const admin = await createSupabaseAdmin();
    const { data: perfil } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!perfil?.is_admin) return { ok: false, message: 'Você não tem permissão para esta ação.' };

    const { data: reserva } = await admin
      .from('reservations')
      .select('id, start_time')
      .eq('id', reservationId)
      .maybeSingle();
    if (!reserva) return { ok: false, message: 'Reserva não encontrada.' };
    if (!startNoDia(reserva.start_time as string, new Date())) {
      return { ok: false, message: 'Só é possível informar o paciente das reservas de hoje.' };
    }

    const { error } = await admin
      .from('reservations')
      .update({ patient_label: parsed.value })
      .eq('id', reservationId);
    if (error) return { ok: false, message: ERRO_GENERICO };

    await registrarAuditoriaAdmin({
      adminId: user.id,
      action: patientLabelAuditAction(parsed.value),
      targetType: 'reservation',
      targetId: reservationId,
      metadata: { length: parsed.value?.length ?? 0 },
    });

    revalidatePath('/');
    return { ok: true, message: parsed.value ? 'Paciente salvo.' : 'Paciente removido.' };
  } catch {
    return { ok: false, message: ERRO_GENERICO };
  }
}
