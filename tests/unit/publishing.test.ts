import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { currentMain, checkDeployment } from '../../scripts/publishing/health.mjs';
import {
  buildIdentity,
  signBody,
  sendSigned,
  repository,
} from '../../scripts/publishing/contract.mjs';

const id = 'bfe3c79c-9e22-4be2-a60c-a2d305e6487d';
const env = { GITHUB_REPOSITORY: repository, GITHUB_REF: 'refs/heads/main' };
const event = { action: 'portfolio_publish', client_payload: { build_id: id } };

test('superseded code is rejected before the deployment action', async () => {
  const sha = 'a'.repeat(40);
  await currentMain(sha, async () => Response.json({ commit: { sha } }));
  await assert.rejects(
    currentMain(sha, async () => Response.json({ commit: { sha: 'b'.repeat(40) } })),
  );
  await assert.rejects(currentMain(sha, async () => new Response('', { status: 503 })));
});

test('main verification authenticates only to the fixed GitHub API and rejects provider errors', async () => {
  const sha = 'a'.repeat(40),
    token = randomBytes(32).toString('hex');
  await currentMain(
    sha,
    async (input, init) => {
      assert.equal(String(input), `https://api.github.com/repos/${repository}/branches/main`);
      assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`);
      assert.equal(init?.redirect, 'error');
      assert(init?.signal);
      return Response.json({ commit: { sha } });
    },
    token,
  );
  await assert.rejects(
    currentMain(sha, async () => new Response(token, { status: 403 }), token),
    (error) =>
      error instanceof Error &&
      error.message.includes('HTTP 403') &&
      !error.message.includes(token),
  );
});
test('production health verifies physical routes, 404 and base-prefixed static assets', async () => {
  const report = await checkDeployment(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('.css')) return new Response('body{}');
    return new Response(
      '<h1>Portfolio</h1><meta name="robots" content="noindex,nofollow"><link href="/portfolio-alonso/_astro/main.css">',
      { status: path.includes('__c2_missing_route__') ? 404 : 200 },
    );
  });
  assert.equal(report.routes.length, 8);
  assert.equal(report.assets, 1);
  await assert.rejects(checkDeployment(async () => new Response('', { status: 503 })));
  await assert.rejects(
    checkDeployment(async () => new Response('<h1>Broken</h1><link href="/wrong.css">')),
  );
});
test('publishing accepts only main and the exact UUID dispatch contract', () => {
  assert.equal(buildIdentity('repository_dispatch', event, env), id);
  for (const name of ['push', 'workflow_dispatch'])
    assert.equal(buildIdentity(name, {}, env), null);
  for (const bad of [
    { ...event, action: 'arbitrary' },
    { ...event, client_payload: { build_id: 'bad' } },
    { ...event, client_payload: { build_id: id, ref: 'malicious' } },
    { ...event, client_payload: { build_id: id, token: 'not-allowed' } },
  ])
    assert.throws(() => buildIdentity('repository_dispatch', bad, env));
  assert.throws(() => buildIdentity('pull_request', event, env));
  assert.throws(() => buildIdentity('push', {}, { ...env, GITHUB_REF: 'refs/heads/arbitrary' }));
  assert.throws(() => buildIdentity('push', {}, { ...env, GITHUB_REPOSITORY: 'another/repo' }));
});
test('callback HMAC covers the exact timestamp and bytes without a token in payload', () => {
  const secret = randomBytes(32).toString('hex');
  const body = JSON.stringify({ action: 'reconcile' });
  const headers = signBody(body, secret, 1700000000000);
  assert.equal(headers['x-build-timestamp'], '1700000000');
  assert.equal(
    headers['x-build-signature'],
    'v1=' +
      createHmac('sha256', secret)
        .update('1700000000.' + body)
        .digest('hex'),
  );
  assert(!JSON.stringify(headers).includes(secret));
  assert.throws(() => signBody(body, ''));
});
test('callback sends a bounded POST without following redirects or exposing errors', async () => {
  const secret = randomBytes(32).toString('hex');
  const url = 'https://' + 'a'.repeat(20) + '.supabase.co/functions/v1/build-status';
  let calls = 0;
  await sendSigned(url, { action: 'reconcile' }, secret, async (_input, init) => {
    calls++;
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert(init?.signal);
    assert(!String(init?.body).includes(secret));
    return new Response('{}');
  });
  assert.equal(calls, 1);
  await assert.rejects(
    sendSigned('https://attacker.example/functions/v1/build-status', {}, secret),
  );
  await assert.rejects(sendSigned(url + '?token=unsafe', {}, secret));
  await assert.rejects(
    sendSigned(url, {}, secret, async () => new Response(secret, { status: 401 })),
    (error) => {
      assert(error instanceof Error && !error.message.includes(secret));
      return true;
    },
  );
});
test('workflows preserve isolation, main-only builds, final deployment and reconciliation', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
  const reconcile = readFileSync('.github/workflows/reconcile-builds.yml', 'utf8');
  assert(!ci.includes('secrets.') && !ci.includes('pull_request_target'));
  assert(ci.includes('scripts/ci-build.mjs') && ci.includes('npm run test:e2e'));
  for (const source of [ci, deploy, reconcile]) {
    for (const action of source.matchAll(/uses: (.+)/g))
      assert.match(action[1] ?? '', /^actions\/[a-z-]+@[a-f0-9]{40} # v/);
    assert(
      !source.includes('write-all') &&
        !source.includes('db push') &&
        !source.includes('service_role'),
    );
  }
  assert(deploy.includes('needs: [build, deploy]'));
  assert(deploy.includes('cancel-in-progress: false'));
  assert(reconcile.includes('workflow_run:') && reconcile.includes("cron: '*/15 * * * *'"));
  const buildStep = deploy
    .split('name: Build public snapshot and immutable media')[1]
    ?.split('- run: npm run check:static')[0];
  assert(buildStep);
  assert(!buildStep.includes('secrets.') && !buildStep.includes('HMAC'));
});
