import { test, expect } from '@playwright/test';

test.describe('Usuários (/usuarios)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/configuracoes/usuarios');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Usuários do Sistema');
  });

  test('mostra a contagem de acessos ao painel no subtítulo', async ({ page }) => {
    // Ex.: "3 com acesso ao painel" (acesso ao painel é is_admin, independente do papel na Comunidade).
    await expect(page.getByText(/\d+ com acesso ao painel/)).toBeVisible();
  });

  test('mostra o título "Acesso ao painel"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^Acesso ao painel/ })).toBeVisible();
  });

  test('mostra o título "Demais usuários"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^Demais usuários/ })).toBeVisible();
  });

  test('admin table has correct columns', async ({ page }) => {
    const headers = ['Nome', 'E-mail', 'Desde', 'Ação'];
    const firstTable = page.locator('table').first();
    for (const h of headers) {
      await expect(firstTable.locator('thead').getByText(h)).toBeVisible();
    }
  });

  test('shows at least one admin user row', async ({ page }) => {
    const adminTable = page.locator('table').first().locator('tbody');
    const rows = adminTable.locator('tr');
    await expect(rows.first()).toBeVisible();
  });

  test('botão "Conceder acesso admin" visível nas linhas de quem não tem acesso', async ({ page }) => {
    const medTable = page.locator('table').last().locator('tbody');
    const rows = medTable.locator('tr');
    const count = await rows.count();
    if (count > 0) {
      const hasButton = await rows.first().getByRole('button', { name: 'Conceder acesso admin' }).isVisible();
      expect(hasButton).toBe(true);
    }
  });

  test('botão "Revogar acesso" visível quando há mais de um acesso ao painel', async ({ page }) => {
    const adminTable = page.locator('table').first().locator('tbody');
    const removeBtn = adminTable.getByRole('button', { name: 'Revogar acesso' }).first();
    await expect(removeBtn).toBeVisible();
  });
});
