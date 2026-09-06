import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitContact, contactSession } from '../../src/lib/contact/adapter.ts';
const draft = {
  name: 'Persona fixture',
  email: 'fixture@example.test',
  subject: 'Fixture F9',
  message: 'Contenido sintético suficiente para una prueba.',
  website: '',
};
const transport = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_fixture_not_a_real_key',
};
const attempt = { idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 4000 };
test('contact transport sends only permitted fields and a publishable apikey', async () => {
  const result = await submitContact(
    draft,
    {
      ...transport,
      fetch: async (url, init) => {
        assert.equal(String(url), 'https://example.supabase.co/functions/v1/contact-submit');
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.redirect, 'error');
        const headers = new Headers(init?.headers);
        assert.equal(headers.get('authorization'), null);
        assert.equal(headers.get('apikey'), transport.publishableKey);
        assert.equal(headers.get('idempotency-key'), attempt.idempotencyKey);
        assert.deepEqual(JSON.parse(String(init?.body)), {
          name: draft.name,
          email: draft.email,
          subject: draft.subject,
          message: draft.message,
          honeypot: '',
        });
        return Response.json({ status: 'accepted' });
      },
    },
    attempt,
  );
  assert.equal(result.status, 'success');
});
for (const status of [400, 401, 403, 409, 500, 502, 503])
  test('contact failure ' + status + ' never claims receipt', async () => {
    const before = { ...draft };
    const result = await submitContact(
      draft,
      {
        ...transport,
        fetch: async () => Response.json({ stack: 'internal sensitive details' }, { status }),
      },
      attempt,
    );
    assert.equal(result.status, 'error');
    assert(!JSON.stringify(result).includes('sensitive'));
    assert.deepEqual(draft, before);
  });
test('contact only accepts explicit receipt; rate limit has useful bounded delay', async () => {
  for (const body of [{}, null, { status: 'sent' }, '<html>oops</html>'])
    assert.equal(
      (
        await submitContact(
          draft,
          { ...transport, fetch: async () => Response.json(body) },
          attempt,
        )
      ).status,
      'error',
    );
  const limited = await submitContact(
    draft,
    {
      ...transport,
      fetch: async () => new Response(null, { status: 429, headers: { 'retry-after': '900' } }),
    },
    attempt,
  );
  assert.equal(limited.status, 'rate-limited');
  assert.equal(limited.retryAfter, 900);
});
test('contact handles offline and timeout while preserving draft', async () => {
  const offline = await submitContact(
    draft,
    {
      ...transport,
      fetch: async () => {
        throw new Error('network');
      },
    },
    attempt,
  );
  assert.equal(offline.status, 'error');
  const timed = await submitContact(
    draft,
    {
      ...transport,
      timeoutMs: 5,
      fetch: async (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('timeout'))),
        ),
    },
    attempt,
  );
  assert.equal(timed.status, 'error');
});
test('contact rejects secret keys and unsafe URLs before networking', async () => {
  for (const extra of [
    { url: 'https://user:pass@example.com' },
    { url: 'http://outside.example' },
    { url: 'javascript:alert(1)' },
    { publishableKey: 'sb_secret_fixture' },
  ]) {
    const result = await submitContact(
      draft,
      {
        ...transport,
        ...extra,
        fetch: async () => {
          assert.fail('Must not send');
        },
      },
      attempt,
    );
    assert.equal(result.status, 'error');
  }
});
test('double submit shares request, lost response retries UUID, edits allocate a new UUID', async () => {
  const keys: string[] = [];
  let release: ((value: Response) => void) | undefined;
  let next = 0;
  const session = contactSession(
    {
      ...transport,
      fetch: async (_url, init) => {
        keys.push(new Headers(init?.headers).get('idempotency-key')!);
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    },
    () => 10000,
    () => `fixture-${++next}`,
  );
  const first = session.send(draft);
  assert.equal(session.send(draft), first);
  assert.equal(keys.length, 1);
  release!(new Response(null, { status: 503 }));
  assert.equal((await first).status, 'error');
  const retry = session.send(draft);
  release!(Response.json({ status: 'accepted' }));
  assert.equal((await retry).status, 'success');
  assert.equal(keys[0], keys[1]);
  const later = session.send({ ...draft, message: draft.message + ' Editado.' });
  release!(Response.json({ status: 'accepted' }));
  await later;
  assert.notEqual(keys[1], keys[2]);
});
