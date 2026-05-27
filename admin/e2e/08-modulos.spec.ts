import { test, expect } from '@playwright/test';

test.describe('Módulos (/modulos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/modulos');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Módulos Contratados');
  });

  test('shows active/pending/total counts', async ({ page }) => {
    await expect(page.getByText(/ativos/)).toBeVisible();
    await expect(page.getByText(/pendentes/)).toBeVisible();
    await expect(page.getByText(/total/)).toBeVisible();
  });

  test('table has correct columns', async ({ page }) => {
    const headers = ['Médico', 'Módulo', 'Categoria', 'Valor', 'Status', 'Ativado em', 'Ativo até', 'Ação'];
    for (const h of headers) {
      await expect(page.locator('thead').getByText(h)).toBeVisible();
    }
  });

  test('shows module rows or empty state', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const emptyState = page.getByText('Nenhum módulo contratado ainda');
    const rowCount = await rows.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(rowCount > 0 || hasEmpty).toBe(true);
  });

  test('Ativar/Desativar buttons visible on rows', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    if (count > 0) {
      const actionBtn = rows.first().locator('button[type="submit"]');
      await expect(actionBtn).toBeVisible();
    }
  });
});
