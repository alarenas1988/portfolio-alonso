import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { getBuildConfig } from '../src/lib/config/build.ts';

const directory = resolve(process.argv[2] || '.tools/home-e2e-dist');
const label = process.argv[3] || 'fixture';
if (!/^[a-z-]+$/.test(label)) throw new Error('Invalid capture label.');
const { base } = getBuildConfig('production');
const evidence = resolve('.tools/f4-visual');
await mkdir(evidence, { recursive: true });
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    let file = resolve(directory, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
    if (relative(directory, file).startsWith('..')) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    response
      .writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
      .end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const browser = await chromium.launch();
const routes = [
  ['projects', 'proyectos/', [390, 768, 1440]],
  ['blog', 'blog/', [390, 1440]],
  ['about', 'sobre-mi/', [390, 1440]],
  ['contact', 'contacto/', [390, 1440]],
  ...(label === 'fixture'
    ? [
        ['case', 'proyectos/fixture-automatizacion/', [390, 1440]],
        ['article', 'blog/fixture-procesos/', [390, 1440]],
      ]
    : []),
];
const results = [];
try {
  for (const [name, route, widths] of routes)
    for (const width of widths) {
      const page = await browser.newPage({
        viewport: { width, height: width < 768 ? 844 : 1000 },
        reducedMotion: 'reduce',
      });
      await page.goto(`http://127.0.0.1:${server.address().port}${base}${route}`);
      await page.evaluate(() => document.fonts.ready);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 700) {
        await page.evaluate((position) => window.scrollTo(0, position), y);
        await page.waitForTimeout(30);
      }
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => undefined)),
        );
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: resolve(evidence, `${label}-${name}-${width}.png`),
        fullPage: true,
      });
      await page.screenshot({ path: resolve(evidence, `${label}-${name}-${width}-hero.png`) });
      if (name === 'article')
        await page
          .locator('.article-body')
          .screenshot({ path: resolve(evidence, `${label}-${name}-${width}-body.png`) });
      if (name === 'contact')
        await page
          .locator('.contact-form-layout')
          .screenshot({ path: resolve(evidence, `${label}-${name}-${width}-form.png`) });
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        h1: document.querySelectorAll('h1').length,
        brokenImages: [...document.images].filter((image) => !image.complete || !image.naturalWidth)
          .length,
        remoteResources: window.performance
          .getEntriesByType('resource')
          .filter((entry) => new URL(entry.name).origin !== window.location.origin).length,
      }));
      if (metrics.overflow || metrics.brokenImages || metrics.remoteResources || metrics.h1 !== 1)
        throw new Error(`Invalid static page: ${name}/${width}`);
      results.push({ name, route, width, ...metrics });
      await page.close();
    }
  await writeFile(
    resolve(evidence, `${label}-checks.json`),
    JSON.stringify(results, null, 2) + '\n',
  );
  console.log(
    `Captured ${results.length} ${label} pages; static media, headings and widths verified.`,
  );
} finally {
  await browser.close();
  await new Promise((done) => {
    server.close(done);
    server.closeAllConnections();
  });
}
