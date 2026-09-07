import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import { env, ref, cliJson, verifyProject, verifyLink, sql } from './edge-remote.mjs';
import { githubOperator } from './github-operator.mjs';
import { supabaseFetch } from '../src/lib/supabase/transport.ts';
import { resolveAdminAccess } from '../src/lib/admin/auth.ts';

assert.equal(process.argv[2], '--smoke-f11');
verifyProject();
verifyLink();
assert.equal(
  sql('select max(version) as version from supabase_migrations.schema_migrations')[0].version,
  '20260907002400',
);
const gh = githubOperator(),
  repository = 'repos/alarenas1988/portfolio-alonso';
const profiles = sql('select id,role,active,updated_at from public.admin_profiles');
assert.equal(profiles.length, 1);
assert(profiles[0].active && profiles[0].role === 'owner');
const profileHash = createHash('sha256').update(JSON.stringify(profiles)).digest('hex');
const keys = cliJson(['projects', 'api-keys', '--project-ref', ref, '--reveal']);
const secret = keys.find((k) => k.type === 'secret')?.api_key;
assert(secret?.startsWith('sb_secret_'));
const make = (key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) =>
  createClient(env.PUBLIC_SUPABASE_URL, key, {
    global: {
      fetch: (input, init) => supabaseFetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const privileged = make(secret),
  owner = make(),
  normal = make();
const checks = [],
  publications = [];
let fixtureUser, ownerSession, browser;
const ok = (r, label) => {
  if (r.error) throw new Error(label + ' failed; provider response withheld.');
  return r.data;
};
const check = (condition, label) => {
  assert(condition, label);
  checks.push({ name: label, passed: true });
};
const invoke = async (token, body) => {
  const response = await fetch(new URL('/functions/v1/publish-site', env.PUBLIC_SUPABASE_URL), {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: {
      Origin: 'https://alarenas1988.github.io',
      apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
};
mkdirSync('.tools/f11/screenshots', { recursive: true });
const cleanupState = () =>
  writeFileSync(
    '.tools/f11/publishing-cleanup.json',
    JSON.stringify({
      fixture_user: fixtureUser,
      actual_publications: publications.map((p) => p.id),
      owner_credentials_persisted: false,
    }),
  );
try {
  const denied = await invoke(null, { request_id: randomUUID(), trigger_type: 'manual' });
  check(denied.status === 401, 'Anonymous publication denied');
  const credentials = {
    email: 'f11-temporary-' + randomUUID() + '@example.test',
    password: randomBytes(32).toString('base64url') + 'Aa1!',
  };
  fixtureUser = ok(
    await privileged.auth.admin.createUser({ ...credentials, email_confirm: true }),
    'Create nonowner fixture',
  ).user.id;
  cleanupState();
  const normalSession = ok(
    await normal.auth.signInWithPassword(credentials),
    'Authenticate nonowner',
  ).session;
  ok(
    await normal.auth.updateUser({ data: { role: 'owner', active: true } }),
    'Forge nonowner metadata',
  );
  check(
    (await invoke(normalSession.access_token, { request_id: randomUUID(), trigger_type: 'manual' }))
      .status === 403,
    'Forged metadata cannot dispatch',
  );
  check(
    !!(await normal.from('site_builds').select('*')).error ||
      (await normal.from('site_builds').select('*')).data?.length === 0,
    'Nonowner cannot read builds',
  );
  const user = ok(
    await privileged.auth.admin.getUserById(profiles[0].id),
    'Read definitive owner',
  ).user;
  // Administrative generation does not send email or change the owner's password.
  const link = ok(
    await privileged.auth.admin.generateLink({ type: 'magiclink', email: user.email }),
    'Generate one-time owner session',
  );
  ownerSession = ok(
    await owner.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' }),
    'Exchange owner session',
  ).session;
  check(
    (await resolveAdminAccess(owner)).state === 'owner',
    'Definitive owner verified by Auth and RLS',
  );
  browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: 'https://alarenas1988.github.io/portfolio-alonso/',
    extraHTTPHeaders: { DNT: '1', 'Sec-GPC': '1' },
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(
    ({ key, session }) => {
      if (globalThis.location.origin === 'https://alarenas1988.github.io')
        globalThis.localStorage.setItem(key, session);
    },
    { key: 'sb-' + ref + '-auth-token', session: JSON.stringify(ownerSession) },
  );
  const page = await context.newPage();
  await page.goto('admin/builds/');
  await expect(page.locator('[data-admin-module]')).toBeVisible();
  check(true, 'Owner accesses the production physical Admin page');

  async function publish(cancel = false) {
    const request = page.waitForRequest(
      (r) => r.url().endsWith('/functions/v1/publish-site') && r.method() === 'POST',
    );
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/functions/v1/publish-site') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Solicitar publicación', exact: true }).click();
    const payload = (await request).postDataJSON(),
      received = await response;
    const reserved = ok(
      await owner
        .from('site_builds')
        .select('id,status')
        .eq('request_id', payload.request_id)
        .single(),
      'Find committed publication by request UUID',
    );
    const id = reserved.id,
      transitions = ['queued'];
    const evidence = { id, cancellation_test: cancel, transitions, request_id: payload.request_id };
    publications.push(evidence);
    cleanupState();
    check(
      received.status() === 202,
      'Production CMS reserves an owner publication (HTTP ' + received.status() + ')',
    );
    const duplicate = await invoke(ownerSession.access_token, payload);
    check(
      duplicate.status === 202 && duplicate.data.build_id === id,
      'Same request UUID returns the same build',
    );
    let cancellationSent = false,
      completed;
    for (let attempt = 0; attempt < 100; attempt++) {
      const row = ok(
        await owner.from('site_builds').select('*').eq('id', id).single(),
        'Read publication',
      );
      if (!transitions.includes(row.status)) {
        transitions.push(row.status);
        console.log({ publication: cancel ? 'cancellation' : 'normal', status: row.status });
      }
      if (cancel && !cancellationSent) {
        const runs = gh.api(
          repository +
            '/actions/workflows/deploy-pages.yml/runs?event=repository_dispatch&per_page=20',
        ).workflow_runs;
        const run = runs.find((r) => r.display_title === 'C2 ' + id);
        if (run && run.status === 'in_progress') {
          const jobs = gh.api(repository + '/actions/runs/' + run.id + '/jobs').jobs;
          assert(
            !jobs.some((j) => j.name === 'Deploy Pages' && j.status !== 'queued'),
            'Only cancel the test before Pages deployment',
          );
          gh.api(repository + '/actions/runs/' + run.id + '/cancel', 'POST');
          cancellationSent = true;
          evidence.cancelled_run = run.id;
        }
      }
      if (['success', 'failed'].includes(row.status)) {
        completed = row;
        break;
      }
      await delay(5000);
    }
    assert(completed, 'Publication did not reach terminal state within the bounded observation');
    Object.assign(evidence, {
      status: completed.status,
      reason: completed.failure_reason,
      run_id: completed.github_run_id,
      run_url: completed.github_run_url,
      deployment_id: completed.deployment_id,
      commit: completed.commit_sha,
      created_at: completed.created_at,
      completed_at: completed.completed_at,
      duration_seconds: Math.round(
        (Date.parse(completed.completed_at) - Date.parse(completed.created_at)) / 1000,
      ),
    });
    check(
      completed.status === (cancel ? 'failed' : 'success'),
      cancel
        ? 'Automatic reconciliation recovers cancelled workflow'
        : 'Actual Pages deployment confirmed by HMAC callback',
    );
    if (cancel)
      check(completed.failure_reason === 'cancelled', 'Cancellation has a safe precise reason');
    else
      check(
        transitions.includes('building') && completed.deployment_id,
        'Observed queued/building/success with deployment identity',
      );
    await expect(page.getByRole('status')).toHaveText(
      cancel ? 'Publicación fallida' : 'Sitio actualizado',
      { timeout: 15000 },
    );
    await page.screenshot({
      path: '.tools/f11/screenshots/cms-production-' + (cancel ? 'cancelled' : 'success') + '.png',
      fullPage: true,
    });
    const runs = gh
      .api(
        repository +
          '/actions/workflows/deploy-pages.yml/runs?event=repository_dispatch&per_page=20',
      )
      .workflow_runs.filter((r) => r.display_title === 'C2 ' + id);
    check(runs.length === 1, 'Idempotent retry creates only one GitHub workflow');
    return completed;
  }
  await publish();
  await publish(true);
  const badCallback = await fetch(new URL('/functions/v1/build-status', env.PUBLIC_SUPABASE_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Build-Timestamp': String(Math.floor(Date.now() / 1000)),
      'X-Build-Signature': 'v1=' + '0'.repeat(64),
    },
    body: JSON.stringify({ action: 'reconcile' }),
    signal: AbortSignal.timeout(15000),
  });
  check(badCallback.status === 401, 'Untrusted callback signature rejected remotely');
  check(
    createHash('sha256')
      .update(JSON.stringify(sql('select id,role,active,updated_at from public.admin_profiles')))
      .digest('hex') === profileHash,
    'Definitive owner authorization unchanged',
  );
  writeFileSync(
    '.tools/f11/cms-production.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        checks,
        publications,
        owner_auth:
          'Temporary Auth session for existing owner; no password/email change, no email sent',
        actual_build_history_retained: true,
      },
      null,
      2,
    ),
  );
  console.log({
    cms_production_checks: checks.length,
    publications: publications.map((p) => ({
      status: p.status,
      run_id: p.run_id,
      duration_seconds: p.duration_seconds,
    })),
  });
} finally {
  await browser?.close();
  if (ownerSession) await owner.auth.signOut({ scope: 'local' });
  await normal.auth.signOut({ scope: 'local' });
  if (fixtureUser)
    ok(await privileged.auth.admin.deleteUser(fixtureUser), 'Remove nonowner fixture');
  writeFileSync(
    '.tools/f11/publishing-cleanup.json',
    JSON.stringify(
      {
        fixture_removed: true,
        owner_session_closed: true,
        actual_publications: publications.map((p) => p.id),
      },
      null,
      2,
    ),
  );
  console.log('Temporary account/session removed; actual publication history retained for audit.');
}
