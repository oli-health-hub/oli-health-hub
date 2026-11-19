import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePatientLabel, patientLabelAuditAction } from './patient-label.ts';

const MSG_DOCUMENTO = 'Informe só o nome e a inicial do sobrenome, sem CPF ou telefone.';

test('normaliza espaços e devolve o nome limpo', () => {
  assert.deepEqual(sanitizePatientLabel('  Maria   S. '), { ok: true, value: 'Maria S.' });
});

test('vazio ou só espaços limpa o rótulo', () => {
  assert.deepEqual(sanitizePatientLabel(''), { ok: true, value: null });
  assert.deepEqual(sanitizePatientLabel('   '), { ok: true, value: null });
  assert.deepEqual(sanitizePatientLabel(null), { ok: true, value: null });
  assert.deepEqual(sanitizePatientLabel(undefined), { ok: true, value: null });
});

test('rejeita CPF digitado, com ou sem pontuação', () => {
  assert.deepEqual(sanitizePatientLabel('Maria 123.456.789-00'), { ok: false, message: MSG_DOCUMENTO });
  assert.deepEqual(sanitizePatientLabel('Maria 12345678900'), { ok: false, message: MSG_DOCUMENTO });
});

test('rejeita telefone digitado, mesmo com parênteses e traço', () => {
  assert.deepEqual(sanitizePatientLabel('João (11) 91234-5678'), { ok: false, message: MSG_DOCUMENTO });
});

test('rejeita 8 dígitos separados por espaços', () => {
  assert.deepEqual(sanitizePatientLabel('Ana 12 34 56 78'), { ok: false, message: MSG_DOCUMENTO });
});

test('permite poucos dígitos (ex.: número de sala ou ordem)', () => {
  assert.deepEqual(sanitizePatientLabel('João 12345'), { ok: true, value: 'João 12345' });
});

test('limite de 60 caracteres', () => {
  assert.deepEqual(sanitizePatientLabel('a'.repeat(60)), { ok: true, value: 'a'.repeat(60) });
  assert.deepEqual(sanitizePatientLabel('a'.repeat(61)), { ok: false, message: 'Use no máximo 60 caracteres.' });
});

test('remove os caracteres < e > e os de controle', () => {
  assert.deepEqual(sanitizePatientLabel('<b>Ana</b> P.'), { ok: true, value: 'bAna/b P.' });
  assert.deepEqual(sanitizePatientLabel('Ana\u0000\u0007 P.'), { ok: true, value: 'Ana P.' });
});

test('ação de auditoria: valor define set e nulo define clear', () => {
  assert.equal(patientLabelAuditAction('Maria S.'), 'set_patient_label');
  assert.equal(patientLabelAuditAction(null), 'clear_patient_label');
});
