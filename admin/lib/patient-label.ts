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

  // 8+ dígitos em sequência, ignorando pontuação e espaços entre eles, parece CPF ou telefone.
  const semSeparadores = limpo.replace(/[.\-()\s]/g, '');
  if (new RegExp(`\\d{${MIN_DIGITOS_DOCUMENTO},}`).test(semSeparadores)) {
    return { ok: false, message: 'Informe só o nome e a inicial do sobrenome, sem CPF ou telefone.' };
  }

  return { ok: true, value: limpo };
}
