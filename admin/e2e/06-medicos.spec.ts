import { test, expect } from '@playwright/test';

test.describe('Médicos (/medicos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/medicos');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Profissionais');
  });

  test('shows cadastrados count', async ({ page }) => {
    await expect(page.getByText(/cadastrados/)).toBeVisible();
  });

  test('table has correct columns', async ({ page }) => {
    const headers = ['Nome', 'CRM', 'Especialidade', 'Plano', 'Módulos', 'Cadastro'];
    for (const h of headers) {
      await expect(page.locator('thead').getByText(h)).toBeVisible();
    }
  });

  test('shows real doctors from DB', async ({ page }) => {
    // DB has: Cesar de Oliveira, André Luciano, Igor
    await expect(page.getByText('Cesar de Oliveira')).toBeVisible();
  });

  test('doctor name links to detail page', async ({ page }) => {
    const link = page.locator('tbody').locator('a').first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/medicos\/.+/);
  });

  test('plan badges are visible', async ({ page }) => {
    const badges = page.locator('tbody').locator('span').filter({ hasText: /BASE|PRO|VIP/ });
    await expect(badges.first()).toBeVisible();
  });
});

test.describe('Médico detail (/medicos/[id])', () => {
  let medicoid: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/medicos');
    const link = page.locator('tbody a').first();
    const href = await link.getAttribute('href');
    medicoid = href?.split('/medicos/')[1] ?? '';
    await page.close();
  });

  test('renders doctor detail page', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows breadcrumb back to /medicos', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByRole('link', { name: 'Profissionais' })).toHaveAttribute('href', '/medicos');
  });

  test('shows plan change form', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByText('Alterar plano')).toBeVisible();
    await expect(page.locator('select[name="plan_id"]')).toBeVisible();
  });

  test('shows add hours form', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByText('Adicionar horas')).toBeVisible();
    await expect(page.locator('input[name="horas"]')).toBeVisible();
  });

  test('shows professional data section', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByText('Dados profissionais')).toBeVisible();
  });

  test('shows fiscal data section', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByText('Ficha cadastral')).toBeVisible();
  });

  test('shows acquisitions section', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByText('Aquisição')).toBeVisible();
  });

  test('shows subscriptions section', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByText(/Assinaturas/)).toBeVisible();
  });

  test('shows hour balance section', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    await expect(page.getByRole('heading', { name: /Saldo de horas/ })).toBeVisible();
  });

  test('shows reservations section', async ({ page }) => {
    await page.goto(`/medicos/${medicoid}`);
    // Section shows only if the doctor has reservations
    const section = page.getByText(/Reservas recentes/);
    const hasSection = await section.isVisible().catch(() => false);
    if (hasSection) {
      await expect(page.locator('thead').getByText('Sala')).toBeVisible();
    }
  });

  test('invalid doctor id returns 404', async ({ page }) => {
    const response = await page.goto('/medicos/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(404);
  });
});
