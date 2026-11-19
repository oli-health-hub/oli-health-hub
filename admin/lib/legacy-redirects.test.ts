import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_REDIRECTS } from './legacy-redirects.mjs';

test('nenhuma destination é também uma source (sem laço)', () => {
  const sources = new Set(LEGACY_REDIRECTS.map((r) => r.source));
  for (const r of LEGACY_REDIRECTS) {
    assert.equal(sources.has(r.destination), false, `${r.source} → ${r.destination} forma laço`);
  }
});

test('sources são únicas', () => {
  const sources = LEGACY_REDIRECTS.map((r) => r.source);
  assert.equal(new Set(sources).size, sources.length);
});

test('toda destination começa com /', () => {
  for (const r of LEGACY_REDIRECTS) assert.ok(r.destination.startsWith('/'), r.destination);
});

test('subcaminhos de /equipe (novo e [id]) são cobertos', () => {
  const eq = LEGACY_REDIRECTS.find((r) => r.source === '/equipe/:path*');
  assert.ok(eq, 'falta /equipe/:path*');
  assert.equal(eq.destination, '/configuracoes/equipe/:path*');
});

test('pares principais do spec', () => {
  const mapa = Object.fromEntries(LEGACY_REDIRECTS.map((r) => [r.source, r.destination]));
  assert.equal(mapa['/salas'], '/reservas');
  assert.equal(mapa['/historico'], '/reservas/historico');
  assert.equal(mapa['/pagamentos'], '/reservas/minutagem');
  assert.equal(mapa['/horas'], '/medicos/horas');
  assert.equal(mapa['/planos'], '/medicos/assinaturas');
  assert.equal(mapa['/modulos'], '/medicos/modulos');
  assert.equal(mapa['/leads'], '/comercial');
  assert.equal(mapa['/conversas'], '/comercial/conversas');
  assert.equal(mapa['/fluxo-de-caixa'], '/financeiro/fluxo');
  assert.equal(mapa['/catalogo'], '/configuracoes');
  assert.equal(mapa['/meu-recebimento'], '/configuracoes/meu-recebimento');
  assert.equal(mapa['/fila'], '/');
});
