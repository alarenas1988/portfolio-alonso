import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadPublicSnapshot } from '../src/lib/content/snapshot.ts';
import { cliJson, verifyProject, verifyLink, ref, sql, env, root } from './edge-remote.mjs';
if (process.argv[2] !== '--smoke-f9')
  throw new Error('Explicit --smoke-f9 required; sends temporary remote fixtures.');
verifyProject();
verifyLink();
assert.deepEqual(
  cliJson(['functions', 'list', '--project-ref', ref]).map((f) => f.slug),
  ['contact-submit'],
);
const history = sql(
  'select version from supabase_migrations.schema_migrations order by version;',
).map((row) => row.version);
assert.deepEqual(history, ['20260906001900', '20260906002000', '20260906002100']);
const origin = 'https://alarenas1988.github.io';
const endpoint = new URL('/functions/v1/contact-submit', env.PUBLIC_SUPABASE_URL).href;
const ids = new Set();
const checks = [];
let browser;
let server;
let completed = false;
const previous = sql('select form_enabled from public.contact_settings;')[0].form_enabled;
const check = (condition, name) => {
  assert(condition, name);
  checks.push({ name, passed: true });
};
const draft = {
  name: 'TEMP_F9_FIXTURE',
  email: 'fixture@example.test',
  subject: 'TEMP_F9_EDGE_SMOKE',
  message: 'Mensaje sintético para verificar F9. Se elimina al terminar la prueba.',
  honeypot: '',
};
async function invoke(body, extra = {}) {
  const id = extra.id || randomUUID();
  ids.add(id);
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(25000),
    headers: {
      Origin: origin,
      apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': id,
      'X-Form-Started-At': String(Date.now() - 4000),
      ...extra.headers,
    },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return {
    status: response.status,
    data,
    cors: response.headers.get('access-control-allow-origin'),
  };
}
const saveCleanup = () =>
  writeFileSync(
    '.tools/f9/remote-fixture-cleanup.json',
    JSON.stringify({ ids: [...ids], previous_form_enabled: previous, completed: false }, null, 2),
  );
try {
  const preflight = await fetch(endpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'apikey,content-type,idempotency-key,x-form-started-at',
    },
  });
  check(
    preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === origin,
    'Hosted preflight has exact origin and 204',
  );
  const malicious = await invoke(draft, { headers: { Origin: 'https://evil.example' } });
  check(
    malicious.status === 403 && malicious.cors === null,
    'Hosted malicious Origin denied without CORS grant',
  );
  check(
    (await invoke(draft, { headers: { apikey: 'sb_publishable_invalid_fixture' } })).status === 401,
    'Hosted invalid public key denied',
  );
  check(
    (await invoke({ ...draft, honeypot: 'filled' })).status === 200,
    'Hosted honeypot returns generic receipt',
  );
  const publicClient = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const denied = await publicClient.from('contact_messages').insert({
    name: draft.name,
    email: draft.email,
    subject: draft.subject,
    message: draft.message,
  });
  check(denied.error?.code === '42501', 'Direct public contact INSERT remains denied');
  check(
    !!(await publicClient.rpc('edge_record_contact', {})).error,
    'Privileged RPC remains inaccessible to anon',
  );
  check((await invoke(draft)).status === 503, 'Disabled editorial form rejects legitimate request');
  saveCleanup();
  sql('begin; update public.contact_settings set form_enabled=true; commit;');
  // A real Astro artifact uses only the public snapshot/key. No owner session or secret enters it.
  const output = '.tools/contact-remote-dist';
  const build = spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output],
    {
      cwd: root,
      env: { ...process.env, ...env, ASTRO_PREVIEW_BACKGROUND: '0' },
      windowsHide: true,
      encoding: 'utf8',
      timeout: 120000,
    },
  );
  check(build.status === 0, 'Real public snapshot build for remote contact');
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
      '4321',
    ],
    {
      cwd: root,
      env: { ...process.env, ...env, ASTRO_PREVIEW_BACKGROUND: '0' },
      windowsHide: true,
      stdio: 'ignore',
    },
  );
  const pageUrl = 'http://127.0.0.1:4321/portfolio-alonso/contacto/';
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(pageUrl)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* preview starting */
    }
    await delay(250);
  }
  check(ready, 'Local Astro preview available for real remote function');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url() === endpoint) {
      const id = request.headers()['idempotency-key'];
      if (id && /^[a-f0-9-]{36}$/i.test(id)) {
        ids.add(id);
        saveCleanup();
      }
    }
  });
  await page.goto(pageUrl);
  await page.locator('#contact-name').fill(draft.name);
  await page.locator('#contact-email').fill(draft.email);
  await page.locator('#contact-subject').fill(draft.subject);
  await page.locator('#contact-message').fill(draft.message);
  await delay(3100);
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await page.locator('[data-contact-form][data-state="success"]').waitFor({ timeout: 25000 });
  check(
    (await page.locator('#contact-message').inputValue()) === '',
    'Real browser confirms receipt before clearing',
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: '.tools/f9/contact-remote-success.png', fullPage: true });
  const id = randomUUID();
  ids.add(id);
  saveCleanup();
  const first = await invoke(draft, { id });
  check(
    first.status === 200 && first.data.status === 'accepted' && first.cors === origin,
    'Real hosted contact receipt and exact CORS',
  );
  check((await invoke(draft, { id })).status === 200, 'Hosted duplicate request reuses receipt');
  check(
    sql(
      `select count(*)::int as count from public.contact_messages where submission_id='${id}';`,
    )[0].count === 1,
    'Duplicate request creates one message',
  );
  check(
    (await invoke({ ...draft, message: draft.message + ' Changed.' }, { id })).status === 409,
    'Same UUID with changed content is rejected',
  );
  for (let i = 0; i < 3; i++) {
    const result = await invoke(draft);
    saveCleanup();
    check(result.status === 200, 'Hosted accepted within source limit ' + (i + 3));
  }
  const limited = await invoke(draft);
  saveCleanup();
  check(limited.status === 429, 'Hosted sixth message is rate limited');
  const snapshot = await loadPublicSnapshot(publicClient);
  check(
    snapshot.contact?.form_enabled === true,
    'Snapshot exposes enabled form through existing public contract',
  );
  check(!JSON.stringify(snapshot).includes('TEMP_F9'), 'Snapshot contains no message fixtures');
  const values = [...ids].map((id) => "'" + id + "'").join(',');
  const state = sql(
    `select jsonb_build_object('messages',(select count(*) from public.contact_messages where submission_id in (${values}) and status='new' and notification_status='disabled'),'conversions',(select count(*) from public.analytics_events where event_id in (${values}) and event_type='contact_submit')) as state;`,
  )[0].state;
  check(
    state.messages === 5 && state.conversions === 5,
    'Five persisted messages and server conversions; notification disabled',
  );
  for (const table of [
    'contact_messages',
    'analytics_events',
    'site_builds',
    'admin_activity',
    'admin_profiles',
  ])
    check(
      (await publicClient.from(table).select('*')).error?.code === '42501',
      'Public private-table read denied: ' + table,
    );
  completed = true;
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill();
    await once(server, 'exit');
  }
  saveCleanup();
  if (ids.size) {
    const values = [...ids].map((id) => "'" + id + "'").join(',');
    sql(
      `begin; delete from public.contact_messages where submission_id in (${values}) and subject='TEMP_F9_EDGE_SMOKE'; delete from public.analytics_events where event_id in (${values}) and event_type='contact_submit'; commit;`,
    );
  }
  if (!completed) sql(`update public.contact_settings set form_enabled=${previous};`);
  writeFileSync(
    '.tools/f9/remote-fixture-cleanup.json',
    JSON.stringify(
      { completed: true, fixture_count: ids.size, form_enabled: completed ? true : previous },
      null,
      2,
    ),
  );
  writeFileSync(
    '.tools/f9/remote-smoke.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        completed,
        checks,
        form_enabled: completed ? true : previous,
        fixture_messages_removed: true,
        rate_counters: 'Preserved until normal expiry; production limits are not reset by tests.',
      },
      null,
      2,
    ),
  );
}
console.log(
  'Remote contact smoke passed: ' + checks.length + ' checks; fixtures removed; form enabled.',
);
