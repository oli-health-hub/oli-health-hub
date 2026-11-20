import { expect, type Page } from '@playwright/test';

/**
 * Abre o painel "Filtros" depois que a página hidratou. Clicar antes disso não faz nada, e o React
 * pode reaplicar o clique ao hidratar (abrindo e fechando o painel); por isso espera o React
 * anexar seus manipuladores ao botão (`__reactProps$…`) e só então clica, uma vez.
 */
export async function abrirFiltros(page: Page) {
  const botao = page.getByRole('button', { name: /^Filtros/ });
  await botao.waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const el = Array.from(document.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').startsWith('Filtros'));
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'));
    },
    undefined,
    { timeout: 60_000 },
  );
  if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.click();
  await expect(botao).toHaveAttribute('aria-expanded', 'true');
}
