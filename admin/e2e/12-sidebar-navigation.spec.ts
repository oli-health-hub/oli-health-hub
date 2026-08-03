import { test, expect } from '@playwright/test';

// Tests navigation from sidebar links
const ROUTES = [
  { href: '/',           title: 'Dashboard' },
  { href: '/fila',       title: 'Fila de Trabalho' },
  { href: '/salas',      title: 'Mapa das Salas' },
  { href: '/historico',  title: 'Histórico de Utilização' },
  { href: '/medicos',    title: 'Profissionais' },
  { href: '/planos',     title: 'Planos & Assinaturas' },
  { href: '/modulos',    title: 'Módulos Contratados' },
  { href: '/horas',      title: 'Controle de Horas' },
  { href: '/pagamentos', title: 'Pagamentos' },
  { href: '/usuarios',   title: 'Usuários do Sistema' },
];

test.describe('Sidebar navigation', () => {
  for (const route of ROUTES) {
    test(`navigates to ${route.href} → shows "${route.title}"`, async ({ page }) => {
      await page.goto(route.href);
      await expect(page.locator('h1')).toContainText(route.title, { timeout: 10000 });
      // Sidebar still visible
      await expect(page.locator('aside')).toBeVisible();
    });
  }

  test('active link is highlighted in sidebar', async ({ page }) => {
    await page.goto('/medicos');
    // Active link has oli-green background class
    const activeLink = page.locator('aside a[href="/medicos"]');
    await expect(activeLink).toHaveClass(/bg-oli-green/);
  });

  test('non-active links do not have active class', async ({ page }) => {
    await page.goto('/medicos');
    const dashboardLink = page.locator('aside a[href="/"]');
    const classList = await dashboardLink.getAttribute('class') ?? '';
    expect(classList).not.toContain('bg-oli-green');
  });

  test('OLI Health Hub logo visible in sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside').getByText('OLI Health Hub')).toBeVisible();
  });
});
