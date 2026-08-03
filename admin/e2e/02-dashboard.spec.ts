import { test, expect } from '@playwright/test';

test.describe('Dashboard (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('shows 5 KPI labels', async ({ page }) => {
    await expect(page.getByText('Salas em uso')).toBeVisible();
    await expect(page.getByText('Reservas hoje')).toBeVisible();
    await expect(page.getByText('Próxima reserva')).toBeVisible();
    await expect(page.getByText('Receita hoje')).toBeVisible();
    await expect(page.getByText('Profissionais').first()).toBeVisible();
  });

  test('shows "Salas ao Vivo" section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Salas ao Vivo' })).toBeVisible();
  });

  test('shows "Próximas Reservas" section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Próximas Reservas' })).toBeVisible();
  });

  test('shows "Feed" realtime section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Feed' })).toBeVisible();
  });

  test('shows "Tempo real" badge', async ({ page }) => {
    await expect(page.locator('div').filter({ hasText: /^Tempo real$/ }).first()).toBeVisible();
  });

  test('sidebar has all nav links', async ({ page }) => {
    const links = [
      'Dashboard',
      'Fila de Trabalho',
      'Mapa do Dia',
      'Histórico',
      'Cadastros',
      'Planos',
      'Módulos',
      'Horas',
      'Pagamentos',
      'Usuários',
    ];
    for (const link of links) {
      await expect(page.locator('aside').getByText(link, { exact: true })).toBeVisible();
    }
  });

  test('sidebar shows user email', async ({ page }) => {
    await expect(page.locator('aside').getByText(/playwright/i)).toBeVisible();
  });

  test('sidebar has logout button', async ({ page }) => {
    await expect(page.locator('aside button').filter({ hasText: /sair/i })).toBeVisible();
  });
});
