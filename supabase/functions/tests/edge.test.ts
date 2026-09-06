// Async test doubles deliberately preserve the production Promise interface.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { contactSubmit } from '../contact-submit/handler.ts';
import { publishSite } from '../publish-site/handler.ts';
import { buildStatus } from '../build-status/handler.ts';
import { trackEvent, events } from '../track-event/handler.ts';
import { hmac, daily } from '../_shared/crypto.ts';
import { EdgeError } from '../_shared/errors.ts';
import { config as readConfig, type EdgeConfig } from '../_shared/env.ts';
import { clientSignal, userAgent } from '../_shared/privacy.ts';
import { dispatch } from '../_shared/github.ts';
import { deadline } from '../_shared/timeout.ts';
import type { Runtime } from '../_shared/runtime.ts';
import type {
  EdgeRepository,
  OperationResult,
  ContactCommand,
  EventCommand,
} from '../_shared/repository.ts';
import type { SafeLog } from '../_shared/http.ts';

const randomSecret = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const now = Date.now();
const id = crypto.randomUUID();
const owner = crypto.randomUUID();
const settings: EdgeConfig = {
  networkMode: 'local-proxy',
  origins: ['https://alarenas1988.github.io', 'http://localhost:4321'],
  siteUrl: 'https://alarenas1988.github.io/portfolio-alonso/',
  contactSecret: randomSecret(),
  analyticsSecret: randomSecret(),
  analyticsRateSecret: randomSecret(),
  callbackSecret: randomSecret(),
  githubToken: randomSecret(),
  githubOwner: 'alarenas1988',
  githubRepo: 'portfolio-alonso',
  contactGlobalLimit: 100,
};
const contact = {
  name: 'Prueba sintética',
  email: 'fixture@example.test',
  subject: 'Mensaje F9',
  message: 'Texto de prueba sin datos personales.',
  honeypot: '',
};
const publication = { request_id: id, trigger_type: 'manual' };
const tracking = {
  event_id: id,
  session_id: crypto.randomUUID(),
  event_type: 'page_view',
  pathname: '/portfolio-alonso/',
};
const callback = {
  build_id: id,
  status: 'building',
  run_id: 123,
  run_attempt: 1,
  commit_sha: 'a'.repeat(40),
  started_at: new Date(now - 1000).toISOString(),
};
function setup(overrides: Partial<Runtime> = {}, config: EdgeConfig = settings) {
  const calls: {
    contact: ContactCommand[];
    event: EventCommand[];
    dispatch: number;
    auth: number;
    notification: string[];
    failed: number;
  } = { contact: [], event: [], dispatch: 0, auth: 0, notification: [], failed: 0 };
  let outcome: OperationResult = {
    outcome: 'accepted',
    created: true,
    build_id: id,
    status: 'queued',
    dispatch: true,
  };
  const db: EdgeRepository = {
    contact: async (input) => {
      calls.contact.push(input);
      return outcome;
    },
    event: async (input) => {
      calls.event.push(input);
      return outcome;
    },
    requestBuild: async () => outcome,
    callback: async () => outcome,
    notification: async (_, status) => {
      calls.notification.push(status);
    },
    dispatchFailed: async () => {
      calls.failed++;
    },
  };
  const runtime: Runtime = {
    now: () => now,
    authorize: async (request, mode) => {
      calls.auth++;
      if (mode === 'user') {
        const auth = request.headers.get('authorization');
        if (!auth || auth === 'Bearer invalid' || auth === 'Bearer expired')
          throw new EdgeError(401, 'unauthorized');
        if (auth !== 'Bearer owner') throw new EdgeError(403, 'forbidden');
      }
      return { db, ownerId: owner };
    },
    dispatch: async () => {
      calls.dispatch++;
    },
    ...overrides,
  };
  const logs: SafeLog[] = [];
  const get = () => config;
  const log = (entry: SafeLog) => logs.push(entry);
  return {
    calls,
    logs,
    runtime,
    db,
    setOutcome: (next: OperationResult) => {
      outcome = next;
    },
    contact: contactSubmit(get, runtime, log),
    publish: publishSite(get, runtime, log),
    track: trackEvent(get, runtime, log),
    callback: buildStatus(get, runtime, log),
  };
}
function request(body: unknown, headers: Record<string, string> = {}, method = 'POST') {
  return new Request('https://edge.example.test/function', {
    method,
    headers: {
      'content-type': 'application/json',
      origin: settings.origins[0]!,
      'idempotency-key': id,
      'x-form-started-at': String(now - 4000),
      ...headers,
    },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}
async function signed(
  body: unknown = callback,
  seconds = Math.floor(now / 1000),
  secret = settings.callbackSecret,
) {
  const text = JSON.stringify(body);
  const req = request(text, {
    'x-build-timestamp': String(seconds),
    'x-build-signature': `v1=${await hmac(secret, `${seconds}.${text}`)}`,
  });
  req.headers.delete('origin');
  return req;
}
const test = (name: string, run: () => void | Promise<void>) => Deno.test(name, run);

test('contact: normalizes Unicode/email and persists text without interpreting HTML', async () => {
  const s = setup();
  const res = await s.contact(
    request({
      ...contact,
      name: '  Jose\u0301  ',
      email: 'TEST@EXAMPLE.TEST',
      message: '<script>alert(1)</script> Texto legítimo.',
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(s.calls.contact[0]?.p_name, 'José');
  assert.equal(s.calls.contact[0]?.p_email, 'test@example.test');
  assert.equal(s.calls.contact[0]?.p_message, '<script>alert(1)</script> Texto legítimo.');
  assert.match(s.calls.contact[0]!.p_origin_hash, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(s.logs).includes('example.test'));
});
for (const [name, value] of Object.entries({
  empty_name: { name: '' },
  email: { email: 'invalid' },
  header_injection: { email: 'test@example.test\r\nBcc: victim@example.test' },
  subject: { subject: 'x' },
  short_message: { message: 'short' },
  long_message: { message: 'x'.repeat(5001) },
  unknown: { status: 'read' },
  owner: { role: 'owner' },
  missing_message: { message: null },
}))
  test(`contact rejects ${name}`, async () => {
    const s = setup();
    assert.equal((await s.contact(request({ ...contact, ...value }))).status, 400);
    assert.equal(s.calls.contact.length, 0);
  });
test('honeypot gets generic acceptance without persistence, conversion or notification', async () => {
  const s = setup({
    notify: async () => {
      throw new Error('must not notify');
    },
  });
  const response = await s.contact(request({ ...contact, honeypot: 'filled' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'accepted');
  assert.equal(s.calls.contact.length, 0);
});
for (const started of [now, now - 86400001, NaN])
  test(`contact rejects invalid/minimum duration ${started}`, async () => {
    assert.equal(
      (await setup().contact(request(contact, { 'x-form-started-at': String(started) }))).status,
      400,
    );
  });
for (const [name, body, headers, status] of [
  ['non JSON', '{', {}, 400],
  ['wrong content type', '{}', { 'content-type': 'text/plain' }, 400],
  ['oversized', 'x'.repeat(16385), {}, 413],
  ['declared oversized', '{}', { 'content-length': '999999' }, 413],
  ['compressed', '{}', { 'content-encoding': 'gzip' }, 400],
  ['missing UUID', contact, { 'idempotency-key': '' }, 400],
] as const)
  test(`contact ${name}`, async () => {
    assert.equal((await setup().contact(request(body, headers))).status, status);
  });
test('wrong method does not authenticate or insert', async () => {
  const s = setup();
  assert.equal((await s.contact(request(null, {}, 'GET'))).status, 405);
  assert.equal(s.calls.auth, 0);
});
for (const [outcome, status] of [
  ['limited', 429],
  ['unavailable', 503],
  ['conflict', 409],
] as const)
  test(`contact ${outcome} response`, async () => {
    const s = setup();
    s.setOutcome({ outcome, retry_after: 900 });
    const response = await s.contact(request(contact));
    assert.equal(response.status, status);
    if (status === 429) assert.equal(response.headers.get('retry-after'), '900');
  });
test('contact DB failure returns safe retryable response without provider details or body', async () => {
  const s = setup();
  s.db.contact = async () => {
    throw new Error(`SQL internal ${contact.email} ${settings.contactSecret}`);
  };
  const response = await s.contact(request(contact));
  assert.equal(response.status, 500);
  const data = JSON.stringify(await response.json());
  assert(
    !data.includes('SQL') &&
      !data.includes(contact.email) &&
      !data.includes(settings.contactSecret),
  );
  assert.match(s.logs[0]!.request_id, /^[a-f0-9-]{36}$/);
});
test('lost response retry/duplicate does not notify twice', async () => {
  let sent = 0;
  const s = setup({
    notify: async () => {
      sent++;
    },
  });
  await s.contact(request(contact));
  s.setOutcome({ outcome: 'accepted', created: false });
  assert.equal((await s.contact(request(contact))).status, 200);
  assert.equal(sent, 1);
});
test('email failure preserves accepted message and records failed notification', async () => {
  const s = setup({
    notify: async () => {
      throw new Error('provider unavailable');
    },
  });
  assert.equal((await s.contact(request(contact))).status, 200);
  assert.equal(s.calls.contact.length, 1);
  assert.deepEqual(s.calls.notification, ['failed']);
});
test('unconfigured email marks persistence disabled', async () => {
  const s = setup();
  await s.contact(request(contact));
  assert.equal(s.calls.contact[0]?.p_notify, false);
});

for (const [identity, status] of [
  ['', 401],
  ['invalid', 401],
  ['expired', 401],
  ['normal', 403],
  ['inactive', 403],
  ['owner', 202],
] as const)
  test(`publish identity boundary ${identity || 'anon'} (real JWT verification also tested over HTTP)`, async () => {
    const s = setup();
    assert.equal(
      (
        await s.publish(
          request(publication, { authorization: identity ? `Bearer ${identity}` : '' }),
        )
      ).status,
      status,
    );
    assert.equal(s.calls.dispatch, status === 202 ? 1 : 0);
  });
test('publish ignores no client privilege metadata', async () => {
  assert.equal(
    (
      await setup().publish(
        request({ ...publication, role: 'owner' }, { authorization: 'Bearer owner' }),
      )
    ).status,
    400,
  );
});
test('publish no GitHub config fails safely before creating queued build', async () => {
  const s = setup({}, { ...settings, githubToken: '' });
  s.db.requestBuild = async () => {
    throw new Error('must not create');
  };
  assert.equal(
    (await s.publish(request(publication, { authorization: 'Bearer owner' }))).status,
    503,
  );
});
test('publish duplicate and already queued build do not redispatch', async () => {
  const s = setup();
  s.setOutcome({ outcome: 'accepted', build_id: id, status: 'queued', dispatch: false });
  const responses = await Promise.all([
    s.publish(request(publication, { authorization: 'Bearer owner' })),
    s.publish(request(publication, { authorization: 'Bearer owner' })),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [202, 202],
  );
  assert.equal(s.calls.dispatch, 0);
});
for (const status of [502, 504])
  test(`dispatch failure ${status} persists failed status`, async () => {
    const s = setup({
      dispatch: async () => {
        throw new EdgeError(status, 'temporary_failure');
      },
    });
    assert.equal(
      (await s.publish(request(publication, { authorization: 'Bearer owner' }))).status,
      status,
    );
    assert.equal(s.calls.failed, 1);
  });
test('GitHub adapter uses only configured repository and minimal build payload', async () => {
  await dispatch(settings, id, async (input, init) => {
    assert.equal(
      String(input),
      'https://api.github.com/repos/alarenas1988/portfolio-alonso/dispatches',
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      event_type: 'portfolio_publish',
      client_payload: { build_id: id },
    });
    assert.equal(init?.redirect, 'error');
    return new Response(null, { status: 204 });
  });
});
test('GitHub denied response remains private', async () => {
  await assert.rejects(
    dispatch(settings, id, async () => new Response(settings.githubToken, { status: 403 })),
    (error) =>
      error instanceof EdgeError &&
      error.status === 502 &&
      !error.message.includes(settings.githubToken),
  );
});
test('external operation deadline is enforced even for a non-responsive adapter', async () => {
  await assert.rejects(
    deadline(() => new Promise(() => {}), 5),
    (error) => error instanceof DOMException && error.name === 'TimeoutError',
  );
});
test('GitHub timeout is classified', async () => {
  await assert.rejects(
    dispatch(
      settings,
      id,
      async (_input, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('timeout', 'TimeoutError')),
          ),
        ),
      5,
    ),
    (error) => error instanceof EdgeError && error.status === 504,
  );
});

test('callback valid HMAC and exact body accepted', async () => {
  assert.equal((await setup().callback(await signed())).status, 200);
});
for (const [name, modify] of [
  ['invalid signature', (r: Request) => r.headers.set('x-build-signature', 'v1=' + '0'.repeat(64))],
  [
    'expired timestamp',
    (r: Request) => r.headers.set('x-build-timestamp', String(Math.floor(now / 1000) - 301)),
  ],
  [
    'future timestamp',
    (r: Request) => r.headers.set('x-build-timestamp', String(Math.floor(now / 1000) + 301)),
  ],
  ['missing signature', (r: Request) => r.headers.delete('x-build-signature')],
] as const)
  test(`callback rejects ${name}`, async () => {
    const s = setup();
    const r = await signed();
    modify(r);
    assert.equal((await s.callback(r)).status, 401);
    assert.equal(s.calls.auth, 0);
  });
test('callback tampered payload is rejected', async () => {
  const r = await signed();
  const changed = new Request(r.url, {
    method: 'POST',
    headers: r.headers,
    body: JSON.stringify({ ...callback, status: 'success' }),
  });
  assert.equal((await setup().callback(changed)).status, 401);
});
for (const [outcome, status] of [
  ['missing', 404],
  ['conflict', 409],
  ['invalid', 400],
] as const)
  test(`callback database ${outcome}`, async () => {
    const s = setup();
    s.setOutcome({ outcome });
    assert.equal((await s.callback(await signed())).status, status);
  });
test('callback duplicate remains idempotent', async () => {
  const s = setup();
  s.setOutcome({ outcome: 'accepted', status: 'success', duplicate: true });
  assert.equal((await s.callback(await signed())).status, 200);
});
test('callback forbids browser Origin and missing configuration', async () => {
  const r = await signed();
  r.headers.set('origin', settings.origins[0]!);
  assert.equal((await setup().callback(r)).status, 403);
  assert.equal(
    (await setup({}, { ...settings, callbackSecret: '' }).callback(await signed())).status,
    503,
  );
});
test('callback rejects arbitrary error contents and deployment URL', async () => {
  assert.equal(
    (
      await setup().callback(
        await signed({
          ...callback,
          status: 'failed',
          completed_at: new Date(now).toISOString(),
          failure_reason: 'secret details',
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await setup().callback(
        await signed({
          ...callback,
          status: 'success',
          completed_at: new Date(now).toISOString(),
          deployment_id: '123',
          deployment_url: 'https://evil.example',
        }),
      )
    ).status,
    400,
  );
});

for (const event of events)
  test(`tracking event allowlist ${event}`, async () => {
    const payload = {
      ...tracking,
      event_type: event,
      ...(['project_view', 'demo_click'].includes(event)
        ? { project_id: crypto.randomUUID(), pathname: '/portfolio-alonso/proyectos/caso/' }
        : {}),
      ...(['post_view', 'article_share'].includes(event)
        ? { post_id: crypto.randomUUID(), pathname: '/portfolio-alonso/blog/nota/' }
        : {}),
    };
    assert.equal(
      (await setup().track(request(payload))).status,
      event === 'contact_submit' ? 403 : 200,
    );
  });
for (const [name, changes] of Object.entries({
  unknown: { event_type: 'whatever' },
  pii_email: { email: 'person@example.test' },
  pii_message: { message: 'body' },
  blob: { properties: { name: 'person' } },
  invalid_uuid: { session_id: 'person' },
  query: { pathname: '/portfolio-alonso/?email=person' },
  unicode_path: { pathname: '/portfolio-alonso/José/' },
  unknown_field: { user_agent: 'raw' },
  foreign_domain: { referrer_domain: 'name@example.test' },
}))
  test(`tracking rejects ${name}`, async () => {
    const s = setup();
    assert.equal((await s.track(request({ ...tracking, ...changes }))).status, 400);
    assert.equal(s.calls.event.length, 0);
  });
test('tracking oversized and rate limited', async () => {
  const s = setup();
  assert.equal((await s.track(request('x'.repeat(4097)))).status, 413);
  s.setOutcome({ outcome: 'limited', retry_after: 60 });
  assert.equal((await s.track(request(tracking))).status, 429);
});
test('tracking stores only daily HMAC and coarse browser/referrer classifications', async () => {
  const s = setup();
  await s.track(
    request(
      { ...tracking, referrer_domain: 'private-customer.example' },
      { 'user-agent': 'extraño UA %F0%9F%98%80', 'x-forwarded-for': '192.0.2.19' },
    ),
  );
  const saved = s.calls.event[0]!;
  assert.match(saved.p_session_hash, /^[a-f0-9]{64}$/);
  assert.equal(saved.p_browser, 'other');
  assert.equal(saved.p_referrer, 'other');
  const text = JSON.stringify(saved);
  assert(
    !text.includes(tracking.session_id) &&
      !text.includes('192.0.2.19') &&
      !text.includes('Unicode'),
  );
  assert.notEqual(
    await hmac(settings.analyticsSecret, daily(now, 'session', id)),
    await hmac(settings.analyticsSecret, daily(now + 86400000, 'session', id)),
  );
});
test('HMAC matches a known SHA-256 vector and namespace/secret separation', async () => {
  const k = 'a'.repeat(32);
  const text = 'portfolio test';
  const nodeCrypto = await import('node:crypto');
  assert.equal(await hmac(k, text), nodeCrypto.createHmac('sha256', k).update(text).digest('hex'));
  assert.notEqual(
    await hmac(settings.analyticsSecret, text),
    await hmac(settings.analyticsRateSecret, text),
  );
});
test('network signal normalizes rightmost proxy IP without storing raw user agent', () => {
  assert.equal(
    clientSignal(request(contact, { 'x-forwarded-for': 'forged,192.0.2.1' })),
    '192.0.2.1',
  );
  assert.equal(clientSignal(request(contact, { 'x-forwarded-for': 'garbage' })), 'unknown');
  assert.equal(userAgent(request(contact, { 'user-agent': '' })).browser, 'unknown');
});
for (const [origin, status] of [
  ['https://alarenas1988.github.io', 204],
  ['http://localhost:4321', 204],
  ['https://evil.example', 403],
  ['https://alarenas1988.github.io/portfolio-alonso/', 403],
  ['null', 403],
] as const)
  test(`CORS preflight ${origin}`, async () => {
    const s = setup();
    const res = await s.contact(
      request(
        null,
        {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'apikey,content-type,idempotency-key',
        },
        'OPTIONS',
      ),
    );
    assert.equal(res.status, status);
    assert.equal(s.calls.auth, 0);
    if (status === 204) assert.equal(res.headers.get('access-control-allow-origin'), origin);
    else assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
test('CORS rejects absent origin and unapproved preflight headers', async () => {
  const r = request(contact);
  r.headers.delete('origin');
  assert.equal((await setup().contact(r)).status, 403);
  assert.equal(
    (
      await setup().contact(
        request(
          null,
          { 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-danger' },
          'OPTIONS',
        ),
      )
    ).status,
    400,
  );
});
test('error responses/logs expose no API key, token, secret or request body', async () => {
  const s = setup();
  const r = request('{', {
    authorization: `Bearer ${settings.githubToken}`,
    apikey: settings.contactSecret,
    'x-request-id': 'sensitive-not-a-uuid',
  });
  const response = await s.contact(r);
  const serialized = JSON.stringify({ response: await response.json(), logs: s.logs });
  for (const hidden of [
    settings.githubToken,
    settings.contactSecret,
    contact.email,
    'sensitive-not-a-uuid',
  ])
    assert(!serialized.includes(hidden));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('hosted signal uses the Cloudflare client, not rotating XFF intermediaries', () => {
  const a = request(contact, {
    'cf-connecting-ip': '192.0.2.8',
    'x-forwarded-for': 'forged,198.51.100.2',
  });
  const b = request(contact, {
    'cf-connecting-ip': '192.0.2.8',
    'x-forwarded-for': 'other,198.51.100.3',
  });
  assert.equal(clientSignal(a, 'cloudflare'), '192.0.2.8');
  assert.equal(clientSignal(a, 'cloudflare'), clientSignal(b, 'cloudflare'));
  assert.equal(clientSignal(a, 'local-proxy'), '198.51.100.2');
  assert.equal(
    readConfig((key) =>
      key === 'SUPABASE_URL' ? 'https://' + 'a'.repeat(20) + '.supabase.co' : undefined,
    ).networkMode,
    'cloudflare',
  );
});
test('missing or malformed hosted gateway signal fails closed before insertion', async () => {
  for (const raw of ['', 'not-an-ip', '192.0.2.1,192.0.2.2']) {
    const s = setup({}, { ...settings, networkMode: 'cloudflare' });
    const response = await s.contact(
      request(contact, { 'cf-connecting-ip': raw, 'x-forwarded-for': '192.0.2.20' }),
    );
    assert.equal(response.status, 503);
    assert.equal(s.calls.contact.length, 0);
  }
});
test('environment rejects wildcard origins and overbroad limits', () => {
  assert.throws(() => readConfig((key) => (key === 'PORTFOLIO_ALLOWED_ORIGINS' ? '*' : undefined)));
  assert.throws(() =>
    readConfig((key) => (key === 'CONTACT_GLOBAL_HOURLY_LIMIT' ? '10001' : undefined)),
  );
});
for (const headers of [
  { dnt: '1' },
  { 'sec-gpc': '1' },
  { 'user-agent': 'Playwright/fixture' },
  { 'user-agent': 'Googlebot/2.1' },
] as Record<string, string>[]) {
  test('privacy/bot opt-out never persists ' + JSON.stringify(headers), async () => {
    const s = setup();
    const response = await s.track(request(tracking, headers));
    assert.equal(response.status, 200);
    assert.equal(s.calls.event.length, 0);
  });
}
for (const event of ['cv_download', 'linkedin_click', 'github_click'] as const) {
  test('public detail context supports global action ' + event, async () => {
    const s = setup();
    await s.track(
      request({
        ...tracking,
        event_type: event,
        project_id: id,
        pathname: '/portfolio-alonso/proyectos/public-case/',
      }),
    );
    assert.equal(s.calls.event.length, 1);
    assert.equal(s.calls.event[0]!.p_project_id, id);
  });
}
test('same-site referrer is a category, never a full URL', async () => {
  const s = setup();
  await s.track(request({ ...tracking, referrer_domain: 'same-site' }));
  assert.equal(s.calls.event[0]!.p_referrer, 'same-site');
});
test('UTC day rotation prevents a session profile across dates', async () => {
  const first = setup();
  await first.track(request(tracking));
  const next = setup({ now: () => now + 86400000 });
  await next.track(request(tracking));
  assert.notEqual(first.calls.event[0]!.p_session_hash, next.calls.event[0]!.p_session_hash);
});
