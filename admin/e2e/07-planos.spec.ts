import { test, expect } from '@playwright/test';

test.describe('Planos (/planos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/medicos/assinaturas');
  });

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Planos & Assinaturas');
  });

  test('shows summary counts', async ({ page }) => {
    await expect(page.getByText('Ativos', { exact: true })).toBeVisible();
    await expect(page.getByText('Pendentes', { exact: true })).toBeVisible();
    await expect(page.getByText('Cancelados', { exact: true })).toBeVisible();
  });

  test('shows "Assinaturas" section heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Assinaturas', exact: true })).toBeVisible();
  });

  test('subscriptions table has correct columns', async ({ page }) => {
    const headers = ['Médico', 'Plano', 'Ciclo', 'Valor', 'Status', 'Início', 'Vencimento'];
    for (const h of headers) {
      await expect(page.locator('thead').getByText(h).first()).toBeVisible();
    }
  });

  test('a seção "Sem assinatura" aparece só quando há profissionais sem assinatura', async ({ page }) => {
    // O indicador do cabeçalho e a seção usam a mesma contagem; a seção só existe se ela for maior que zero.
    const rotulo = page.locator('header').getByText('Profissionais sem assinatura', { exact: true });
    await expect(rotulo).toBeVisible();
    const valor = Number(await rotulo.locator('xpath=preceding-sibling::p[1]').innerText());
    const secao = page.getByRole('heading', { name: /^Sem assinatura/ });
    if (valor > 0) await expect(secao).toBeVisible();
    else await expect(secao).toHaveCount(0);
  });
});
