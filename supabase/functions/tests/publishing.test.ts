// Async doubles preserve the real repository/HTTP boundary.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { observePublication, reconcilePublications } from '../_shared/publishing.ts';
import { buildStatus } from '../build-status/handler.ts';
import { hmac } from '../_shared/crypto.ts';
import { config as configuration } from '../_shared/env.ts';
import type { Publication, PublishingRepository } from '../_shared/publishing-repository.ts';
import type { EdgeRepository, CallbackCommand } from '../_shared/repository.ts';
import type { Runtime } from '../_shared/runtime.ts';

const now = Date.now(),
  id = crypto.randomUUID(),
  runId = 1234;
const created = new Date(now - 120000).toISOString();
const started = new Date(now - 60000).toISOString();
const completed = new Date(now - 1000).toISOString();
const configurationValues: Record<string, string> = {
  GITHUB_FINE_GRAINED_TOKEN: crypto.randomUUID(),
  BUILD_CALLBACK_HMAC_SECRET: 'fixture-' + crypto.randomUUID(),
};
const config = configuration((name) => configurationValues[name]);
const row: Publication = {
  id,
  request_id: crypto.randomUUID(),
  trigger_type: 'manual',
  status: 'queued',
  github_run_id: null,
  github_run_attempt: null,
  github_run_url: null,
  commit_sha: null,
  started_at: null,
  completed_at: null,
  failure_reason: null,
  deployment_id: null,
  entity_type: null,
  entity_id: null,
  retry_of: null,
  content_snapshot_hash: null,
  created_at: created,
  updated_at: created,
};
const run = {
  id: runId,
  run_attempt: 1,
  repository: { full_name: 'alarenas1988/portfolio-alonso' },
  head_branch: 'main',
  path: '.github/workflows/deploy-pages.yml',
  head_sha: 'a'.repeat(40),
  event: 'repository_dispatch',
  display_title: `C2 ${id}`,
  created_at: started,
  updated_at: completed,
  status: 'in_progress',
  conclusion: null,
};

function harness(
  options: {
    run?: Record<string, unknown>;
    jobs?: Record<string, unknown>[];
    missing?: boolean;
    truncated?: boolean;
    offline?: boolean;
    badDeployment?: boolean;
  } = {},
) {
  const callbacks: CallbackCommand[] = [],
    expired: string[] = [];
  const db: EdgeRepository = {
    contact: async () => ({ outcome: 'forbidden' }),
    event: async () => ({ outcome: 'forbidden' }),
    requestBuild: async () => ({ outcome: 'forbidden' }),
    notification: async () => {},
    dispatchFailed: async () => {},
    callback: async (input) => {
      callbacks.push(input);
      return { outcome: 'accepted', status: input.p_status as 'success' | 'failed' | 'building' };
    },
  };
  let active = [row];
  const publishing: PublishingRepository = {
    get: async (value) => (value === id ? row : null),
    active: async () => active,
    expire: async (_build, reason) => {
      expired.push(reason);
      return true;
    },
  };
  const runtime: Runtime = {
    now: () => now,
    dispatch: async () => {},
    authorize: async () => ({ db, publishing }),
    githubFetch: async (input, init) => {
      if (options.offline) throw new Error('Provider unavailable');
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://api.github.com');
      assert.equal(init?.redirect, 'error');
      const current = { ...run, ...options.run };
      if (url.pathname.endsWith('/runs'))
        return Response.json({
          total_count: options.truncated ? 101 : options.missing ? 0 : 1,
          workflow_runs: options.missing ? [] : [current],
        });
      if (url.pathname.endsWith('/jobs'))
        return Response.json({ total_count: 2, jobs: options.jobs ?? [] });
      if (url.pathname.endsWith('/statuses'))
        return Response.json([
          {
            state: 'success',
            environment_url: options.badDeployment ? 'https://attacker.example/' : config.siteUrl,
            log_url: `https://github.com/alarenas1988/portfolio-alonso/actions/runs/${runId}/job/1`,
          },
        ]);
      if (url.pathname.endsWith('/deployments')) {
        assert(!new Headers(init?.headers).has('authorization'));
        return Response.json([{ id: 999, created_at: completed }]);
      }
      return Response.json(current);
    },
  };
  return {
    db,
    runtime,
    publishing,
    callbacks,
    expired,
    setActive: (value: Publication[]) => {
      active = value;
    },
  };
}

Deno.test('observer building binds only GitHub-approved run identity', async () => {
  const h = harness();
  assert.equal(
    await observePublication(row, runId, 1, 'building', h.db, config, h.runtime),
    'building',
  );
  assert.equal(h.callbacks[0]?.p_started_at, started);
  assert.equal(h.callbacks[0]?.p_run_id, runId);
});
for (const mutation of [
  { id: runId + 1 },
  { head_branch: 'malicious' },
  { head_sha: 'bad' },
  { event: 'push' },
  { path: '.github/workflows/evil.yml' },
  { display_title: 'another build' },
  { repository: { full_name: 'attacker/repo' } },
  { run_attempt: 2 },
])
  Deno.test('observer rejects untrusted run identity: ' + Object.keys(mutation)[0], async () => {
    const h = harness({ run: mutation });
    await assert.rejects(observePublication(row, runId, 1, 'building', h.db, config, h.runtime));
    assert.equal(h.callbacks.length, 0);
  });
const successfulJobs = [
  { name: 'Build approved main', conclusion: 'success' },
  {
    name: 'Deploy Pages',
    conclusion: 'success',
    completed_at: completed,
    steps: [{ name: 'Publish Pages artifact', conclusion: 'success' }],
  },
];
Deno.test(
  'success requires Pages job and matching public deployment, even if callback job failed',
  async () => {
    const h = harness({
      jobs: successfulJobs,
      run: { status: 'completed', conclusion: 'failure' },
    });
    assert.equal(
      await observePublication(row, runId, 1, 'finish', h.db, config, h.runtime),
      'success',
    );
    assert.equal(h.callbacks[0]?.p_deployment_id, '999');
  },
);
Deno.test('build success alone never marks the site deployed', async () => {
  const h = harness({ jobs: successfulJobs.slice(0, 1) });
  assert.equal(
    await observePublication(row, runId, 1, 'finish', h.db, config, h.runtime),
    'queued',
  );
  assert.equal(h.callbacks.length, 0);
});
Deno.test('wrong deployment origin leaves state untouched for retry', async () => {
  const h = harness({ jobs: successfulJobs, badDeployment: true });
  await assert.rejects(observePublication(row, runId, 1, 'finish', h.db, config, h.runtime));
  assert.equal(h.callbacks.length, 0);
});
for (const [conclusion, reason] of [
  ['cancelled', 'cancelled'],
  ['timed_out', 'timeout'],
  ['failure', 'build_failed'],
])
  Deno.test('reconciliation recovers terminal ' + conclusion, async () => {
    const h = harness({ run: { status: 'completed', conclusion } });
    assert.deepEqual(await reconcilePublications(h.db, h.publishing, config, h.runtime), {
      inspected: 1,
      settled: 1,
    });
    assert.equal(h.callbacks[0]?.p_failure_reason, reason);
  });
Deno.test('deploy failure is distinguished from build failure', async () => {
  const h = harness({
    jobs: [
      ...successfulJobs.slice(0, 1),
      { name: 'Deploy Pages', conclusion: 'failure', completed_at: completed },
    ],
    run: { status: 'completed', conclusion: 'failure' },
  });
  await reconcilePublications(h.db, h.publishing, config, h.runtime);
  assert.equal(h.callbacks[0]?.p_failure_reason, 'deploy_failed');
});
Deno.test('lost dispatch expires only after one hour and a complete GitHub scan', async () => {
  const h = harness({ missing: true });
  await reconcilePublications(h.db, h.publishing, config, h.runtime);
  assert.equal(h.expired.length, 0);
  h.setActive([{ ...row, created_at: new Date(now - 3600001).toISOString() }]);
  await reconcilePublications(h.db, h.publishing, config, h.runtime);
  assert.deepEqual(h.expired, ['dispatch_missing']);
});
for (const option of ['offline', 'truncated'] as const)
  Deno.test('GitHub ' + option + ' cannot produce false expiration', async () => {
    const h = harness({ [option]: true });
    h.setActive([{ ...row, created_at: new Date(now - 7200000).toISOString() }]);
    await assert.rejects(reconcilePublications(h.db, h.publishing, config, h.runtime));
    assert.equal(h.expired.length, 0);
    assert.equal(h.callbacks.length, 0);
  });
Deno.test(
  'new observer/reconciler require HMAC and exact fields, with no browser access',
  async () => {
    const h = harness();
    const handler = buildStatus(
      () => config,
      h.runtime,
      () => {},
    );
    async function request(payload: unknown, valid = true, origin = '') {
      const body = JSON.stringify(payload),
        timestamp = String(Math.floor(now / 1000));
      return new Request('https://edge.test/build-status', {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/json',
          'x-build-timestamp': timestamp,
          'x-build-signature':
            'v1=' +
            (valid ? await hmac(config.callbackSecret, timestamp + '.' + body) : 'a'.repeat(64)),
          ...(origin ? { origin } : {}),
        },
      });
    }
    assert.equal((await handler(await request({ action: 'reconcile' }, false))).status, 401);
    assert.equal(
      (
        await handler(
          await request({ action: 'reconcile' }, true, 'https://alarenas1988.github.io'),
        )
      ).status,
      403,
    );
    assert.equal((await handler(await request({ action: 'reconcile', sql: 'bad' }))).status, 400);
    assert.equal((await handler(await request({ action: 'reconcile' }))).status, 200);
    assert.equal(
      (
        await handler(
          await request({
            action: 'observe',
            build_id: id,
            run_id: runId,
            run_attempt: 1,
            phase: 'building',
            repository: 'alarenas1988/portfolio-alonso',
          }),
        )
      ).status,
      200,
    );
  },
);
