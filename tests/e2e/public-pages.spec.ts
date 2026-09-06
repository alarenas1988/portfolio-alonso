import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  ['proyectos/', 'Del problema a la solución.'],
  ['proyectos/fixture-automatizacion/', 'Procesos que se conectan.'],
  ['blog/', 'Ideas que se construyen.'],
  ['blog/fixture-procesos/', 'Lo que un proceso nos dice antes de automatizarlo.'],
  ['sobre-mi/', 'Construyo soluciones digitales para simplificar procesos complejos.'],
  ['contacto/', '¿Construimos algo?'],
] as const;

for (const [route, heading] of routes)
  test(`static accessible responsive page: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://example.com/portfolio-alonso/${route}`,
    );
    await expect(page.locator('[data-navbar]')).toHaveAttribute('data-scrolled');
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      ids: [...document.querySelectorAll('[id]')].map((element) => element.id),
      canaries: /(?:PRIVATE|FUTURE|ARCHIVED)_\w+_CANARY/.test(document.documentElement.outerHTML),
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
    expect(new Set(dimensions.ids).size).toBe(dimensions.ids.length);
    expect(dimensions.canaries).toBe(false);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    for (const image of await page.locator('main img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
          ),
        )
        .toBe(true);
      await expect(image).toHaveAttribute(
        'src',
        /^\/portfolio-alonso\/assets\/media\/[a-f0-9]{64}\.png$/,
      );
      expect(Number(await image.getAttribute('width'))).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() =>
        window.performance
          .getEntriesByType('resource')
          .filter((entry) => new URL(entry.name).origin !== window.location.origin),
      ),
    ).toEqual([]);
    await page.reload();
    await expect(page.locator('h1')).toHaveText(heading);
  });

test('project and category filters progressively hide only unmatched public cards', async ({
  page,
}, info) => {
  test.skip(!['mobile-390', 'desktop-1440'].includes(info.project.name));
  await page.goto('proyectos/');
  await page.getByLabel('Tecnología').selectOption({ label: 'PostgreSQL' });
  await expect(page.locator('#project-list [data-filter-values]:visible')).toHaveCount(1);
  await expect(page.locator('[data-filter-status]')).toHaveText('1 resultado');
  await page.getByLabel('Tecnología').selectOption('');
  await expect(page.locator('#project-list [data-filter-values]:visible')).toHaveCount(3);
  await page.goto('blog/');
  await expect(page.getByText('Categoría sin publicaciones', { exact: true })).toHaveCount(0);
  await page.getByLabel('Categoría').selectOption({ label: 'Desarrollo' });
  await expect(page.locator('#post-list [data-filter-values]:visible')).toHaveCount(1);
});

test('article TOC copy code and share are keyboard accessible with safe feedback', async ({
  page,
}, info) => {
  test.skip(!['mobile-390', 'desktop-1440'].includes(info.project.name));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset.copied = value;
        },
      },
    }),
  );
  await page.goto('blog/fixture-procesos/');
  const toc = page.getByRole('navigation', { name: 'Contenido del artículo' });
  await toc.getByRole('link', { name: 'Dibujar el recorrido', exact: true }).click();
  await expect(page).toHaveURL(/#content-article-dibujar-el-recorrido-1$/);
  await page.getByRole('button', { name: 'Copiar código' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.code-block [role="status"]')).toHaveText('Código copiado');
  const code = await page.locator('.code-block code').textContent();
  await expect(page.locator('html')).toHaveAttribute('data-copied', code!);
  await page.getByRole('button', { name: 'Copiar enlace' }).click();
  await expect(page.locator('[data-share-status]')).toHaveText('Enlace copiado');
  await expect(page.locator('html')).toHaveAttribute(
    'data-copied',
    'https://example.com/portfolio-alonso/blog/fixture-procesos/',
  );
  await expect(page.locator('[data-share-linkedin]')).toHaveAttribute('rel', 'noopener noreferrer');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Test denied');
        },
      },
    }),
  );
  await page.getByRole('button', { name: 'Copiar código' }).click();
  await expect(page.locator('.code-block [role="status"]')).toContainText('No se pudo copiar');
});

test('minimum case and short article omit absent sections and TOC', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-390');
  await page.goto('proyectos/fixture-inteligencia/');
  await expect(page.locator('.case-section, .gallery, .case-cover')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Continuar explorando' })).toBeVisible();
  await page.goto('blog/fixture-herramientas/');
  await expect(page.locator('.article-toc, .code-block')).toHaveCount(0);
  await expect(page.locator('.article-body .prose')).toContainText('Una nota breve');
  for (const route of [
    'blog/never-draft-post/',
    'blog/never-future-post/',
    'proyectos/never-draft-project/',
  ]) {
    expect((await page.goto(route))?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Página no encontrada');
  }
});

test('contact validates without sending keeps draft and copies email', async ({ page }, info) => {
  test.skip(!['mobile-390', 'desktop-1440'].includes(info.project.name));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => undefined } }),
  );
  await page.goto('contacto/');
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') mutations.push(request.url());
  });
  await expect(page.getByRole('button', { name: 'Enviar mensaje — próximamente' })).toBeDisabled();
  await page.getByRole('button', { name: 'Revisar mensaje' }).click();
  await expect(page.getByLabel('Nombre', { exact: false }).first()).toBeFocused();
  await expect(page.locator('#error-email')).toContainText('correo válido');
  await page.locator('#contact-name').fill('Test Person');
  await page.locator('#contact-email').fill('person@example.test');
  await page.locator('#contact-subject').fill('Prueba del formulario');
  await page
    .locator('#contact-message')
    .fill('Este es un mensaje sintético con suficiente contexto.');
  await page.getByRole('button', { name: 'Revisar mensaje' }).click();
  await expect(page.locator('[data-form-status]')).toContainText('El envío aún no está disponible');
  await expect(page.locator('#contact-message')).toHaveValue(
    'Este es un mensaje sintético con suficiente contexto.',
  );
  await page.getByRole('button', { name: 'Copiar correo' }).click();
  await expect(page.locator('#email-copy-feedback')).toContainText('Correo copiado');
  expect(mutations).toEqual([]);
});

test('all internal routes remain complete without JavaScript and mobile menu stays usable', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'mobile-390');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  for (const [route, heading] of routes) {
    await page.goto(`http://127.0.0.1:4322/portfolio-alonso/${route}`);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page.getByRole('link', { name: /Descargar CV/ }).first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page
    .getByRole('navigation', { name: 'Navegación móvil' })
    .getByRole('link', { name: 'Blog', exact: false })
    .click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.locator('#post-list .blog-card')).toHaveCount(4);
  await expect(page.locator('[data-content-filters]')).toBeHidden();
  await page.goto('http://127.0.0.1:4322/portfolio-alonso/contacto/');
  await page.locator('#contact-name').fill('No JS');
  await page.locator('#contact-name').press('Enter');
  await expect(page).toHaveURL(/\/contacto\/$/);
  await context.close();
});
