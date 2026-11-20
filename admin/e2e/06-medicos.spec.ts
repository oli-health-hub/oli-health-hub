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

  test('mostra linhas compactas de profissionais', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Ver detalhes de / }).first()).toBeVisible();
  });

  test('a linha abre os detalhes (e-mail, módulos, assessorias)', async ({ page }) => {
    await page.getByRole('button', { name: /^Ver detalhes de / }).first().click();
    await expect(page.getByText('Assessorias').first()).toBeVisible();
    await expect(page.getByText('E-mail').first()).toBeVisible();
  });

  test('o atalho da ficha leva à página do profissional', async ({ page }) => {
    const link = page.getByRole('link', { name: /^Abrir a ficha de / }).first();
    expect(await link.getAttribute('href')).toMatch(/\/medicos\/.+/);
  });

  test('filtros: abre o painel e filtra por plano', async ({ page }) => {
    await page.getByRole('button', { name: /^Filtros/ }).click();
    const grupo = page.getByRole('group', { name: 'Filtrar por plano' });
    await expect(grupo).toBeVisible();
    await grupo.getByRole('button', { name: /^Plano: PRO/ }).click();
    await expect(page).toHaveURL(/plano=PRO/);
    await expect(page.getByRole('button', { name: 'Limpar todos os filtros' })).toBeVisible();
  });

  test('busca sem resultado mostra o estado vazio', async ({ page }) => {
    await page.goto('/medicos?q=zzzz-sem-resultado');
    await expect(page.getByText('Nenhum profissional com esses filtros.')).toBeVisible();
  });
});

test.describe('Médico detail (/medicos/[id])', () => {
  let medicoid: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/medicos');
    const link = page.getByRole('link', { name: /^Abrir a ficha de / }).first();
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
    // Escopo no conteúdo: o menu lateral também tem um link "Profissionais".
    await expect(page.getByRole('main').getByRole('link', { name: 'Profissionais' })).toHaveAttribute('href', '/medicos');
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
