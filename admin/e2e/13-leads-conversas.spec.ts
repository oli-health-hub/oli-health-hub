import { test, expect } from '@playwright/test';
import { abrirFiltros } from './helpers';

test.describe('Leads (/comercial)', () => {
  // A página de Leads é pesada: a hidratação pode levar dezenas de segundos.
  test.setTimeout(75_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/comercial', { waitUntil: 'commit' });
  });

  test('tem título e painel de filtros recolhido', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Leads');
    await expect(page.getByRole('button', { name: /^Filtros/ })).toBeVisible();
    await expect(page.getByLabel('Filtrar por situação')).toHaveCount(0);
  });

  test('o painel abre com listas suspensas por assunto', async ({ page }) => {
    await abrirFiltros(page);
    for (const nome of ['atendimento', 'revisita', 'atendente', 'situação', 'temperatura', 'perfil', 'origem']) {
      await expect(page.getByLabel(`Filtrar por ${nome}`)).toBeVisible();
    }
  });

  test('escolher uma situação reescreve a URL e mostra o filtro ativo', async ({ page }) => {
    await abrirFiltros(page);
    await page.getByLabel('Filtrar por situação').selectOption({ index: 1 });
    // A navegação renderiza a página de Leads no servidor (pesada): 5 s não bastam.
    await expect(page).toHaveURL(/status=/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Limpar todos os filtros' })).toBeVisible();
  });

  test('cada lead tem o botão de detalhes e edição', async ({ page }) => {
    const botao = page.locator('summary[aria-label^="Detalhes e edição de "]').first();
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
    await abrirFiltros(page);
    for (const nome of ['vez de responder', 'atendimento', 'temperatura', 'situação do lead', 'origem']) {
      await expect(page.getByLabel(`Filtrar por ${nome}`)).toBeVisible();
    }
  });
});
