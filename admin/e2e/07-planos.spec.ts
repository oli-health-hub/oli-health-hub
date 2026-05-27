import { test, expect } from '@playwright/test';

test.describe('Planos (/planos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/planos');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Planos & Assinaturas');
  });

  test('shows summary counts', async ({ page }) => {
    await expect(page.getByText(/ativos/)).toBeVisible();
    await expect(page.getByText(/pendentes/)).toBeVisible();
    await expect(page.getByText(/cancelados/)).toBeVisible();
  });

  test('shows "Assinaturas" section heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Assinaturas', exact: true })).toBeVisible();
  });

  test('subscriptions table has correct columns', async ({ page }) => {
    const headers = ['Médico', 'Plano', 'Ciclo', 'Valor', 'Status', 'Início', 'Vencimento'];
    for (const h of headers) {
      await expect(page.locator('thead').getByText(h).first()).toBeVisible();
    }
  });

  test('shows "Sem assinatura" section when doctors exist without subscription', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Sem assinatura/ })).toBeVisible();
  });
});
