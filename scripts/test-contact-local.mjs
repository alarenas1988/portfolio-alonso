import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { localStatus, localSql, root } from './edge-local.mjs';
import { configureLocalEdgeCors } from './configure-edge-local-cors.mjs';
const status = localStatus();
configureLocalEdgeCors();
const previous = localSql('select form_enabled from public.contact_settings;') === 't';
const fixtureIds = new Set();
let server;
let browser;
const output = '.tools/contact-local-dist';
const env = {
  ...process.env,
  PUBLIC_SUPABASE_URL: status.API_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  PUBLIC_SITE_URL: 'https://alarenas1988.github.io/portfolio-alonso/',
  ASTRO_PREVIEW_BACKGROUND: '0',
  ASTRO_TELEMETRY_DISABLED: '1',
};
async function waitUntil(check) {
  for (let i = 0; i < 80; i++) {
    if (await check()) return;
    await delay(250);
  }
  throw new Error('Local contact UI condition timed out.');
}
try {
  localSql(
    'update public.contact_settings set form_enabled=true;delete from private.rate_limit_buckets;',
  );
  const build = spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output],
    { cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 120000 },
  );
  assert.equal(build.status, 0, 'Local snapshot build succeeds');
  server = spawn(
    process.execPath,
    [
      'node_modules/astro/bin/astro.mjs',
      'preview',
      '--outDir',
      output,
      '--host',
      '127.0.0.1',
      '--port',
      '4339',
    ],
    { cwd: root, env, windowsHide: true, stdio: 'ignore' },
  );
  const url = 'http://127.0.0.1:4339/portfolio-alonso/contacto/';
  await waitUntil(async () => {
    try {
      return (await fetch(url)).ok;
    } catch {
      return false;
    }
  });
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/contact-submit')) {
      const id = request.headers()['idempotency-key'];
      if (id && /^[0-9a-f-]{36}$/i.test(id)) fixtureIds.add(id);
    }
  });
  const button = page.getByRole('button', { name: 'Enviar mensaje', exact: true });
  const feedback = page.locator('[data-form-status]');
  async function fill(index) {
    await page.locator('#contact-name').fill('Fixture F9 local');
    await page.locator('#contact-email').fill('fixture@example.test');
    await page.locator('#contact-subject').fill('Fixture F9 UI ' + index);
    await page
      .locator('#contact-message')
      .fill('Mensaje sintético de integración local. Será eliminado al terminar.');
    await delay(3100);
  }
  await page.goto(url);
  await fill(0);
  await page.route('**/functions/v1/contact-submit', (route) => route.abort('failed'));
  await button.click();
  await waitUntil(
    async () => await feedback.textContent().then((text) => text.includes('Conservamos')),
  );
  assert(
    (await page.locator('#contact-message').inputValue()).length > 20,
    'Offline keeps message',
  );
  assert.equal(
    localSql("select count(*) from public.contact_messages where subject='Fixture F9 UI 0';"),
    '0',
  );
  await page.unroute('**/functions/v1/contact-submit');
  // Commit in the real Edge/DB but deliberately lose the response in transit.
  await page.route(
    '**/functions/v1/contact-submit',
    async (route) => {
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort('failed');
    },
    { times: 1 },
  );
  await button.click();
  await waitUntil(
    async () =>
      localSql("select count(*) from public.contact_messages where subject='Fixture F9 UI 0';") ===
      '1',
  );
  await waitUntil(async () => await button.isEnabled());
  await button.click();
  await waitUntil(async () => (await feedback.textContent()).includes('Mensaje recibido'));
  assert.equal(
    localSql("select count(*) from public.contact_messages where subject='Fixture F9 UI 0';"),
    '1',
    'Lost response retry creates no duplicate',
  );
  assert.equal(await page.locator('#contact-message').inputValue(), '');
  for (let i = 1; i <= 5; i++) {
    await fill(i);
    await button.click();
    await waitUntil(async () =>
      ['success', 'rate-limited'].includes(await page.locator('form').getAttribute('data-state')),
    );
    assert.equal(
      await page.locator('form').getAttribute('data-state'),
      i < 5 ? 'success' : 'rate-limited',
    );
  }
  assert(
    (await page.locator('#contact-message').inputValue()).length > 20,
    'Rate limit keeps message',
  );
  await page.screenshot({ path: '.tools/f9-contact-local-rate-limit.png', fullPage: true });
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const nojsPage = await nojs.newPage();
  await nojsPage.goto(url);
  assert(await nojsPage.getByRole('button', { name: 'Enviar mensaje', exact: true }).isDisabled());
  assert((await nojsPage.locator('noscript').textContent()).includes('JavaScript'));
  await nojs.close();
  writeFileSync(
    '.tools/contact-local-results.json',
    JSON.stringify(
      {
        local: true,
        checks: [
          'real static snapshot',
          'real Edge HTTP receipt',
          'offline preservation',
          'lost response after DB commit',
          'idempotent retry',
          'five messages persisted',
          'sixth message rate limited',
          'no-JS disabled submit',
          'reduced motion mobile',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    'Local contact UI passed: real Edge/DB receipt, offline, lost response/retry, rate limit, no-JS.',
  );
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill();
    await once(server, 'exit');
  }
  for (const id of fixtureIds)
    localSql(
      `delete from public.contact_messages where submission_id='${id}';delete from public.analytics_events where event_id='${id}';`,
    );
  localSql(
    `update public.contact_settings set form_enabled=${previous};delete from private.rate_limit_buckets;`,
  );
  console.log('Local browser fixtures removed; contact configuration restored.');
}
