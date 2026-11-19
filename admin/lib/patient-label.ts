/**
 * Rótulo de paciente na reserva: só nome e inicial do sobrenome ("Maria S.").
 * Nada de CPF, telefone ou motivo da consulta. Sem imports (testado com `node --test`).
 */

export const PATIENT_LABEL_MAX = 60;
const MIN_DIGITOS_DOCUMENTO = 8;

export type PatientLabelResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

export function sanitizePatientLabel(input: string | null | undefined): PatientLabelResult {
  const limpo = (input ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (limpo === '') return { ok: true, value: null };

  if (limpo.length > PATIENT_LABEL_MAX) {
    return { ok: false, message: `Use no máximo ${PATIENT_LABEL_MAX} caracteres.` };
  }

  // Nome + inicial nunca precisa de números: 8 ou mais dígitos no total (qualquer separador) parece CPF ou telefone.
  if (limpo.replace(/\D/g, '').length >= MIN_DIGITOS_DOCUMENTO) {
    return { ok: false, message: 'Informe só o nome e a inicial do sobrenome, sem CPF ou telefone.' };
  }

  return { ok: true, value: limpo };
}

/** Ação gravada em audit_logs: `set` quando há texto, `clear` quando o rótulo é apagado. */
export function patientLabelAuditAction(value: string | null): 'set_patient_label' | 'clear_patient_label' {
  return value === null ? 'clear_patient_label' : 'set_patient_label';
}
