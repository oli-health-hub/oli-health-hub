import { test, expect } from '@playwright/test';

test.describe('Hoje (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('mostra o título e o resumo do dia', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Hoje');
    await expect(page.getByText(/\d+ reservas?/).first()).toBeVisible();
    await expect(page.getByText(/\d+ pendências?/).first()).toBeVisible();
  });

  test('mostra as seções principais', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pendências' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reservas do dia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Salas agora' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Atividade recente' })).toBeVisible();
  });

  test('tem o atalho do Totem QR', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Abrir Totem QR' })).toHaveAttribute('href', '/configuracoes/totem');
  });

  test('reservas do dia mostram o campo de paciente ou o estado vazio', async ({ page }) => {
    const vazio = page.getByText('Nenhuma reserva para hoje.');
    const campos = page.getByLabel(/^Paciente da reserva/);
    const temVazio = await vazio.isVisible().catch(() => false);
    const nCampos = await campos.count();
    expect(temVazio || nCampos > 0).toBe(true);
  });
});
