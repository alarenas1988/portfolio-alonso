import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('serves a static, accessible bootstrap with a working stylesheet', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portfolio en preparación');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).color)).toBe(
    'rgb(248, 250, 252)',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('script[src]').count()).toBe(0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  expect(failures).toEqual([]);
  await page.screenshot({
    path: `test-results/bootstrap-${test.info().project.name}.png`,
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
  await expect(page.getByRole('heading', { name: 'Portfolio en preparación' })).toBeVisible();
});

test('remains readable without JavaScript and with reduced motion', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: 'reduce',
    viewport: { width: 320, height: 640 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/portfolio-alonso/');
  await expect(page.getByRole('heading', { name: 'Portfolio en preparación' })).toBeVisible();
  await expect(page.getByText('El contenido todavía no está conectado.')).toBeVisible();
  await context.close();
});
