import { test, expect } from '@playwright/test';

test.describe('Fila de Trabalho (/fila)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fila');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Fila de Trabalho');
  });

  test('shows pending count badge', async ({ page }) => {
    await expect(page.locator('span').filter({ hasText: /pendentes?/ })).toBeVisible();
  });

  test('shows empty state or notification items', async ({ page }) => {
    const emptyState = page.getByText('Fila vazia');
    const items = page.locator('[class*="divide-y"] > div');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const itemCount = await items.count();

    // One of the two must be true
    expect(hasEmpty || itemCount > 0).toBe(true);
  });

  test('notification items have WhatsApp and Dispensar buttons', async ({ page }) => {
    const items = page.locator('[class*="divide-y"] > div');
    const count = await items.count();
    if (count > 0) {
      await expect(items.first().getByText('WhatsApp')).toBeVisible();
      await expect(items.first().getByText('Dispensar')).toBeVisible();
    }
  });
});
