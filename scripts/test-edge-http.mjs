import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@supabase/server/core';
import { localStatus, localSql, prepareEdgeEnvironment } from './edge-local.mjs';
const status = localStatus(),
  env = prepareEdgeEnvironment();
const admin = createAdminClient({
  env: {
    url: status.API_URL,
    secretKeys: { default: status.SECRET_KEY },
    publishableKeys: { default: status.PUBLISHABLE_KEY },
  },
});
const users = [],
  submissions = [],
  eventIds = [],
  buildIds = [];
const checks = [];
const originalForm = localSql('select form_enabled from public.contact_settings;') === 't';
const draft = {
  name: 'Fixture local F9',
  email: 'fixture@example.test',
  subject: 'F9 LOCAL HTTP FIXTURE',
  message: 'Mensaje sintético local; no contiene datos personales.',
  honeypot: '',
};
const record = (value, name) => {
  assert.ok(value, name);
  checks.push({ name, passed: true });
};
const count = (table, column, id) =>
  Number(localSql(`select count(*) from public.${table} where ${column}='${id}';`));
const resetRates = () => localSql('delete from private.rate_limit_buckets;');
async function invoke(
  name,
  body,
  {
    origin = 'http://localhost:4321',
    key = status.PUBLISHABLE_KEY,
    headers = {},
    raw = false,
    method = 'POST',
  } = {},
) {
  const response = await fetch(`${status.API_URL}/functions/v1/${name}`, {
    method,
    headers: {
      ...(origin ? { origin } : {}),
      ...(key ? { apikey: key } : {}),
      'content-type': 'application/json',
      ...headers,
    },
    ...(method === 'POST' ? { body: raw ? body : JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  for (const secret of [
    status.SECRET_KEY,
    status.SERVICE_ROLE_KEY,
    status.JWT_SECRET,
    ...Object.values(env).filter((v) => /^[a-f0-9]{64}$/.test(v)),
  ])
    assert(!text.includes(secret), 'Response must not disclose server secrets');
  return { status: response.status, data, headers: response.headers };
}
async function contact(body = draft, id = randomUUID(), options = {}) {
  submissions.push(id);
  return invoke('contact-submit', body, {
    ...options,
    headers: {
      'idempotency-key': id,
      'x-form-started-at': String(Date.now() - 5000),
      ...options.headers,
    },
  });
}
async function callback(body, extra = {}) {
  const text = JSON.stringify(body),
    timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', env.BUILD_CALLBACK_HMAC_SECRET)
    .update(`${timestamp}.${text}`)
    .digest('hex');
  return invoke('build-status', text, {
    origin: null,
    key: null,
    raw: true,
    headers: { 'x-build-timestamp': timestamp, 'x-build-signature': 'v1=' + signature, ...extra },
  });
}
try {
  localSql('update public.contact_settings set form_enabled=true;');
  resetRates();
  let r = await invoke('contact-submit', null, {
    method: 'OPTIONS',
    key: null,
    headers: {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'apikey,content-type,idempotency-key',
    },
  });
  record(r.status === 204, 'Real preflight without credentials does not authenticate or insert');
  record(
    Number(localSql('select count(*) from private.rate_limit_buckets;')) === 0,
    'Preflight consumes no rate bucket',
  );
  for (const [options, expected, name] of [
    [{ origin: 'https://evil.example' }, 403, 'malicious origin'],
    [{ origin: null }, 403, 'missing origin'],
    [{ key: 'sb_publishable_invalid' }, 401, 'invalid API key'],
    [{ key: null }, 401, 'missing API key'],
    [
      { key: null, headers: { authorization: 'Bearer ' + status.PUBLISHABLE_KEY } },
      401,
      'publishable key is not user JWT',
    ],
  ]) {
    r = await contact(draft, randomUUID(), options);
    record(r.status === expected, 'Contact rejects ' + name);
  }
  for (const [changes, name] of [
    [{ name: '' }, 'empty name'],
    [{ email: 'invalid' }, 'email'],
    [{ subject: '' }, 'subject'],
    [{ message: 'short' }, 'short message'],
    [{ message: 'x'.repeat(5001) }, 'long message'],
    [{ role: 'owner' }, 'unknown field'],
    [{ status: 'read' }, 'client status'],
  ]) {
    record(
      (await contact({ ...draft, ...changes })).status === 400,
      'HTTP server validation: ' + name,
    );
  }
  record(
    (await invoke('contact-submit', '{', { raw: true })).status === 400,
    'Invalid JSON rejected by real Edge Runtime',
  );
  record(
    (await invoke('contact-submit', 'x'.repeat(17000), { raw: true })).status === 413,
    'Oversized real HTTP body rejected',
  );
  record(
    (await invoke('contact-submit', null, { method: 'GET' })).status === 405,
    'GET cannot create contact',
  );
  const trapped = randomUUID();
  record(
    (await contact({ ...draft, honeypot: 'filled' }, trapped)).status === 200 &&
      count('contact_messages', 'submission_id', trapped) === 0,
    'Honeypot produces generic response without message',
  );
  const unicode = randomUUID();
  record(
    (
      await contact(
        {
          ...draft,
          name: 'José Álvarez 测试',
          message: '<script>alert(1)</script> Texto de prueba Unicode.',
        },
        unicode,
      )
    ).status === 200,
    'Unicode and HTML are accepted as plain text',
  );
  record(
    localSql(`select message from public.contact_messages where submission_id='${unicode}';`) ===
      '<script>alert(1)</script> Texto de prueba Unicode.',
    'Stored message is unmodified text',
  );
  record(
    localSql(
      `select status||':'||notification_status from public.contact_messages where submission_id='${unicode}';`,
    ) === 'new:disabled',
    'Internal status and notification mode are server controlled',
  );
  resetRates();
  const duplicate = randomUUID();
  const duplicateResponses = await Promise.all(
    Array.from({ length: 8 }, () => contact(draft, duplicate)),
  );
  record(
    duplicateResponses.every((r) => r.status === 200),
    'Concurrent double submit/retry accepted',
  );
  record(
    count('contact_messages', 'submission_id', duplicate) === 1 &&
      count('analytics_events', 'event_id', duplicate) === 1,
    'Concurrent request creates one message and one conversion',
  );
  record(
    (
      await contact(
        { ...draft, message: 'Contenido diferente con longitud suficiente.' },
        duplicate,
      )
    ).status === 409,
    'Idempotency key cannot replace stored body',
  );
  resetRates();
  const burst = await Promise.all(Array.from({ length: 8 }, () => contact()));
  record(
    burst.filter((r) => r.status === 200).length === 5 &&
      burst.filter((r) => r.status === 429).length === 3,
    'Real concurrent contact rate limit is atomic: five accepted, three denied',
  );
  record(
    burst.filter((r) => r.status === 429).every((r) => r.headers.get('retry-after') === '900'),
    'Rate limit sends bounded Retry-After',
  );
  resetRates();
  const retry = randomUUID();
  localSql('revoke insert on public.contact_messages from service_role;');
  try {
    record(
      (await contact(draft, retry)).status === 503,
      'Database failure returns temporary error',
    );
  } finally {
    localSql('grant insert on public.contact_messages to service_role;');
  }
  record(
    count('contact_messages', 'submission_id', retry) === 0 &&
      count('analytics_events', 'event_id', retry) === 0,
    'Failed transaction has no partial contact/conversion',
  );
  record(
    (await contact(draft, retry)).status === 200 &&
      count('contact_messages', 'submission_id', retry) === 1,
    'Retry after database recovery persists exactly once',
  );

  for (const role of ['normal', 'inactive', 'owner']) {
    const password = randomBytes(32).toString('base64url'),
      email = `f9-${role}-${randomUUID()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert(!error && data.user, 'Local Auth fixture creation');
    users.push({ id: data.user.id, role });
    if (role !== 'normal')
      localSql(
        `insert into public.admin_profiles(id,display_name,role,active) values('${data.user.id}','F9 local fixture','owner',${role === 'owner'});`,
      );
    const client = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    assert(!login.error && login.data.session, 'Real local Auth session');
    const token = login.data.session.access_token;
    users.at(-1).token = token;
    users.at(-1).client = client;
    const response = await invoke(
      'publish-site',
      { request_id: randomUUID(), trigger_type: 'manual' },
      { headers: { authorization: 'Bearer ' + token } },
    );
    record(
      response.status === (role === 'owner' ? 503 : 403),
      `Real JWT ${role}: ${role === 'owner' ? 'authorized, dispatch safely unconfigured' : 'administration denied'}`,
    );
    const direct = await client.from('contact_messages').insert({
      submission_id: randomUUID(),
      name: draft.name,
      email: draft.email,
      subject: draft.subject,
      message: draft.message,
    });
    record(direct.error?.code === '42501', 'Direct contact insert denied: ' + role);
    if (role === 'normal') {
      await client.auth.updateUser({ data: { role: 'owner', active: true, admin: true } });
      record(
        (
          await invoke(
            'publish-site',
            { request_id: randomUUID(), trigger_type: 'manual' },
            { headers: { authorization: 'Bearer ' + token } },
          )
        ).status === 403,
        'Manipulated user_metadata does not grant owner',
      );
      const fakeProfile = await client
        .from('admin_profiles')
        .insert({ id: data.user.id, display_name: 'Attempt', role: 'owner', active: true });
      record(!!fakeProfile.error, 'Authenticated fixture cannot create owner');
    }
  }
  record(
    (await invoke('publish-site', { request_id: randomUUID(), trigger_type: 'manual' })).status ===
      401,
    'Publish rejects anonymous caller',
  );
  record(
    (
      await invoke(
        'publish-site',
        { request_id: randomUUID(), trigger_type: 'manual' },
        { headers: { authorization: 'Bearer invalid' } },
      )
    ).status === 401,
    'Publish rejects invalid JWT',
  );
  const expiredHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url',
  );
  const expiredPayload = Buffer.from(
    JSON.stringify({
      sub: users.at(-1).id,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) - 60,
      iss: status.API_URL + '/auth/v1',
    }),
  ).toString('base64url');
  const expired = `${expiredHeader}.${expiredPayload}.${createHmac('sha256', status.JWT_SECRET).update(`${expiredHeader}.${expiredPayload}`).digest('base64url')}`;
  record(
    (
      await invoke(
        'publish-site',
        { request_id: randomUUID(), trigger_type: 'manual' },
        { headers: { authorization: 'Bearer ' + expired } },
      )
    ).status === 401,
    'Publish rejects expired signed local JWT',
  );
  record(
    Number(localSql('select count(*) from public.site_builds;')) === 0,
    'Unconfigured dispatch leaves no queued build',
  );

  const owner = users.find((user) => user.role === 'owner');
  const reserved = await admin.rpc('edge_request_build', {
    p_request_id: randomUUID(),
    p_actor: owner.id,
    p_trigger: 'manual',
  });
  assert(!reserved.error && reserved.data.build_id);
  const buildId = reserved.data.build_id;
  buildIds.push(buildId);
  const cb = {
    build_id: buildId,
    status: 'building',
    run_id: 987654,
    run_attempt: 1,
    commit_sha: 'a'.repeat(40),
    started_at: new Date().toISOString(),
  };
  record(
    (await callback(cb, { 'x-build-signature': 'v1=' + '0'.repeat(64) })).status === 401,
    'Real callback rejects forged HMAC',
  );
  record(
    (await callback(cb, { 'x-build-timestamp': String(Math.floor(Date.now() / 1000) - 600) }))
      .status === 401,
    'Real callback rejects expired timestamp',
  );
  record((await callback(cb)).status === 200, 'Signed callback transitions real build to building');
  record((await callback(cb)).status === 200, 'Repeated real callback is idempotent');
  record(
    (await callback({ ...cb, run_id: 123456 })).status === 409,
    'Callback cannot hijack another run',
  );
  const success = {
    ...cb,
    status: 'success',
    completed_at: new Date().toISOString(),
    deployment_id: 'f9-fixture',
    deployment_url: 'https://alarenas1988.github.io/portfolio-alonso/',
  };
  record(
    (await callback(success)).status === 200,
    'Signed callback persists success with deployment identity',
  );
  record((await callback(success)).status === 200, 'Repeated success does not change final state');
  record((await callback(cb)).status === 409, 'Old callback cannot downgrade completed build');
  record(
    localSql(`select status from public.site_builds where id='${buildId}';`) === 'success',
    'Successful remote-style workflow state is preserved',
  );
  record(
    (await callback({ ...cb, build_id: randomUUID() })).status === 404,
    'Callback cannot create an unknown build',
  );

  resetRates();
  const session = randomUUID();
  async function event(changes = {}, options = {}) {
    const event_id = randomUUID();
    eventIds.push(event_id);
    return invoke(
      'track-event',
      {
        event_id,
        session_id: session,
        event_type: 'page_view',
        pathname: '/portfolio-alonso/',
        ...changes,
      },
      options,
    );
  }
  for (const event_type of [
    'page_view',
    'whatsapp_click',
    'email_click',
    'email_copy',
    'github_click',
    'linkedin_click',
    'cv_download',
  ])
    record((await event({ event_type })).status === 200, 'Real allowed event: ' + event_type);
  for (const change of [
    { event_type: 'unknown' },
    { email: 'fixture@example.test' },
    { properties: { name: 'PII' } },
    { pathname: '/portfolio-alonso/?email=fixture' },
    { pathname: '/portfolio-alonso/a-person/' },
    { session_id: 'not-a-uuid' },
  ])
    record(
      (await event(change)).status === 400,
      'Real event validation rejects unknown/PII payload',
    );
  record(
    (await event({ event_type: 'contact_submit' })).status === 403,
    'Browser cannot forge contact conversion',
  );
  const eventDuplicate = randomUUID();
  eventIds.push(eventDuplicate);
  const duplicateBody = {
    event_id: eventDuplicate,
    session_id: session,
    event_type: 'page_view',
    pathname: '/portfolio-alonso/',
  };
  record(
    (await invoke('track-event', duplicateBody)).status === 200 &&
      (await invoke('track-event', duplicateBody)).status === 200 &&
      count('analytics_events', 'event_id', eventDuplicate) === 1,
    'Real event idempotency',
  );
  resetRates();
  const eventBurst = await Promise.all(Array.from({ length: 63 }, () => event()));
  record(
    eventBurst.filter((r) => r.status === 200).length === 60 &&
      eventBurst.filter((r) => r.status === 429).length === 3,
    'Real analytics session limit is atomic: sixty accepted, three denied',
  );
  record(
    !localSql(
      `select coalesce(string_agg(session_hash,','),'') from public.analytics_events;`,
    ).includes(session),
    'Raw session UUID never persisted',
  );
  const anonymous = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const table of ['contact_messages', 'analytics_events', 'site_builds', 'admin_activity'])
    record(!!(await anonymous.from(table).select('*')).error, 'Anon cannot read ' + table);
  for (const user of users.filter((user) => user.role !== 'owner'))
    for (const table of ['contact_messages', 'analytics_events', 'site_builds']) {
      const response = await user.client.from(table).select('*');
      record(
        !response.error && response.data.length === 0,
        'No private rows for ' + user.role + ': ' + table,
      );
    }
  record(
    !!(await anonymous.rpc('edge_record_contact', {})).error,
    'Anonymous cannot call privileged intake RPC',
  );
  writeFileSync(
    new URL('../.tools/edge-http-results.json', import.meta.url),
    JSON.stringify({ local: true, checks }, null, 2),
  );
  console.log(
    `Edge HTTP integration: ${checks.length} checks passed against real local Runtime/Auth/PostgreSQL.`,
  );
} finally {
  localSql(
    `grant insert on public.contact_messages to service_role;update public.contact_settings set form_enabled=${originalForm};delete from private.rate_limit_buckets;`,
  );
  for (const id of new Set(submissions))
    localSql(
      `delete from public.contact_messages where submission_id='${id}';delete from public.analytics_events where event_id='${id}';`,
    );
  for (const id of eventIds)
    localSql(`delete from public.analytics_events where event_id='${id}';`);
  for (const id of buildIds)
    localSql(
      `delete from public.admin_activity where entity_id='${id}' and action='publish_requested';delete from public.site_builds where id='${id}';`,
    );
  for (const user of users) {
    localSql(`delete from public.admin_profiles where id='${user.id}';`);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    assert(!error, 'Local Auth fixture cleanup');
  }
  console.log('Local HTTP fixtures removed; contact visibility restored.');
}
