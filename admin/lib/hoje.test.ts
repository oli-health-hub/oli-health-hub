import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOLERANCIA_MIN,
  JANELA_VENCIDAS_DIAS,
  LIMITE_LINHAS,
  JANELA_CONVERSAS_DIAS,
  ASSINATURA_AVISO_DIAS,
  spDayRange,
  isCheckoutAberto,
  isVencidaSemCheckin,
  assinaturaVencendo,
  limitarComTotal,
  startNoDia,
} from './hoje.ts';

const AGORA = new Date('2026-11-19T15:00:00.000Z');
const minutosAntes = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString();
const diasDepois = (d: number) => new Date(AGORA.getTime() + d * 86_400_000).toISOString();

test('constantes do spec', () => {
  assert.equal(TOLERANCIA_MIN, 30);
  assert.equal(JANELA_VENCIDAS_DIAS, 14);
  assert.equal(LIMITE_LINHAS, 10);
  assert.equal(JANELA_CONVERSAS_DIAS, 7);
  assert.equal(ASSINATURA_AVISO_DIAS, 7);
});

test('dia de São Paulo: 23:30 de 18/11 em SP ainda é dia 18', () => {
  const r = spDayRange(new Date('2026-11-19T02:30:00.000Z'));
  assert.equal(r.label, '2026-11-18');
  assert.equal(r.startISO, '2026-11-18T03:00:00.000Z');
  assert.equal(r.endISO, '2026-11-19T02:59:59.999Z');
});

test('dia de São Paulo: 09:00 de 19/11 em SP é dia 19', () => {
  const r = spDayRange(new Date('2026-11-19T12:00:00.000Z'));
  assert.equal(r.label, '2026-11-19');
  assert.equal(r.startISO, '2026-11-19T03:00:00.000Z');
});

test('reserva 23:30–00:30 SP cai em um único dia, o do seu início', () => {
  const inicio = '2026-11-19T02:30:00.000Z'; // 23:30 de 18/11 em SP
  const dia18 = spDayRange(new Date('2026-11-18T15:00:00.000Z'));
  const dia19 = spDayRange(new Date('2026-11-19T15:00:00.000Z'));
  const dentro = (r: { startISO: string; endISO: string }) => inicio >= r.startISO && inicio <= r.endISO;
  assert.equal(dentro(dia18), true);
  assert.equal(dentro(dia19), false);
});

test('check-out aberto: em_uso com fim há mais de 30 min', () => {
  const base = { id: 'r1', start_time: minutosAntes(120) };
  assert.equal(isCheckoutAberto({ ...base, status: 'em_uso', end_time: minutosAntes(31) }, AGORA), true);
  assert.equal(isCheckoutAberto({ ...base, status: 'em_uso', end_time: minutosAntes(29) }, AGORA), false);
});

test('check-out aberto: aceita active legado e ignora outros status', () => {
  const base = { id: 'r1', start_time: minutosAntes(120), end_time: minutosAntes(45) };
  assert.equal(isCheckoutAberto({ ...base, status: 'active' }, AGORA), true);
  assert.equal(isCheckoutAberto({ ...base, status: 'agendado' }, AGORA), false);
  assert.equal(isCheckoutAberto({ ...base, status: 'concluido' }, AGORA), false);
});

test('vencida sem check-in: agendado com fim há mais de 30 min', () => {
  const base = { id: 'r2', start_time: minutosAntes(200) };
  assert.equal(isVencidaSemCheckin({ ...base, status: 'agendado', end_time: minutosAntes(31) }, AGORA), true);
  assert.equal(isVencidaSemCheckin({ ...base, status: 'agendado', end_time: minutosAntes(29) }, AGORA), false);
});

test('vencida sem check-in: ignora as de mais de 14 dias e as concluídas', () => {
  const quinzeDiasMin = 15 * 24 * 60;
  assert.equal(
    isVencidaSemCheckin({ id: 'r3', status: 'agendado', start_time: minutosAntes(quinzeDiasMin + 60), end_time: minutosAntes(quinzeDiasMin) }, AGORA),
    false,
  );
  assert.equal(
    isVencidaSemCheckin({ id: 'r4', status: 'concluido', start_time: minutosAntes(200), end_time: minutosAntes(60) }, AGORA),
    false,
  );
});

test('assinatura vencendo: só PRO ativa terminando em até 7 dias', () => {
  assert.equal(assinaturaVencendo({ status: 'active', ends_at: diasDepois(3), planName: 'PRO' }, AGORA), true);
  assert.equal(assinaturaVencendo({ status: 'cancelled', ends_at: diasDepois(3), planName: 'PRO' }, AGORA), false);
  assert.equal(assinaturaVencendo({ status: 'active', ends_at: diasDepois(3), planName: 'START' }, AGORA), false);
  assert.equal(assinaturaVencendo({ status: 'active', ends_at: null, planName: 'PRO' }, AGORA), false);
  assert.equal(assinaturaVencendo({ status: 'active', ends_at: diasDepois(8), planName: 'PRO' }, AGORA), false);
});

test('assinatura já vencida não é pendência de "vencendo"', () => {
  assert.equal(assinaturaVencendo({ status: 'active', ends_at: diasDepois(-1), planName: 'PRO' }, AGORA), false);
});

test('limitarComTotal corta em 10 e informa o total real', () => {
  const itens = Array.from({ length: 12 }, (_, i) => i);
  const r = limitarComTotal(itens);
  assert.equal(r.itens.length, 10);
  assert.equal(r.total, 12);
});

test('limitarComTotal com lista vazia', () => {
  assert.deepEqual(limitarComTotal([]), { itens: [], total: 0 });
});

test('startNoDia: reserva só é editável no dia de SP em que começa', () => {
  const agora = new Date('2026-11-19T15:00:00.000Z'); // 12:00 em SP
  assert.equal(startNoDia('2026-11-19T17:00:00.000Z', agora), true);  // 14:00 SP, hoje
  assert.equal(startNoDia('2026-11-19T02:30:00.000Z', agora), false); // 23:30 SP de ontem
  assert.equal(startNoDia('2026-11-20T03:00:00.000Z', agora), false); // 00:00 SP de amanhã
  assert.equal(startNoDia('2026-11-19T03:00:00.000Z', agora), true);  // 00:00 SP de hoje
});
