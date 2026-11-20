import { test, expect } from '@playwright/test';

test.describe('Leads (/comercial)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/comercial', { waitUntil: 'commit' });
  });

  test('tem título e painel de filtros recolhido', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Leads');
    await expect(page.getByRole('button', { name: /^Filtros/ })).toBeVisible();
    await expect(page.getByLabel('Filtrar por situação')).toHaveCount(0);
  });

  test('o painel abre com listas suspensas por assunto', async ({ page }) => {
    await page.getByRole('button', { name: /^Filtros/ }).click();
    for (const nome of ['atendimento', 'revisita', 'atendente', 'situação', 'temperatura', 'perfil', 'origem']) {
      await expect(page.getByLabel(`Filtrar por ${nome}`)).toBeVisible();
    }
  });

  test('escolher uma situação reescreve a URL e mostra o filtro ativo', async ({ page }) => {
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByLabel('Filtrar por situação').selectOption({ index: 1 });
    await expect(page).toHaveURL(/status=/);
    await expect(page.getByRole('button', { name: 'Limpar todos os filtros' })).toBeVisible();
  });

  test('cada lead tem o botão de detalhes e edição', async ({ page }) => {
    const botao = page.getByLabel(/^Detalhes e edição de /).first();
    if (await botao.count()) {
      await botao.click();
      await expect(page.getByRole('button', { name: 'Salvar' }).first()).toBeVisible();
    }
  });
});

test.describe('Conversas (/comercial/conversas)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/comercial/conversas', { waitUntil: 'commit' });
  });

  test('mostra o título, a busca e o botão de filtros', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Conversas');
    await expect(page.getByLabel('Buscar conversa por nome ou telefone')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Filtros/ })).toBeVisible();
  });

  test('o painel de filtros tem os critérios das etiquetas', async ({ page }) => {
    await page.getByRole('button', { name: /^Filtros/ }).click();
    for (const nome of ['vez de responder', 'atendimento', 'temperatura', 'situação do lead', 'origem']) {
      await expect(page.getByLabel(`Filtrar por ${nome}`)).toBeVisible();
    }
  });
});
