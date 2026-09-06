import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('__fixtures/design-system/');
});

test('uses the approved hierarchy, local fonts, and responsive composition', async ({
  page,
}, testInfo) => {
  await expect(page.getByTestId('design-foundation')).toBeVisible();
  const headingFont = await page
    .getByRole('heading', { level: 1 })
    .evaluate((element) => getComputedStyle(element).fontFamily);
  const bodyFont = await page
    .locator('body')
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(headingFont).toContain('Space Grotesk Variable');
  expect(bodyFont).toContain('Manrope Variable');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#componentes').scrollIntoViewIfNeeded();
  for (const card of ['.feature-card', '.form-card', '.state-card']) {
    const box = await page.locator(card).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(264);
  }
  const smallMark = page.getByRole('img', { name: 'Isotipo AL monocromo a 16 píxeles' });
  const regularMark = page.getByRole('img', { name: 'Isotipo AL a 32 píxeles' });
  expect((await smallMark.boundingBox())?.width).toBe(16);
  expect((await regularMark.boundingBox())?.width).toBe(32);

  if (testInfo.project.name === 'desktop-1440') {
    for (const zoom of ['2', '4']) {
      await page.evaluate((value) => (document.body.style.zoom = value), zoom);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Acción principal' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.evaluate(() => (document.body.style.zoom = '1'));
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('provides accessible button, field, and feedback states', async ({ page }) => {
  const controls = page.locator('[data-ui-button], input');
  for (let index = 0; index < (await controls.count()); index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  const loading = page.getByRole('button', { name: 'Procesando' });
  await expect(loading).toBeDisabled();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'No disponible' })).toBeDisabled();
  await expect(page.getByLabel('Correo de muestra')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('Revisa el formato');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const primary = page.getByRole('link', { name: 'Acción principal' });
  await expect(primary).toBeFocused();
  expect(
    await primary.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    }),
  ).toBe(true);

  await primary.hover();
  await page.waitForTimeout(180);
  expect(await primary.evaluate((element) => getComputedStyle(element).transform)).not.toBe('none');
});

test('removes decorative movement when reduced motion is requested', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1024, height: 768 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/portfolio-alonso/__fixtures/design-system/');
  const motion = page.locator('[data-tilt]').first();
  await expect(motion).toBeVisible();
  expect(await motion.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  expect(
    await page.evaluate(() => document.documentElement.classList.contains('motion-enhanced')),
  ).toBe(false);
  await context.close();
});

test('does not activate cursor tilt on touch layouts', async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('mobile') && !testInfo.project.name.startsWith('tablet'),
  );
  const card = page.locator('[data-tilt]').first();
  const box = await card.boundingBox();
  if (!box) throw new Error('Tilt fixture is not visible.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  expect(await card.evaluate((element) => element.style.getPropertyValue('--tilt-x'))).toBe('');
  expect(await card.evaluate((element) => element.style.getPropertyValue('--tilt-y'))).toBe('');
});
