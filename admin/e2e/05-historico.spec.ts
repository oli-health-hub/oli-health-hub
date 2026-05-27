import { test, expect } from '@playwright/test';

test.describe('Histórico (/historico)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/historico');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Histórico de Utilização');
  });

  test('shows 4 stat cards', async ({ page }) => {
    await expect(page.getByText('Reservas').first()).toBeVisible();
    await expect(page.getByText('Horas agendadas')).toBeVisible();
    await expect(page.getByText('Receita cobrada')).toBeVisible();
    await expect(page.getByText('No-shows')).toBeVisible();
  });

  test('filter form has all fields', async ({ page }) => {
    await expect(page.locator('input[name="start_date"]')).toBeVisible();
    await expect(page.locator('input[name="end_date"]')).toBeVisible();
    await expect(page.locator('select[name="room"]')).toBeVisible();
    await expect(page.locator('select[name="status"]')).toBeVisible();
    await expect(page.locator('input[name="professional"]')).toBeVisible();
  });

  test('room dropdown has all 7 rooms', async ({ page }) => {
    const roomSelect = page.locator('select[name="room"]');
    const rooms = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Sala Digital'];
    for (const room of rooms) {
      await expect(roomSelect.locator(`option[value="${room}"]`)).toHaveCount(1);
    }
  });

  test('filter by date range works', async ({ page }) => {
    await page.fill('input[name="start_date"]', '2026-05-01');
    await page.fill('input[name="end_date"]', '2026-05-31');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/start_date=2026-05-01/);
    await expect(page).toHaveURL(/end_date=2026-05-31/);
  });

  test('"Limpar" button resets filters', async ({ page }) => {
    await page.goto('/historico?start_date=2026-01-01&end_date=2026-01-31&room=Sala+1');
    await page.getByText('Limpar').click();
    await expect(page).toHaveURL('/historico');
  });

  test('table shows reservation records', async ({ page }) => {
    const tableHead = page.locator('thead');
    await expect(tableHead.getByText('Data')).toBeVisible();
    await expect(tableHead.getByText('Médico')).toBeVisible();
    await expect(tableHead.getByText('Status')).toBeVisible();
    await expect(tableHead.getByText('Cobrado')).toBeVisible();
  });
});
