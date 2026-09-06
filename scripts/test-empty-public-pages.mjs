import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getBuildConfig } from '../src/lib/config/build.ts';
import { staticPreview } from './static-preview.mjs';
const config = getBuildConfig('production');
const server = await staticPreview(process.argv[2] || '.tools/home-build-empty', config.base);
const browser = await chromium.launch();
let count = 0;
try {
  for (const javaScriptEnabled of [true, false])
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        javaScriptEnabled,
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      for (const route of ['proyectos/', 'blog/', 'sobre-mi/', 'contacto/']) {
        assert.equal((await page.goto(server.url + route)).status(), 200);
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(
          await page.locator('.project-card, .blog-card, [data-content-filters]').count(),
          0,
        );
        if (route === 'proyectos/' || route === 'blog/')
          assert.equal(await page.locator('[data-editorial-empty]').count(), 1);
        if (route === 'contacto/') {
          assert(await page.locator('#contact-name').isDisabled());
          assert.notEqual(await page.locator('fieldset').getAttribute('disabled'), null);
        }
        assert(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        // axe needs JS; the no-JS pass checks rendered content and native navigation separately.
        if (javaScriptEnabled)
          assert.deepEqual(
            (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
              .violations,
            [],
          );
        count++;
      }
      assert.equal((await page.goto(server.url + 'blog/nonexistent/')).status(), 404);
      assert.equal(await page.locator('h1').textContent(), 'Página no encontrada');
      await page.getByRole('link', { name: 'Volver al inicio' }).click();
      assert.equal(new URL(page.url()).pathname, config.base);
      await context.close();
    }
  console.log(
    `Empty public pages: ${count} checks, with/without JS, mobile/desktop, 404 and accessibility passed.`,
  );
} finally {
  await browser.close();
  await server.close();
}
