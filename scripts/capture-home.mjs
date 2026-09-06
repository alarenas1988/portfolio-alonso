import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { getBuildConfig } from '../src/lib/config/build.ts';

const directory = resolve(process.argv[2] || 'dist');
const label = process.argv[3] || 'remote';
if (!/^[a-z-]+$/.test(label)) throw new Error('Invalid capture label.');
const { base } = getBuildConfig('production');
const evidence = resolve('.tools/f3-visual');
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
const results = [];
try {
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 768 ? 844 : 1000 },
      reducedMotion: 'reduce',
    });
    await page.goto(`http://127.0.0.1:${server.address().port}${base}`);
    await page.evaluate(() => document.fonts.ready);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let position = 0; position < height; position += 700) {
      await page.evaluate((y) => window.scrollTo(0, y), position);
      await page.waitForTimeout(40);
    }
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(80);
    await page.screenshot({ path: resolve(evidence, `${label}-${width}.png`), fullPage: true });
    await page.screenshot({ path: resolve(evidence, `${label}-${width}-hero.png`) });
    if (width === 390 || width === 1440) {
      for (const section of ['projects', 'about', 'experience', 'blog', 'contact'])
        await page
          .locator(`[data-section="${section}"]`)
          .screenshot({ path: resolve(evidence, `${label}-${width}-${section}.png`) });
    }
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      headings: document.querySelectorAll('h1').length,
      brokenImages: [...document.images].filter((image) => !image.complete || !image.naturalWidth)
        .length,
      scripts: [...document.scripts].filter((script) => script.src).length,
      remoteResources: window.performance
        .getEntriesByType('resource')
        .filter((entry) => new URL(entry.name).origin !== window.location.origin).length,
    }));
    results.push({ width, ...metrics });
    if (
      metrics.overflow ||
      metrics.brokenImages ||
      metrics.headings !== 1 ||
      metrics.remoteResources
    )
      throw new Error('Capture detected an invalid static Home.');
    await page.close();
  }
  await writeFile(
    resolve(evidence, `${label}-checks.json`),
    JSON.stringify(results, null, 2) + '\n',
  );
  console.log(`Captured ${label}: six widths, no overflow, broken images or remote resources.`);
} finally {
  await browser.close();
  await new Promise((done) => {
    server.close(done);
    server.closeAllConnections();
  });
}
