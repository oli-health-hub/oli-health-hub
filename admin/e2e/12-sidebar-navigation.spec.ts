import { test, expect } from '@playwright/test';
import { LEGACY_REDIRECTS } from '../lib/legacy-redirects.mjs';

// Menu de 6 itens (reorganização de 19/11/2026) e redirects dos endereços antigos.
const MENU = [
  { href: '/', label: 'Hoje', h1: 'Hoje' },
  { href: '/reservas', label: 'Reservas', h1: 'Mapa das Salas' },
  { href: '/medicos', label: 'Profissionais', h1: 'Profissionais' },
  { href: '/comercial', label: 'Comercial', h1: 'Leads' },
  { href: '/financeiro', label: 'Financeiro', h1: '' },
  { href: '/configuracoes', label: 'Configurações', h1: '' },
];

test.describe('Menu principal', () => {
  test('tem exatamente os 6 itens, na ordem', async ({ page }) => {
    await page.goto('/');
    const links = page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link');
    await expect(links).toHaveCount(6);
    await expect(links).toHaveText(MENU.map((m) => m.label));
  });

  for (const item of MENU) {
    test(`"${item.label}" leva a ${item.href} e o menu continua visível`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: item.label }).click();
      await page.waitForURL(item.href === '/' ? '/' : `**${item.href}`);
      if (item.h1) await expect(page.locator('h1').first()).toContainText(item.h1, { timeout: 10000 });
      await expect(page.locator('aside')).toBeVisible();
    });
  }

  test('item ativo tem a classe bg-oli-green e os demais não', async ({ page }) => {
    await page.goto('/medicos');
    const menu = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(menu.getByRole('link', { name: 'Profissionais' })).toHaveClass(/bg-oli-green/);
    const hoje = (await menu.getByRole('link', { name: 'Hoje' }).getAttribute('class')) ?? '';
    expect(hoje).not.toContain('bg-oli-green');
  });

  test('a barra de abas aparece no grupo e some na ficha do profissional', async ({ page }) => {
    await page.goto('/financeiro');
    const abas = page.getByRole('navigation', { name: 'Abas da seção' });
    await expect(abas.getByRole('link', { name: 'Fluxo de caixa' })).toBeVisible();

    await page.goto('/medicos');
    const primeiraFicha = page.locator('tbody a[href^="/medicos/"]').first();
    if (await primeiraFicha.count()) {
      await primeiraFicha.click();
      await expect(page.getByRole('navigation', { name: 'Abas da seção' })).toHaveCount(0);
    }
  });
});

test.describe('Redirects dos endereços antigos', () => {
  for (const { source, destination } of LEGACY_REDIRECTS) {
    // Origens com subcaminho (/equipe/:path*) são testadas com um segmento de exemplo.
    const origem = source.replace('/:path*', '/exemplo');
    const destino = destination.replace('/:path*', '/exemplo');
    test(`${origem} → ${destino}`, async ({ page }) => {
      await page.goto(origem);
      const esperado = destino === '/' ? '/' : destino;
      await expect(page).toHaveURL(new RegExp(`${esperado === '/' ? '/$' : esperado}(\\?.*)?$`));
    });
  }
});
