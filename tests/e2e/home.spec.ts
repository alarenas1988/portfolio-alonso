import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('renders the complete snapshot in order with local responsive media and working links', async ({
  page,
}) => {
  expect(
    await page
      .locator('[data-section]')
      .evaluateAll((sections) => sections.map((section) => section.getAttribute('data-section'))),
  ).toEqual([
    'projects',
    'about',
    'specialties',
    'stack',
    'experience',
    'impact',
    'blog',
    'contact',
  ]);
  await expect(page.locator('.project-card')).toHaveCount(3);
  await expect(page.locator('.blog-card')).toHaveCount(3);
  await expect(page.locator('h1')).toHaveCount(1);
  const smallTargets = await page.locator('a, button, summary').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
      })
      .map((element) => element.textContent?.trim()),
  );
  expect(smallTargets).toEqual([]);
  const terminal = await page.locator('.hero-terminal').boundingBox();
  const caption = await page.locator('#hero-visual-caption').boundingBox();
  expect(terminal!.y + terminal!.height).toBeLessThanOrEqual(caption!.y);
  for (const node of await page.locator('.hero-node').all()) {
    const box = (await node.boundingBox())!;
    expect(box.y + box.height <= terminal!.y || box.y >= terminal!.y + terminal!.height).toBe(true);
  }
  await expect(page.getByText('Organización de prueba')).toBeVisible();
  await expect(page.getByText('Métrica de prueba', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Descargar CV/ })).toHaveAttribute(
    'href',
    /^\/portfolio-alonso\/assets\/media\/[a-f0-9]{64}\.pdf$/,
  );
  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('src', /^\/portfolio-alonso\/assets\/media\//);
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true);
    expect(Number(await image.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(await image.getAttribute('height'))).toBeGreaterThan(0);
    expect(await image.getAttribute('alt')).toBeTruthy();
  }
  expect(await page.locator('picture source[type="image/avif"]').count()).toBeGreaterThan(0);
  expect(await page.locator('picture source[type="image/webp"]').count()).toBeGreaterThan(0);
  const brokenAnchors = await page.locator('a[href*="#"]').evaluateAll((links) =>
    links.flatMap((element) => {
      const link = element as HTMLAnchorElement;
      return link.hash && !document.getElementById(decodeURIComponent(link.hash.slice(1)))
        ? [link.hash]
        : [];
    }),
  );
  expect(brokenAnchors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const remoteRequests = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => new URL(url).origin !== location.origin),
  );
  expect(remoteRequests).toEqual([]);
});

test('desktop navigation compacts on scroll and preserves keyboard targets', async ({
  page,
}, testInfo) => {
  test.skip((testInfo.project.use.viewport?.width ?? 0) < 768);
  const nav = page.getByRole('navigation', { name: 'Navegación principal', exact: true });
  await expect(nav).toBeVisible();
  await expect(page.locator('[data-navbar]')).not.toHaveAttribute('data-scrolled');
  for (const link of await nav.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await expect(page).toHaveURL(/#proyectos$/);
  await expect(page.locator('[data-navbar]')).toHaveAttribute('data-scrolled');
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeHidden();
});

test('mobile dialog traps focus, locks scroll, closes with Escape and returns focus', async ({
  page,
}, testInfo) => {
  test.skip((testInfo.project.use.viewport?.width ?? 0) >= 768);
  const trigger = page.getByRole('button', { name: 'Abrir menú' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Menú principal' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cerrar menú' })).toBeFocused();
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).overflow)).toBe(
    'hidden',
  );
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'LinkedIn' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cerrar menú' })).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('mobile-menu.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.locator('body').evaluate((body) => body.style.overflow)).toBe('');
  await trigger.click();
  await dialog.getByRole('link', { name: 'Contacto' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/#contacto$/);
  await trigger.click();
  await dialog.click({ position: { x: 3, y: 3 } });
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('empty collections are deliberate and contact/CV remain hidden unless configured', async ({
  page,
}) => {
  await page.goto('__fixtures/empty-home/');
  await expect(page.locator('.project-card, .blog-card')).toHaveCount(0);
  await expect(page.locator('[data-section="impact"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Descargar CV/ })).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"], a[href^="https://wa.me/"]')).toHaveCount(0);
  expect(await page.locator('[data-empty-state]').count()).toBeGreaterThanOrEqual(4);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('email copy provides accessible success and recoverable error without alert', async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          if (value !== 'contacto@example.test') throw new Error('Incorrect copy payload');
        },
      },
    }),
  );
  const copy = page.getByRole('button', { name: 'Copiar correo' });
  await copy.click();
  await expect(page.getByRole('status')).toContainText('Correo copiado');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Fixture permission denied');
        },
      },
    }),
  );
  await copy.click();
  await expect(page.getByRole('status')).toContainText('No se pudo copiar');
  await expect(page.locator('main a[href^="mailto:"]')).toHaveAttribute(
    'href',
    'mailto:contacto@example.test',
  );
  await expect(page.locator('main a[href^="https://wa.me/"]')).toHaveAttribute(
    'href',
    /12025550142\?text=Hola/,
  );
});

test('essential navigation and complete content work without JavaScript', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/portfolio-alonso/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegación móvil' })
    .getByRole('link', { name: 'Proyectos' })
    .click();
  await expect(page).toHaveURL(/#proyectos$/);
  for (const selector of [
    '.project-card',
    '.blog-card',
    '[data-section="experience"]',
    '[data-section="contact"]',
  ])
    await expect(page.locator(selector).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar correo' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('home-no-js.png'), fullPage: true });
  await context.close();
});

test('reduced motion keeps all content visible with no decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  expect(
    await page
      .locator('.hero-stage')
      .evaluateAll((elements) =>
        elements.every((element) => getComputedStyle(element).animationName === 'none'),
      ),
  ).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.classList.contains('motion-enhanced')),
  ).toBe(false);
  await expect(page.locator('[data-section="contact"]')).toBeVisible();
  expect(
    await page
      .locator('[data-tilt]')
      .first()
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe('none');
});
