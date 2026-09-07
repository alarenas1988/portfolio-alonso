import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createAdminClient } from '@supabase/server/core';
import { localStatus, localSql, prepareEdgeEnvironment } from './edge-local.mjs';
import { publishingRepository } from '../supabase/functions/_shared/publishing-repository.ts';
import { sendSigned } from './publishing/contract.mjs';

const local = localStatus(),
  env = prepareEdgeEnvironment();
const client = createAdminClient({
  env: {
    url: local.API_URL,
    secretKeys: { default: local.SECRET_KEY },
    publishableKeys: { default: local.PUBLISHABLE_KEY },
  },
});
const publishing = publishingRepository(client);
const ids = [randomUUID(), randomUUID(), randomUUID()];
const url = local.API_URL + '/functions/v1/build-status';
let checks = 0;
const check = (condition, label) => {
  assert(condition, label);
  checks++;
};
try {
  for (const id of ids) {
    const { error } = await client
      .from('site_builds')
      .insert({ id, request_id: randomUUID(), trigger_type: 'manual' });
    check(!error, 'Service may create a local synthetic build');
  }
  const first = await publishing.get(ids[0]);
  check(first?.status === 'queued', 'Queued row readable only through service/owner boundary');
  const started = new Date().toISOString();
  const base = {
    build_id: ids[0],
    run_id: 71001,
    run_attempt: 1,
    commit_sha: 'a'.repeat(40),
    started_at: started,
  };
  await sendSigned(url, { ...base, status: 'building' }, env.BUILD_CALLBACK_HMAC_SECRET);
  check(
    (await publishing.get(ids[0])).status === 'building',
    'Real HMAC HTTP callback persists building',
  );
  check(
    !(await publishing.expire(first, 'timeout')),
    'A stale observer cannot overwrite a newer callback',
  );
  const success = {
    ...base,
    status: 'success',
    completed_at: new Date().toISOString(),
    deployment_id: 'local-fixture-71001',
    deployment_url: 'https://alarenas1988.github.io/portfolio-alonso/',
  };
  await sendSigned(url, success, env.BUILD_CALLBACK_HMAC_SECRET);
  await sendSigned(url, success, env.BUILD_CALLBACK_HMAC_SECRET);
  check(
    (await publishing.get(ids[0])).status === 'success',
    'Repeated success callback is idempotent',
  );
  await assert.rejects(
    sendSigned(url, { ...base, status: 'building', run_id: 71002 }, env.BUILD_CALLBACK_HMAC_SECRET),
  );
  checks++;
  const second = await publishing.get(ids[1]);
  check(
    await publishing.expire(second, 'dispatch_missing'),
    'Verified abandoned queued row can expire',
  );
  check(
    !(await publishing.expire(second, 'dispatch_missing')),
    'Expiration compare-and-swap is idempotent',
  );
  check(
    (await publishing.get(ids[1])).failure_reason === 'dispatch_missing',
    'Safe failure reason retained',
  );
  const failed = {
    ...base,
    build_id: ids[2],
    run_id: 71003,
    status: 'failed',
    failure_reason: 'cancelled',
    completed_at: new Date().toISOString(),
  };
  await sendSigned(url, failed, env.BUILD_CALLBACK_HMAC_SECRET);
  check(
    (await publishing.get(ids[2])).status === 'failed',
    'Lost building callback still permits terminal cancellation',
  );
  check(
    !(await publishing.active()).some((row) => ids.includes(row.id)),
    'No local synthetic build remains active',
  );
  writeFileSync(
    '.tools/f11/publishing-http.json',
    JSON.stringify(
      {
        checks,
        local: true,
        actual_edge_http: true,
        github_provider: 'separately mocked in Edge tests',
        passed: true,
      },
      null,
      2,
    ),
  );
  console.log(`Publishing local: ${checks} real database/HTTP checks passed.`);
} finally {
  for (const id of ids) localSql(`delete from public.site_builds where id='${id}';`);
  console.log('Only identified publishing fixtures removed.');
}
