import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNavActive, GROUP_TABS, MAIN_NAV } from './nav.ts';

test('Hoje só é ativo em "/" exato', () => {
  assert.equal(isNavActive('/', '/'), true);
  assert.equal(isNavActive('/reservas/historico', '/'), false);
});

test('itens por prefixo de segmento', () => {
  assert.equal(isNavActive('/medicos', '/medicos'), true);
  assert.equal(isNavActive('/medicos/abc', '/medicos'), true);
  assert.equal(isNavActive('/medicos/horas', '/medicos'), true);
  assert.equal(isNavActive('/medicosx', '/medicos'), false);
  assert.equal(isNavActive('/financeiro/fluxo', '/financeiro'), true);
});

test('menu principal tem exatamente os 6 itens do spec, na ordem', () => {
  assert.deepEqual(
    MAIN_NAV.map((i) => [i.href, i.label]),
    [
      ['/', 'Hoje'],
      ['/reservas', 'Reservas'],
      ['/medicos', 'Profissionais'],
      ['/comercial', 'Comercial'],
      ['/financeiro', 'Financeiro'],
      ['/configuracoes', 'Configurações'],
    ],
  );
});

test('financeiro tem 5 abas e a primeira é exata', () => {
  assert.equal(GROUP_TABS.financeiro.length, 5);
  assert.equal(GROUP_TABS.financeiro[0].href, '/financeiro');
  assert.equal(GROUP_TABS.financeiro[0].exact, true);
});

test('abas de cada grupo estão dentro da rota base e sem repetição', () => {
  const base: Record<string, string> = {
    reservas: '/reservas',
    medicos: '/medicos',
    comercial: '/comercial',
    financeiro: '/financeiro',
    configuracoes: '/configuracoes',
  };
  for (const [grupo, tabs] of Object.entries(GROUP_TABS)) {
    const hrefs = tabs.map((t) => t.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `${grupo}: href repetido`);
    for (const h of hrefs) assert.ok(h.startsWith(base[grupo]), `${grupo}: ${h} fora de ${base[grupo]}`);
  }
});

test('a primeira aba de cada grupo é a rota base e exata', () => {
  assert.equal(GROUP_TABS.reservas[0].href, '/reservas');
  assert.equal(GROUP_TABS.medicos[0].href, '/medicos');
  assert.equal(GROUP_TABS.comercial[0].href, '/comercial');
  assert.equal(GROUP_TABS.configuracoes[0].href, '/configuracoes');
  for (const tabs of Object.values(GROUP_TABS)) assert.equal(tabs[0].exact, true);
});

test('Catálogo é exato para não ficar ativo nas outras abas de Configurações', () => {
  assert.equal(GROUP_TABS.configuracoes.find((t) => t.href === '/configuracoes')?.exact, true);
});
