import { test, expect } from '@playwright/test';

test.describe('Pagamentos (/pagamentos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pagamentos');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Pagamentos');
  });

  test('shows period label', async ({ page }) => {
    await expect(page.getByText(/Período:/)).toBeVisible();
  });

  test('shows 4 KPI labels', async ({ page }) => {
    await expect(page.getByText('Minutagem (período)')).toBeVisible();
    await expect(page.getByText('Assinaturas ativas')).toBeVisible();
    await expect(page.getByText('Módulos ativos')).toBeVisible();
    await expect(page.getByText('Total consolidado')).toBeVisible();
  });

  test('filter form has all fields', async ({ page }) => {
    await expect(page.locator('input[name="from"]')).toBeVisible();
    await expect(page.locator('input[name="to"]')).toBeVisible();
    await expect(page.locator('select[name="tipo"]')).toBeVisible();
    await expect(page.locator('input[name="q"]')).toBeVisible();
  });

  test('tipo filter has correct options', async ({ page }) => {
    const select = page.locator('select[name="tipo"]');
    await expect(select.locator('option[value="all"]')).toHaveCount(1);
    await expect(select.locator('option[value="minutagem"]')).toHaveCount(1);
    await expect(select.locator('option[value="assinaturas"]')).toHaveCount(1);
    await expect(select.locator('option[value="modulos"]')).toHaveCount(1);
  });

  test('filter by tipo=assinaturas shows assinaturas section', async ({ page }) => {
    await page.goto('/pagamentos?tipo=assinaturas');
    await expect(page.getByRole('heading', { name: /Assinaturas de plano/ })).toBeVisible();
    // Minutagem section heading should NOT be present
    await expect(page.getByRole('heading', { name: /^Minutagem$/ })).not.toBeVisible();
  });

  test('filter by tipo=modulos shows modulos section', async ({ page }) => {
    await page.goto('/pagamentos?tipo=modulos');
    await expect(page.getByRole('heading', { name: /Módulos contratados/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Minutagem$/ })).not.toBeVisible();
  });

  test('"Limpar" button resets to default', async ({ page }) => {
    await page.goto('/pagamentos?tipo=modulos&q=cesar');
    await page.getByText('Limpar').click();
    await expect(page).toHaveURL('/pagamentos');
  });

  test('filter by date range updates URL', async ({ page }) => {
    await page.fill('input[name="from"]', '2026-01-01');
    await page.fill('input[name="to"]', '2026-01-31');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/from=2026-01-01/);
  });
});
