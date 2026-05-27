import { test, expect } from '@playwright/test';

test.describe('Horas (/horas)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/horas');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Controle de Horas');
  });

  test('shows "Saldo por médico" section', async ({ page }) => {
    await expect(page.getByText('Saldo por médico')).toBeVisible();
  });

  test('shows "Histórico de pacotes" section', async ({ page }) => {
    await expect(page.getByText('Histórico de pacotes')).toBeVisible();
  });

  test('table headers are correct', async ({ page }) => {
    const headers = ['Médico', 'CRM', 'Total comprado', 'Utilizado', 'Saldo restante', 'Uso %', 'Adicionar horas'];
    for (const h of headers) {
      await expect(page.locator('thead').getByText(h).first()).toBeVisible();
    }
  });

  test('shows empty state or hour rows', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const emptyState = page.getByText('Nenhum saldo de horas registrado');
    const rowCount = await rows.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(rowCount > 0 || hasEmpty).toBe(true);
  });
});
