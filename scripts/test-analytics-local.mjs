import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@supabase/server/core';
import { localStatus, localSql } from './edge-local.mjs';
import { configureLocalEdgeCors } from './configure-edge-local-cors.mjs';
import { loadAnalyticsReport, reportingToday } from '../src/lib/analytics/queries.ts';
const status = localStatus();
mkdirSync(new URL('../.tools/f10/', import.meta.url), { recursive: true });
configureLocalEdgeCors();
const admin = createAdminClient({
  env: {
    url: status.API_URL,
    secretKeys: { default: status.SECRET_KEY },
    publishableKeys: { default: status.PUBLISHABLE_KEY },
  },
});
const ids = [],
  users = [],
  project = randomUUID(),
  post = randomUUID(),
  draft = randomUUID(),
  future = randomUUID();
const checks = [];
const check = (value, name) => {
  assert(value, name);
  checks.push({ name, passed: true });
};
const today = reportingToday();
function refresh() {
  localSql('set role service_role;select public.refresh_analytics();reset role;');
}
async function event(extra = {}, session = randomUUID(), headers = {}) {
  const id = extra.event_id || randomUUID();
  ids.push(id);
  const response = await fetch(status.API_URL + '/functions/v1/track-event', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      Origin: 'http://localhost:4321',
      apikey: status.PUBLISHABLE_KEY,
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
  return { status: response.status, id };
}
const command = (id, type, path, ctx = {}) => ({
  event_id: id,
  event_type: type,
  pathname: path,
  ...ctx,
});
try {
  localSql("delete from private.rate_limit_buckets where action='analytics';");
  localSql(
    `insert into public.projects(id,title,slug,published,published_at) values('${project}','F10 HTTP','f10-http-project',true,now()-interval '1 day');insert into public.posts(id,title,slug,status,published_at) values('${post}','F10 HTTP','f10-http-post','published',now()-interval '1 day'),('${draft}','F10 Draft','f10-http-draft','draft',null),('${future}','F10 Future','f10-http-future','published',now()+interval '1 day');`,
  );
  const sameSession = randomUUID(),
    sameId = randomUUID();
  const duplicates = await Promise.all(
    Array.from({ length: 6 }, () => event({ event_id: sameId }, sameSession)),
  );
  check(
    duplicates.every((r) => r.status === 200),
    'Concurrent idempotent receipts accepted',
  );
  check(
    Number(localSql(`select count(*) from public.analytics_events where event_id='${sameId}';`)) ===
      1,
    'Concurrent duplicate creates one raw event',
  );
  const burst = Promise.all(Array.from({ length: 24 }, () => event({}, sameSession)));
  await delay(30);
  refresh();
  check(
    (await burst).every((r) => r.status === 200),
    'Concurrent independent views accepted while aggregation runs',
  );
  refresh();
  const countRaw = () =>
    Number(
      localSql(
        `select count(*) from public.analytics_events where event_id in (${[...new Set(ids)].map((id) => "'" + id + "'").join(',')});`,
      ),
    );
  check(countRaw() === 25, 'All 25 independent events persisted without losses');
  check(
    Number(localSql(`select page_views from public.analytics_daily where date='${today}';`)) === 25,
    'Recomputation reflects concurrent intake exactly',
  );
  refresh();
  check(
    Number(localSql(`select page_views from public.analytics_daily where date='${today}';`)) === 25,
    'Repeated aggregate refresh is idempotent',
  );
  for (const [type, path, ctx] of [
    ['project_view', '/portfolio-alonso/proyectos/f10-http-project/', { project_id: project }],
    ['post_view', '/portfolio-alonso/blog/f10-http-post/', { post_id: post }],
    ['demo_click', '/portfolio-alonso/proyectos/f10-http-project/', { project_id: project }],
    ['cv_download', '/portfolio-alonso/blog/f10-http-post/', { post_id: post }],
    ['linkedin_click', '/portfolio-alonso/proyectos/f10-http-project/', { project_id: project }],
    ['article_share', '/portfolio-alonso/blog/f10-http-post/', { post_id: post }],
  ])
    check(
      (await event(command(randomUUID(), type, path, ctx))).status === 200,
      'Real public context: ' + type,
    );
  for (const [id, slug] of [
    [draft, 'f10-http-draft'],
    [future, 'f10-http-future'],
    [randomUUID(), 'missing'],
  ])
    check(
      (
        await event({
          event_type: 'post_view',
          post_id: id,
          pathname: '/portfolio-alonso/blog/' + slug + '/',
        })
      ).status === 400,
      'Private/future/missing post denied: ' + slug,
    );
  check(
    (
      await event({
        event_type: 'project_view',
        project_id: project,
        pathname: '/portfolio-alonso/proyectos/wrong/',
      })
    ).status === 400,
    'Mismatched public slug rejected',
  );
  check(
    (await event({ event_type: 'contact_submit' })).status === 403,
    'Browser cannot forge contact conversion',
  );
  for (const invalid of [
    { email: 'fixture@example.test' },
    { message: 'DO_NOT_COLLECT' },
    { pathname: '/portfolio-alonso/?token=SECRET' },
    { document_url: 'https://example.test/signed?token=private' },
  ])
    check((await event(invalid)).status === 400, 'PII/unapproved property or URL rejected');
  const before = countRaw();
  for (const headers of [{ dnt: '1' }, { 'sec-gpc': '1' }, { 'User-Agent': 'Playwright/fixture' }])
    check(
      (await event({}, randomUUID(), headers)).status === 200,
      'Privacy/bot signal gets nonrevealing acknowledgement',
    );
  check(countRaw() === before, 'Opt-outs do not persist raw events');
  refresh();
  const anon = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  check(
    !!(await anon.rpc('get_analytics_report', { p_from: today, p_to: today })).error,
    'Anon cannot query report',
  );
  for (const role of ['normal', 'inactive', 'owner']) {
    const password = randomBytes(32).toString('base64url'),
      email = 'f10-' + randomUUID() + '@example.test';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert(!created.error && created.data.user);
    const id = created.data.user.id;
    users.push(id);
    if (role !== 'normal')
      localSql(
        `insert into public.admin_profiles(id,display_name,role,active) values('${id}','F10 HTTP fixture','owner',${role === 'owner'});`,
      );
    const client = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    assert(!login.error);
    const report = await client.rpc('get_analytics_report', { p_from: today, p_to: today });
    check(
      role === 'owner' ? !report.error : report.error?.code === '42501',
      'Real JWT report boundary: ' + role,
    );
    for (const table of [
      'analytics_events',
      'analytics_daily',
      'analytics_daily_content',
      'admin_analytics_daily_dimensions',
      'admin_analytics_daily_sessions',
    ]) {
      const result = await client.from(table).select('*');
      check(
        role === 'owner'
          ? !result.error && result.data.length > 0
          : !result.error && result.data.length === 0,
        'RLS ' + role + ' ' + table,
      );
    }
    if (role === 'owner') {
      const typed = await loadAnalyticsReport(client, today, today);
      check(
        typed.summary.page_views === 25 && typed.topContent.length === 2,
        'Typed owner repository reads bounded aggregates',
      );
    }
    check(!!(await client.rpc('maintain_analytics')).error, 'JWT cannot run retention: ' + role);
  }
  localSql('set role service_role;select public.maintain_analytics();reset role;');
  check(
    Number(localSql(`select popular_rank from public.posts where id='${post}';`)) === 1,
    'Popularity derives from public views',
  );
} finally {
  for (const id of [...new Set(ids)])
    localSql(`delete from public.analytics_events where event_id='${id}';`);
  for (const id of users) {
    localSql(`delete from public.admin_profiles where id='${id}';`);
    await admin.auth.admin.deleteUser(id);
  }
  localSql(
    `delete from public.projects where id='${project}';delete from public.posts where id in ('${post}','${draft}','${future}');`,
  );
  refresh();
  localSql('set role service_role;select public.maintain_analytics();reset role;');
}
writeFileSync(
  '.tools/f10/http-analytics.json',
  JSON.stringify({ local: true, checks, fixtures_removed: true }, null, 2),
);
console.log('Analytics local HTTP passed: ' + checks.length + ' checks; fixtures removed.');
