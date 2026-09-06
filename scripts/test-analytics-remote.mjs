import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadPublicSnapshot } from '../src/lib/content/snapshot.ts';
import { sql, verifyProject, verifyLink, env, cliJson, ref } from './edge-remote.mjs';
if (process.argv[2] !== '--smoke-f10')
  throw new Error(
    'Explicit --smoke-f10 required; temporary identified remote events/contact only.',
  );
verifyProject();
verifyLink();
assert.equal(
  sql('select max(version) as version from supabase_migrations.schema_migrations;')[0].version,
  '20260906002200',
);
assert.equal(
  cliJson(['functions', 'list', '--project-ref', ref]).find((f) => f.slug === 'track-event')
    ?.status,
  'ACTIVE',
);
const origin = 'https://alarenas1988.github.io';
const endpoint = new URL('/functions/v1/track-event', env.PUBLIC_SUPABASE_URL).href;
const session = randomUUID(),
  ids = new Set(),
  contactId = randomUUID(),
  checks = [];
const check = (condition, name) => {
  assert(condition, name);
  checks.push({ name, passed: true });
};
const save = () =>
  writeFileSync(
    '.tools/f10/remote-fixture-cleanup.json',
    JSON.stringify(
      { event_ids: [...ids], contact_submission: contactId, completed: false },
      null,
      2,
    ),
  );
const values = () => [...ids].map((id) => "'" + id + "'").join(',');
const refresh = () =>
  sql('begin;set local role service_role;select public.refresh_analytics();commit;');
const startDay = sql("select (now() at time zone 'America/Santiago')::date as day;")[0].day;
const beforeSnapshot = await loadPublicSnapshot(
  createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  }),
);
async function invoke(extra = {}, headers = {}) {
  const id = extra.event_id || randomUUID();
  ids.add(id);
  save();
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(25000),
    headers: {
      Origin: origin,
      apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      event_id: id,
      session_id: session,
      event_type: 'page_view',
      pathname: '/portfolio-alonso/',
      ...extra,
    }),
  });
  const body = await response.json().catch(() => null);
  return {
    status: response.status,
    body,
    cors: response.headers.get('access-control-allow-origin'),
  };
}
save();
try {
  const preflight = await fetch(endpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'apikey,content-type',
    },
    signal: AbortSignal.timeout(15000),
  });
  check(
    preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === origin,
    'Hosted preflight exact allowed origin',
  );
  check(
    (await invoke({}, { Origin: 'https://evil.example' })).status === 403,
    'Malicious origin denied',
  );
  check(
    (await invoke({}, { apikey: 'sb_publishable_invalid_fixture' })).status === 401,
    'Invalid public key denied',
  );
  const duplicate = randomUUID();
  for (let i = 0; i < 2; i++) {
    const result = await invoke({ event_id: duplicate });
    check(
      result.status === 200 && result.body?.status === 'accepted' && result.cors === origin,
      'Hosted view receipt/retry ' + i,
    );
  }
  for (const event of [
    'whatsapp_click',
    'email_click',
    'email_copy',
    'github_click',
    'linkedin_click',
    'cv_download',
  ])
    check((await invoke({ event_type: event })).status === 200, 'Hosted action ' + event);
  check(
    (await invoke({ event_type: 'contact_submit' })).status === 403,
    'Browser conversion forgery denied',
  );
  check((await invoke({ email: 'fixture@example.test' })).status === 400, 'PII field rejected');
  check(
    (await invoke({ pathname: '/portfolio-alonso/?token=do-not-store' })).status === 400,
    'Sensitive query rejected',
  );
  check(
    (
      await invoke({
        event_type: 'post_view',
        post_id: randomUUID(),
        pathname: '/portfolio-alonso/blog/missing-f10-fixture/',
      })
    ).status === 400,
    'Missing content ID rejected',
  );
  for (const headers of [
    { dnt: '1' },
    { 'sec-gpc': '1' },
    { 'User-Agent': 'Playwright/F10-fixture' },
  ])
    check((await invoke({}, headers)).status === 200, 'Privacy/bot signal safely omitted');
  let row = sql(
    `select count(*)::int as count from public.analytics_events where event_id in (${values()});`,
  )[0];
  check(row.count === 7, 'Only one view and six actions persisted; no opt-out, PII or duplicates');
  // Contact conversion remains the unchanged F9 transaction; retry makes one conversion.
  const contactEndpoint = new URL('/functions/v1/contact-submit', env.PUBLIC_SUPABASE_URL).href;
  for (let i = 0; i < 2; i++) {
    const response = await fetch(contactEndpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
      headers: {
        Origin: origin,
        apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': contactId,
        'X-Form-Started-At': String(Date.now() - 4000),
      },
      body: JSON.stringify({
        name: 'TEMP_F10_FIXTURE',
        email: 'fixture@example.test',
        subject: 'TEMP_F10_CONVERSION',
        message:
          'Mensaje sintético F10 para comprobar una conversión única. Se elimina al finalizar.',
        honeypot: '',
      }),
    });
    check(
      response.status === 200 && (await response.json()).status === 'accepted',
      'Unchanged contact receipt/retry ' + i,
    );
  }
  row = sql(
    `select (select count(*)::int from public.contact_messages where submission_id='${contactId}' and notification_status='disabled') as messages,(select count(*)::int from public.analytics_events where event_id='${contactId}' and event_type='contact_submit') as conversions;`,
  )[0];
  check(
    row.messages === 1 && row.conversions === 1,
    'Exactly one message and one server conversion, no email notification',
  );
  refresh();
  // Compare all counters with remaining raw, including legitimate traffic if it arrives.
  const aggregate = sql(
    `select (select page_views from public.analytics_daily where date='${startDay}') as aggregate_views,(select count(*) from public.analytics_events where event_type='page_view' and (created_at at time zone 'America/Santiago')::date='${startDay}') as raw_views,(select contact_submits from public.analytics_daily where date='${startDay}') as aggregate_contact,(select count(*) from public.analytics_events where event_type='contact_submit' and (created_at at time zone 'America/Santiago')::date='${startDay}') as raw_contact;`,
  )[0];
  check(
    Number(aggregate.aggregate_views) === Number(aggregate.raw_views) &&
      Number(aggregate.aggregate_contact) === Number(aggregate.raw_contact),
    'Hosted raw and daily aggregates agree',
  );
  const publicClient = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  for (const table of [
    'analytics_events',
    'analytics_daily',
    'analytics_daily_content',
    'admin_analytics_daily_dimensions',
    'admin_analytics_daily_sessions',
  ])
    check(!!(await publicClient.from(table).select('*')).error, 'Anon denied ' + table);
  for (const rpc of [
    'get_analytics_report',
    'maintain_analytics',
    'refresh_analytics',
    'edge_record_event',
  ])
    check(!!(await publicClient.rpc(rpc, {})).error, 'Anon cannot invoke ' + rpc);
  const afterSnapshot = await loadPublicSnapshot(publicClient);
  check(
    JSON.stringify(afterSnapshot) === JSON.stringify(beforeSnapshot),
    'Snapshot unchanged by private analytics/contact fixtures',
  );
  check(!JSON.stringify(afterSnapshot).includes('TEMP_F10'), 'No fixture PII in public snapshot');
  const rateSession = randomUUID();
  const burst = await Promise.all(
    Array.from({ length: 61 }, () => invoke({ session_id: rateSession })),
  );
  check(
    burst.some((r) => r.status === 429) &&
      burst.filter((r) => r.status === 200).length <= 60 &&
      burst.every((r) => [200, 429].includes(r.status)),
    'Hosted session rate limit bounds a deliberate 61-request fixture burst',
  );
} finally {
  // Only our exact UUIDs. Recompute affected days from remaining traffic; never blanket-delete analytics.
  sql(
    `begin;delete from public.contact_messages where submission_id='${contactId}' and subject='TEMP_F10_CONVERSION';delete from public.analytics_events where event_id in (${values() || "'00000000-0000-4000-8000-000000000000'"},'${contactId}');set local role service_role;select public.refresh_analytics('${startDay}',(now() at time zone 'America/Santiago')::date);commit;`,
  );
  const remaining = sql(
    `select (select count(*) from public.analytics_events where event_id in (${values() || "'00000000-0000-4000-8000-000000000000'"},'${contactId}'))+(select count(*) from public.contact_messages where submission_id='${contactId}') as count;`,
  )[0].count;
  assert.equal(Number(remaining), 0);
  writeFileSync(
    '.tools/f10/remote-fixture-cleanup.json',
    JSON.stringify(
      {
        completed: true,
        remaining_fixture_rows: 0,
        rate_counters: 'Left to their normal TTL; no reset',
      },
      null,
      2,
    ),
  );
}
writeFileSync(
  '.tools/f10/remote-smoke.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      checks,
      fixtures_removed: true,
      contact_version_unchanged: true,
    },
    null,
    2,
  ),
);
console.log('Remote Analytics smoke: ' + checks.length + ' checks passed; exact fixtures removed.');
