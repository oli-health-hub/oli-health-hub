import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReservationStatus,
  reservationStatusLabel,
  reservationStatusClass,
  CANCELLED_STATUS_VALUES,
  RESERVATION_STATUS_FILTER_OPTIONS,
} from './reservation-status.ts';

test('normaliza os status reais do banco', () => {
  assert.equal(normalizeReservationStatus('agendado'), 'agendado');
  assert.equal(normalizeReservationStatus('em_uso'), 'em_uso');
  assert.equal(normalizeReservationStatus('concluido'), 'concluido');
});

test('normaliza os status legados em inglês', () => {
  assert.equal(normalizeReservationStatus('scheduled'), 'agendado');
  assert.equal(normalizeReservationStatus('active'), 'em_uso');
  assert.equal(normalizeReservationStatus('completed'), 'concluido');
  assert.equal(normalizeReservationStatus('cancelled'), 'cancelado');
  assert.equal(normalizeReservationStatus('no_show'), 'nao_compareceu');
});

test('ignora caixa e aceita cancelado em português', () => {
  assert.equal(normalizeReservationStatus('EM_USO'), 'em_uso');
  assert.equal(normalizeReservationStatus('cancelado'), 'cancelado');
});

test('status nulo ou desconhecido vira desconhecido, sem quebrar', () => {
  assert.equal(normalizeReservationStatus(null), 'desconhecido');
  assert.equal(normalizeReservationStatus(undefined), 'desconhecido');
  assert.equal(normalizeReservationStatus('xpto'), 'desconhecido');
});

test('rótulos em português formal', () => {
  assert.equal(reservationStatusLabel('em_uso'), 'Em sessão');
  assert.equal(reservationStatusLabel('agendado'), 'Agendada');
  assert.equal(reservationStatusLabel('concluido'), 'Concluída');
  assert.equal(reservationStatusLabel('desconhecido'), 'Status desconhecido');
});

test('cada status tem classes de cor', () => {
  assert.match(reservationStatusClass('em_uso'), /bg-/);
  assert.match(reservationStatusClass('desconhecido'), /bg-/);
});

test('lista de cancelados cobre as duas grafias', () => {
  assert.ok(CANCELLED_STATUS_VALUES.includes('cancelado'));
  assert.ok(CANCELLED_STATUS_VALUES.includes('cancelled'));
  assert.ok(CANCELLED_STATUS_VALUES.includes('no_show'));
  assert.ok(CANCELLED_STATUS_VALUES.includes('nao_compareceu'));
});

test('opções do filtro de status usam os valores reais do banco e rótulos formais', () => {
  assert.deepEqual(RESERVATION_STATUS_FILTER_OPTIONS, [
    { value: 'agendado', label: 'Agendada' },
    { value: 'em_uso', label: 'Em sessão' },
    { value: 'concluido', label: 'Concluída' },
    { value: 'cancelado', label: 'Cancelada' },
    { value: 'nao_compareceu', label: 'Não compareceu' },
  ]);
});
