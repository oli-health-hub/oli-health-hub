import { test, expect } from '@playwright/test';

test.describe('Usuários (/usuarios)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/usuarios');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Usuários do Sistema');
  });

  test('shows admin count in subtitle', async ({ page }) => {
    // e.g. "3 admins"
    await expect(page.locator('span').filter({ hasText: /\d+ admin/ })).toBeVisible();
  });

  test('shows "Administradores" section heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Administradores' })).toBeVisible();
  });

  test('shows "Médicos cadastrados" section heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Médicos cadastrados/ })).toBeVisible();
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

  test('"Tornar admin" button visible on non-admin rows', async ({ page }) => {
    const medTable = page.locator('table').last().locator('tbody');
    const rows = medTable.locator('tr');
    const count = await rows.count();
    if (count > 0) {
      const hasButton = await rows.first().getByRole('button', { name: 'Tornar admin' }).isVisible();
      expect(hasButton).toBe(true);
    }
  });

  test('"Remover admin" button visible when multiple admins', async ({ page }) => {
    const adminTable = page.locator('table').first().locator('tbody');
    const removeBtn = adminTable.getByRole('button', { name: 'Remover admin' }).first();
    await expect(removeBtn).toBeVisible();
  });
});
