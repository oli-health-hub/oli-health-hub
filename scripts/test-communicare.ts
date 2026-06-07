/**
 * QA harness — integração Communicare com 30 usuários.
 * Exercita o simulador REAL (communicareMock.ts) por todos os fluxos:
 * create + dedup (cpf/email/externalId) + update + delete + sso +
 * health-plans + history + agenda/bucketize.
 *
 * Rodar: EXPO_PUBLIC_COMMUNICARE_MOCK=true node --experimental-strip-types scripts/test-communicare.ts
 */

process.env.EXPO_PUBLIC_COMMUNICARE_MOCK = 'true';

import { mockRequest, isMockEnabled } from '../src/services/communicareMock.ts';

// ── bucketize/mapCCStatus: réplica EXATA de communicareAgenda.ts ──────────────
// (não importável direto pois communicareAgenda puxa supabase/RN)
type AppointmentStatus = 'proximo' | 'em_espera' | 'em_atendimento' | 'atendido' | 'cancelado';
function mapCCStatus(raw?: string): AppointmentStatus {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('cancel')) return 'cancelado';
  if (s.includes('espera') || s.includes('aguard') || s.includes('wait') || s.includes('check')) return 'em_espera';
  if (s.includes('atendimento') || s.includes('atendendo') || s.includes('progress') || s.includes('andamento')) return 'em_atendimento';
  if (s.includes('atendid') || s.includes('finaliz') || s.includes('concl') || s.includes('done')) return 'atendido';
  return 'proximo';
}

// ── util ──────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const fails: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); }
}
function cpfFor(i: number): string {
  return String(10000000000 + i).padStart(11, '0');
}

async function main() {
  console.log('=== QA Communicare — 30 usuários ===\n');
  check('mock habilitado', isMockEnabled());

  const created: { oliId: string; ccId: string; cpf: string; email: string }[] = [];

  // ── 1. CREATE 30 pacientes ──────────────────────────────────────────────────
  for (let i = 1; i <= 30; i++) {
    const oliId = `oli-${i}`;
    const cpf   = cpfFor(i);
    const email = `paciente${i}@test.com`;
    const res = await mockRequest<{ id: string }>('/v1/patient', 'POST', {
      name: `Paciente ${i}`, cpf, birthDate: '1990-01-01',
      phone: `1199999${String(i).padStart(4, '0')}`, email,
      externalId: oliId, healthPlanId: i % 2 ? 'hp_unimed' : undefined,
    });
    check(`create #${i} retorna id`, !!res.id);
    created.push({ oliId, ccId: res.id, cpf, email });
  }
  check('30 pacientes criados', created.length === 30);
  check('ids CC únicos', new Set(created.map(c => c.ccId)).size === 30);

  // ── 2. DEDUP por CPF ────────────────────────────────────────────────────────
  for (const c of created) {
    const found = await mockRequest<{ id: string }[]>(`/v1/patient?cpf=${c.cpf}`, 'GET');
    check(`dedup cpf ${c.cpf}`, Array.isArray(found) && found[0]?.id === c.ccId);
  }

  // ── 3. DEDUP por externalId ─────────────────────────────────────────────────
  for (const c of created) {
    const found = await mockRequest<{ id: string }[]>(`/v1/patient?externalId=${c.oliId}`, 'GET');
    check(`dedup externalId ${c.oliId}`, found[0]?.id === c.ccId);
  }

  // ── 4. DEDUP por email ──────────────────────────────────────────────────────
  for (const c of created) {
    const found = await mockRequest<{ id: string }[]>(`/v1/patient?email=${encodeURIComponent(c.email)}`, 'GET');
    check(`dedup email ${c.email}`, found[0]?.id === c.ccId);
  }

  // ── 5. CPF inexistente → vazio ──────────────────────────────────────────────
  const none = await mockRequest<unknown[]>('/v1/patient?cpf=00000000000', 'GET');
  check('cpf inexistente → []', Array.isArray(none) && none.length === 0);

  // ── 6. UPDATE 30 ────────────────────────────────────────────────────────────
  for (const c of created) {
    const upd = await mockRequest<{ phone: string }>(`/v1/patient/${c.ccId}`, 'PUT', { phone: '11888888888' });
    check(`update ${c.ccId}`, upd.phone === '11888888888');
  }

  // ── 7. SSO 30 CPFs ──────────────────────────────────────────────────────────
  for (const c of created) {
    const sso = await mockRequest<{ jwt: string; professionalId: string }>(`/v1/sso/${c.cpf}`, 'GET');
    check(`sso ${c.cpf}`, !!sso.jwt && !!sso.professionalId);
  }

  // ── 8. Health plans ─────────────────────────────────────────────────────────
  const plans = await mockRequest<{ id: string; name: string }[]>('/v1/health-plans', 'GET');
  check('health-plans >= 5', plans.length >= 5);
  check('health-plans tem Unimed', plans.some(p => p.name === 'Unimed'));

  // ── 9. History ──────────────────────────────────────────────────────────────
  const hist = await mockRequest<unknown[]>('/v1/history?patientId=1001', 'GET');
  check('history retorna lista', Array.isArray(hist) && hist.length > 0);

  // ── 10. Agenda + bucketize ──────────────────────────────────────────────────
  const agenda = await mockRequest<{ status: string }[]>('/v1/agenda', 'GET');
  check('agenda retorna itens', agenda.length === 5);
  const buckets = {
    proximos:      agenda.filter(a => mapCCStatus(a.status) === 'proximo'),
    emEspera:      agenda.filter(a => mapCCStatus(a.status) === 'em_espera'),
    emAtendimento: agenda.filter(a => mapCCStatus(a.status) === 'em_atendimento'),
    atendidos:     agenda.filter(a => mapCCStatus(a.status) === 'atendido'),
  };
  check('bucket em_atendimento = 1', buckets.emAtendimento.length === 1);
  check('bucket em_espera = 1',      buckets.emEspera.length === 1);
  check('bucket atendidos = 1',      buckets.atendidos.length === 1);
  check('bucket proximos = 2',       buckets.proximos.length === 2);

  // ── 11. mapCCStatus casos ───────────────────────────────────────────────────
  check('status "em atendimento"', mapCCStatus('em atendimento') === 'em_atendimento');
  check('status "aguardando"',     mapCCStatus('aguardando') === 'em_espera');
  check('status "atendido"',       mapCCStatus('atendido') === 'atendido');
  check('status "agendado"',       mapCCStatus('agendado') === 'proximo');
  check('status "cancelado"',      mapCCStatus('cancelado') === 'cancelado');

  // ── 12. DELETE 30 + confirma removido ───────────────────────────────────────
  for (const c of created) {
    await mockRequest(`/v1/patient/${c.ccId}`, 'DELETE');
  }
  for (const c of created) {
    const after = await mockRequest<unknown[]>(`/v1/patient?cpf=${c.cpf}`, 'GET');
    check(`delete confirmado ${c.ccId}`, Array.isArray(after) && after.length === 0);
  }

  // ── 13. Queue ───────────────────────────────────────────────────────────────
  const q = await mockRequest<{ success: boolean }>('/v1/queue', 'POST', { queueUUID: 'x', queueName: 'Fila', patientId: 1 });
  check('queue join success', q.success === true);

  // ── 14. Rota não mapeada → erro ─────────────────────────────────────────────
  let threw = false;
  try { await mockRequest('/v1/inexistente', 'GET'); } catch { threw = true; }
  check('rota inválida lança erro', threw);

  // ── Resumo ──────────────────────────────────────────────────────────────────
  console.log(`\n──────────────────────────────`);
  console.log(`✅ PASS: ${pass}`);
  console.log(`❌ FAIL: ${fail}`);
  if (fails.length) {
    console.log('\nFalhas:');
    fails.forEach(f => console.log('  - ' + f));
    process.exit(1);
  } else {
    console.log('\n🎉 Todos os fluxos OK com 30 usuários.');
  }
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
