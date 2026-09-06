import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createBuildSupabase } from '../../src/lib/supabase/build.ts';
import { supabaseFetch } from '../../src/lib/supabase/transport.ts';

it('sends publishable keys only in apikey, including the SDK Storage transport', async (context) => {
  const captured: Headers[] = [];
  context.mock.method(globalThis, 'fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
    captured.push(new Headers(init?.headers));
    return Promise.resolve(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });
  const client = createBuildSupabase({
    url: 'https://project.example.com',
    publishableKey: 'sb_publishable_test_not_a_credential',
  });
  await client.storage.from('portfolio-public').list();
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.get('apikey'), 'sb_publishable_test_not_a_credential');
  assert.equal(captured[0]?.get('authorization'), null);
  const session = await client.auth.getSession();
  assert.equal(session.data.session, null);
});

it('preserves user JWTs and other request headers rather than implementing authentication', async (context) => {
  let outgoing: Headers | undefined;
  context.mock.method(globalThis, 'fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
    outgoing = new Headers(init?.headers);
    return Promise.resolve(new Response('{}'));
  });
  await supabaseFetch(
    new Request('https://project.example.com/rest/v1/', {
      headers: { apikey: 'sb_publishable_test', Authorization: 'Bearer user.jwt.token' },
    }),
    { headers: { 'X-Request-ID': 'test-request' } },
  );
  assert.equal(outgoing?.get('Authorization'), 'Bearer user.jwt.token');
  assert.equal(outgoing?.get('apikey'), 'sb_publishable_test');
  assert.equal(outgoing?.get('X-Request-ID'), 'test-request');
});
