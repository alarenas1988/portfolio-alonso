import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { sql, verifyProject, verifyLink } from './edge-remote.mjs';

assert.equal(process.argv[2], '--smoke-f11');
verifyProject();
verifyLink();
const ids = new Set(),
  contacts = new Set(),
  checks = [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const check = (value, name) => {
  assert(value, name);
  checks.push({ name, passed: true });
};
const day = sql("select (now() at time zone 'America/Santiago')::date as date")[0].date;
const browser = await chromium.launch();
mkdirSync('.tools/f11/screenshots', { recursive: true });
try {
  const context = await browser.newContext({
    baseURL: 'https://alarenas1988.github.io/portfolio-alonso/',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  });
  // Only this explicit, cleaned smoke opts into analytics. General E2E remains excluded.
  await context.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'webdriver', { value: false });
    Object.defineProperty(globalThis.navigator, 'doNotTrack', { value: '0' });
    Object.defineProperty(globalThis.navigator, 'globalPrivacyControl', { value: false });
  });
  const page = await context.newPage();
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (request.url().endsWith('/functions/v1/track-event')) {
      const payload = request.postDataJSON();
      if (uuid.test(payload.event_id)) ids.add(payload.event_id);
      check(
        !Object.keys(payload).some(
          (k) => /email|name$|message|token|cookie|authorization/i.test(k) && k !== 'pathname',
        ),
        'Analytics contains only approved minimal fields',
      );
      check(payload.event_type !== 'contact_submit', 'Browser never emits contact conversion');
    }
    if (request.url().endsWith('/functions/v1/contact-submit')) {
      const id = request.headers()['idempotency-key'];
      if (uuid.test(id)) {
        contacts.add(id);
        ids.add(id);
      }
    }
  });
  for (const path of ['', 'proyectos/', 'blog/', 'contacto/']) {
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/functions/v1/track-event') && r.request().method() === 'POST',
    );
    await page.goto(path);
    check((await response).status() === 200, 'Pages analytics accepted: ' + (path || 'Home'));
    if (path === '') {
      await page.screenshot({
        path: '.tools/f11/screenshots/pages-home-reduced.png',
        fullPage: true,
      });
    }
  }
  for (const [name, value] of Object.entries({
    name: 'TEMP F11 Pages',
    email: 'fixture@example.test',
    subject: 'TEMP_F11_PAGES_CONTACT',
    message:
      'Mensaje sintetico para verificar Pages y la recepcion segura. Este fixture se elimina al finalizar.',
  }))
    await page.locator('#contact-' + name).fill(value);
  await delay(3000);
  await page.locator('[data-send-message]').click();
  await expect(page.locator('[data-contact-form]')).toHaveAttribute('data-state', 'success', {
    timeout: 30000,
  });
  check(contacts.size === 1, 'One real contact submission from Pages');
  await page.screenshot({
    path: '.tools/f11/screenshots/pages-contact-success.png',
    fullPage: true,
  });
  for (const id of contacts) {
    const row = sql(
      `select (select count(*) from public.contact_messages where submission_id='${id}' and notification_status='disabled') as messages,(select count(*) from public.analytics_events where event_id='${id}' and event_type='contact_submit') as conversions`,
    )[0];
    check(
      Number(row.messages) === 1 && Number(row.conversions) === 1,
      'One receipt, one server conversion, no outgoing email',
    );
  }
  const row = sql(
    `select count(*)::int as count from public.analytics_events where event_id in (${[...ids].map((id) => `'${id}'`).join(',')})`,
  )[0];
  check(row.count === 5, 'Four page views plus one contact conversion persisted');
} finally {
  await browser.close();
  const values =
    [...ids].map((id) => `'${id}'`).join(',') || "'00000000-0000-4000-8000-000000000000'";
  sql(
    `begin;delete from public.contact_messages where submission_id in (${values}) and subject='TEMP_F11_PAGES_CONTACT';delete from public.analytics_events where event_id in (${values});set local role service_role;select public.refresh_analytics('${day}',(now() at time zone 'America/Santiago')::date);commit;`,
  );
  check(
    Number(
      sql(
        `select (select count(*) from public.analytics_events where event_id in (${values}))+(select count(*) from public.contact_messages where submission_id in (${values})) as count`,
      )[0].count,
    ) === 0,
    'Exact fixtures removed; aggregates rebuilt from remaining traffic',
  );
  writeFileSync(
    '.tools/f11/pages-intake-cleanup.json',
    JSON.stringify({ fixtures_removed: true, ids: [...ids] }, null, 2),
  );
}
writeFileSync(
  '.tools/f11/pages-intake.json',
  JSON.stringify({ date: new Date().toISOString(), checks, fixtures_removed: true }, null, 2),
);
console.log({ checks: checks.length, fixtures_removed: true });
