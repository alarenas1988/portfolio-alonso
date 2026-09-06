import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('serves the static, accessible public Home under the repository base', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tecnología aplicada a problemas reales.',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).color)).toBe(
    'rgb(248, 250, 252)',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  expect(failures).toEqual([]);
  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => (document.documentElement.style.scrollBehavior = 'auto'));
  for (let y = 0; y < documentHeight; y += 600) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForTimeout(100);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('404 recovery remains inside the repository subpath', async ({ page }) => {
  const response = await page.goto('./pagina-inexistente/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  const home = page.getByRole('link', { name: 'Volver al inicio' });
  await expect(home).toHaveAttribute('href', '/portfolio-alonso/');
  expect(await home.evaluate((link) => link.getBoundingClientRect().height)).toBeGreaterThanOrEqual(
    44,
  );
  await home.click();
  await expect(
    page.getByRole('heading', { name: 'Tecnología aplicada a problemas reales.' }),
  ).toBeVisible();
});

test('remains readable without JavaScript and with reduced motion', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: 'reduce',
    viewport: { width: 320, height: 640 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/portfolio-alonso/');
  await expect(
    page.getByRole('heading', { name: 'Tecnología aplicada a problemas reales.' }),
  ).toBeVisible();
  await expect(
    page.getByText('Construyo soluciones digitales para simplificar procesos complejos.'),
  ).toBeVisible();
  await context.close();
});
