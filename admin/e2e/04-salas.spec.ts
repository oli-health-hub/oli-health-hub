import { test, expect } from '@playwright/test';

test.describe('Mapa das Salas (/salas)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reservas');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Mapa das Salas');
  });

  test('shows 4 KPI labels', async ({ page }) => {
    // Os indicadores ficam no cabeçalho da página (CabecalhoPagina).
    const kpis = page.locator('header');
    await expect(kpis.getByText('Reservas', { exact: true })).toBeVisible();
    await expect(kpis.getByText('Em sessão', { exact: true })).toBeVisible();
    await expect(kpis.getByText('Próximas', { exact: true })).toBeVisible();
    await expect(kpis.getByText('Ocupação', { exact: true })).toBeVisible();
  });

  test('timeline shows all 7 room labels', async ({ page }) => {
    // Room labels are in the timeline sidebar (w-20 divs with room name)
    const rooms = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Sala Digital'];
    for (const room of rooms) {
      await expect(page.locator('.space-y-2').getByText(room, { exact: true })).toBeVisible();
    }
  });

  test('shows "Timeline do dia"', async ({ page }) => {
    await expect(page.getByText('Timeline do dia')).toBeVisible();
  });

  test('shows "Reservas do dia" table', async ({ page }) => {
    await expect(page.getByText('Reservas do dia')).toBeVisible();
  });

  test('date navigation arrows work', async ({ page }) => {
    const prevArrow = page.locator('a').filter({ hasText: '‹' });
    await prevArrow.click();
    await expect(page).toHaveURL(/date=/);
  });

  test('"Hoje" button returns to today when on different date', async ({ page }) => {
    await page.goto('/salas?date=2026-05-20');
    // Escopo no conteúdo: o item "Hoje" do menu lateral também casaria com o texto.
    await page.getByRole('main').getByText('Hoje', { exact: true }).click();
    // O botão leva a `/reservas?view=day` (sem `date`), que é o dia de hoje.
    await expect(page).toHaveURL(/\/reservas(\?view=day)?$/);
  });

  test('date picker submits via form', async ({ page }) => {
    const dateInput = page.locator('input[name="date"]');
    await dateInput.fill('2026-05-20');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/date=2026-05-20/);
  });
});
