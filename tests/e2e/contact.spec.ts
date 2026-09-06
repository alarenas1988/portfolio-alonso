import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('contact receipt, concurrency, recoverable errors and keyboard feedback', async ({
  page,
}, info) => {
  test.skip(!['mobile-390', 'desktop-1440'].includes(info.project.name));
  const requests: { key: string; body: unknown }[] = [];
  let responseStatus = 503;
  let release: (() => void) | undefined;
  await page.route('**/functions/v1/contact-submit', async (route) => {
    requests.push({
      key: route.request().headers()['idempotency-key']!,
      body: route.request().postDataJSON(),
    });
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      status: responseStatus,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'http://127.0.0.1:4322', 'retry-after': '900' },
      body: JSON.stringify(
        responseStatus === 200 ? { status: 'accepted' } : { error: { code: 'temporary_failure' } },
      ),
    });
  });
  await page.goto('contacto/');
  const button = page.getByRole('button', { name: 'Enviar mensaje', exact: true });
  await page.locator('#contact-name').fill('Fixture de formulario');
  await page.locator('#contact-email').fill('fixture@example.test');
  await page.locator('#contact-subject').fill('Prueba F9');
  const message = 'Mensaje sintético que debe conservarse si la red falla.';
  await page.locator('#contact-message').fill(message);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await expect.poll(() => requests.length).toBe(1);
  release!();
  await expect(page.locator('[data-form-status]')).toContainText('Conservamos tu mensaje');
  await expect(page.locator('[data-form-status]')).toBeFocused();
  await expect(page.locator('#contact-message')).toHaveValue(message);
  responseStatus = 429;
  await button.click();
  await expect.poll(() => requests.length).toBe(2);
  release!();
  await expect(page.locator('form')).toHaveAttribute('data-state', 'rate-limited');
  await expect(page.locator('#contact-message')).toHaveValue(message);
  responseStatus = 200;
  await button.click();
  await expect.poll(() => requests.length).toBe(3);
  release!();
  await expect(page.locator('[data-form-status]')).toContainText('Mensaje recibido');
  await expect(page.locator('[data-form-status]')).toHaveAttribute('aria-atomic', 'true');
  await expect(page.locator('#contact-message')).toHaveValue('');
  expect(new Set(requests.map((request) => request.key)).size).toBe(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: `.tools/f9-contact-${info.project.name}-success.png`,
    fullPage: true,
  });
});

test('contact timeout retains input and enables an explicit retry', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440');
  await page.route('**/functions/v1/contact-submit', async () => {
    /* Deliberately no response: browser transport deadline aborts. */
  });
  await page.goto('contacto/');
  await page.locator('#contact-name').fill('Fixture timeout');
  await page.locator('#contact-email').fill('fixture@example.test');
  await page.locator('#contact-subject').fill('Timeout F9');
  await page.locator('#contact-message').fill('Este mensaje no debe perderse durante el timeout.');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('[data-form-status]')).toContainText('Conservamos tu mensaje', {
    timeout: 20000,
  });
  await expect(page.locator('#contact-message')).toHaveValue(
    'Este mensaje no debe perderse durante el timeout.',
  );
  await expect(page.getByRole('button', { name: 'Enviar mensaje', exact: true })).toBeEnabled();
});
