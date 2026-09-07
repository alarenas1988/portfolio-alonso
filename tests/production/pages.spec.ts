import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
  });
});
for (const route of [
  '',
  'proyectos/',
  'blog/',
  'sobre-mi/',
  'contacto/',
  'admin/login/',
  'admin/reset-password/',
])
  test('Direct Pages route: ' + (route || 'Home'), async ({ page }, info) => {
    const failed: string[] = [],
      analytics: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(new URL(response.url()).pathname);
    });
    page.on('request', (request) => {
      if (request.url().includes('/functions/v1/track-event')) analytics.push('unexpected');
    });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(failed).toEqual([]);
    expect(analytics).toEqual([]);
    if (route === '' || route === 'admin/login/') {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
      mkdirSync('.tools/f11/production-screenshots', { recursive: true });
      await page.screenshot({
        path: `.tools/f11/production-screenshots/${info.project.name}-${route ? 'login' : 'home'}.png`,
        fullPage: true,
      });
    }
  });
test('Pages returns the static 404', async ({ page }) => {
  expect((await page.goto('__c2_missing_route__/'))?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveCount(1);
});
