import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  anonymousSession,
  sessionKey,
  privacyExcluded,
  normalizedPath,
  minimalReferrer,
  payloadFor,
  createAnalyticsClient,
  externalInteraction,
  type AnalyticsOptions,
} from '../../src/lib/analytics/client.ts';
import { events, isBrowserEvent } from '../../supabase/functions/_shared/events.ts';
function store() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}
const site = 'https://example.com/portfolio-alonso/';
const project = randomUUID(),
  post = randomUUID();
function harness(extra: Partial<AnalyticsOptions> = {}) {
  const calls: RequestInit[] = [];
  const client = createAnalyticsClient({
    enabled: true,
    endpoint: 'https://example.supabase.co/functions/v1/track-event',
    publishableKey: 'sb_publishable_fixture',
    siteUrl: site,
    href: () => site,
    referrer: '',
    context: {},
    excluded: () => false,
    storage: () => store(),
    random: randomUUID,
    fetch: async (_url, init) => {
      calls.push(init!);
      return new Response('{}', { status: 200 });
    },
    ...extra,
  });
  return { client, calls };
}
for (const event of events)
  test('allowlist and payload: ' + event, () => {
    const ctx =
      event === 'project_view' || event === 'demo_click'
        ? { projectId: project }
        : event === 'post_view' || event === 'article_share'
          ? { postId: post }
          : {};
    const path = ctx.projectId ? site + 'proyectos/caso/' : ctx.postId ? site + 'blog/nota/' : site;
    const payload = payloadFor(event, path, '/portfolio-alonso/', ctx, randomUUID(), randomUUID());
    assert.equal(!!payload, event !== 'contact_submit');
    if (payload) assert.equal(payload.event_type, event);
  });
test('contact conversion cannot be sent, including unknown properties', () => {
  const { client, calls } = harness();
  client.emit('contact_submit');
  client.emit('arbitrary');
  assert.equal(calls.length, 0);
  assert.equal(isBrowserEvent('contact_submit'), false);
});
test('one page view per initialization; reload new instance; detail view once', () => {
  const h = harness({ context: { projectId: project }, href: () => site + 'proyectos/caso/' });
  h.client.start();
  h.client.start();
  assert.deepEqual(
    h.calls.map((x) => JSON.parse(String(x.body)).event_type),
    ['page_view', 'project_view'],
  );
  const reload = harness();
  reload.client.start();
  assert.equal(reload.calls.length, 1);
});
test('same Event object is deduplicated; separate real clicks retained', () => {
  const h = harness();
  const click = {};
  h.client.emit('email_click', click);
  h.client.emit('email_click', click);
  h.client.emit('email_click', {});
  assert.equal(h.calls.length, 2);
  assert.notEqual(
    JSON.parse(String(h.calls[0]!.body)).event_id,
    JSON.parse(String(h.calls[1]!.body)).event_id,
  );
});
test('payload omits all sensitive information and transport has no Authorization/cookies/referrer', () => {
  const h = harness({
    href: () => site + '?access_token=SECRET&email=someone@example.test#jwt',
    referrer: 'https://google.com/search?q=PRIVATE',
  });
  h.client.start();
  const request = h.calls[0]!;
  const text = JSON.stringify(request);
  for (const sensitive of [
    'SECRET',
    'PRIVATE',
    'access_token',
    'Authorization',
    'someone@',
    'message',
    'cookie',
    'localStorage',
  ])
    assert(!text.includes(sensitive));
  assert.equal(request.credentials, 'omit');
  assert.equal(request.keepalive, true);
  assert.equal(request.referrerPolicy, 'no-referrer');
  assert.equal(JSON.parse(String(request.body)).referrer_domain, 'google.com');
});
test('storage same tab/reload reuses UUID; new tab independent; daily rotation', () => {
  const a = store(),
    b = store();
  let now = new Date('2026-09-06T12:00:00Z');
  const session = anonymousSession(
      () => a,
      randomUUID,
      () => now,
    ),
    another = anonymousSession(
      () => b,
      randomUUID,
      () => now,
    );
  const id = session();
  assert.equal(session(), id);
  assert.equal(
    anonymousSession(
      () => a,
      randomUUID,
      () => now,
    )(),
    id,
  );
  assert.notEqual(another(), id);
  now = new Date('2026-09-07T00:00:00Z');
  assert.notEqual(session(), id);
  assert.equal(JSON.parse(a.getItem(sessionKey)!).day, '2026-09-07');
});
test('blocked, absent and corrupted storage degrade to per-document memory', () => {
  for (const access of [
    () => undefined,
    () => {
      throw new Error('denied');
    },
    () => ({
      getItem: () => '{bad',
      setItem: () => {
        throw new Error('quota');
      },
    }),
  ]) {
    const session = anonymousSession(access, randomUUID, () => new Date());
    assert.equal(session(), session());
  }
});
for (const signals of [
  { doNotTrack: '1' },
  { doNotTrack: 'yes' },
  { globalPrivacyControl: true },
  { webdriver: true },
])
  test('privacy signal disables collection ' + JSON.stringify(signals), () => {
    assert(privacyExcluded(signals));
    const h = harness({ excluded: () => privacyExcluded(signals) });
    h.client.start();
    assert.equal(h.calls.length, 0);
  });
test('disabled, preview, admin, unknown path and wrong origin never send', () => {
  for (const override of [
    { enabled: false },
    { href: () => site + 'admin/' },
    { href: () => site + 'not-approved/' },
    { href: () => site + 'blog/private/' },
    { href: () => site.replace('example.com', 'localhost') },
  ]) {
    const h = harness(override);
    h.client.start();
    h.client.emit('email_click');
    assert.equal(h.calls.length, 0);
  }
});
test('failed or throwing transport never interrupts navigation and does not retry', async () => {
  let calls = 0;
  const h = harness({
    fetch: () => {
      calls++;
      return Promise.reject(new Error('offline'));
    },
  });
  assert.doesNotThrow(() => h.client.start());
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(calls, 1);
  const throwing = harness({
    fetch: () => {
      throw new Error('blocked');
    },
  });
  assert.doesNotThrow(() => throwing.client.start());
});
test('path/referrer/ID validation and channel classification', () => {
  assert.equal(
    normalizedPath(site + 'blog/test?token=private#x', '/portfolio-alonso/'),
    '/portfolio-alonso/blog/test/',
  );
  assert.equal(normalizedPath(site + '%2fadmin/', '/portfolio-alonso/'), null);
  assert.equal(minimalReferrer(site + '?secret=x', 'https://example.com'), 'same-site');
  assert.equal(minimalReferrer('javascript:alert(1)', 'https://example.com'), undefined);
  assert.equal(
    payloadFor(
      'project_view',
      site,
      '/portfolio-alonso/',
      { projectId: 'bad' },
      randomUUID(),
      randomUUID(),
    ),
    null,
  );
  assert.equal(externalInteraction('https://github.com/x'), 'github_click');
  assert.equal(externalInteraction('https://linkedin.com/in/x'), 'linkedin_click');
  assert.equal(externalInteraction('https://wa.me/123'), 'whatsapp_click');
  assert.equal(externalInteraction('mailto:a@example.test'), 'email_click');
  assert.equal(externalInteraction('https://github.com.evil.test/x'), undefined);
  assert.equal(externalInteraction('javascript:alert(1)'), undefined);
});
