import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { User } from '@supabase/supabase-js';
import { createBuildSupabase } from '../../src/lib/supabase/build.ts';
import { getVerifiedUser } from '../../src/lib/auth/session.ts';
import { requireOwner } from '../../src/lib/auth/owner.ts';
import { getAuthRedirects, readRecoveryCode } from '../../src/lib/auth/redirects.ts';

const user: User = {
  id: '00000000-0000-0000-0000-000000000001',
  app_metadata: {},
  user_metadata: { role: 'owner', active: true },
  aud: 'authenticated',
  created_at: '2026-09-06T00:00:00Z',
};
function client() {
  return createBuildSupabase({
    url: 'http://127.0.0.1:55421',
    publishableKey: 'sb_publishable_test_not_a_credential',
  });
}
it('verifies identity with Auth instead of trusting the cached session', async (context) => {
  const api = client();
  let verified = 0;
  context.mock.method(api.auth, 'getUser', async () => {
    verified++;
    return { data: { user }, error: null };
  });
  context.mock.method(api.auth, 'getSession', () => {
    throw new Error('Cached session is not authority');
  });
  assert.equal((await getVerifiedUser(api)).id, user.id);
  assert.equal(verified, 1);
});
it('rejects missing or expired Auth identity without exposing server details', async (context) => {
  const api = client();
  context.mock.method(api.auth, 'getUser', async () => ({
    data: { user: null },
    error: new Error('PRIVATE_AUTH_DETAIL'),
  }));
  await assert.rejects(getVerifiedUser(api), { message: 'Authentication required.' });
});
it('client metadata cannot satisfy the owner UX guard without an authorized DB profile', async (context) => {
  const api = client();
  context.mock.method(api.auth, 'getUser', async () => ({ data: { user }, error: null }));
  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response('[]', {
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  await assert.rejects(requireOwner(api), /Portfolio owner access required/);
});
it('owner UX guard validates returned identity, role and active state', async (context) => {
  const api = client();
  context.mock.method(api.auth, 'getUser', async () => ({ data: { user }, error: null }));
  const profile = {
    id: user.id,
    display_name: 'Fixture',
    avatar_url: null,
    role: 'owner',
    active: true,
  };
  let row = profile;
  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response(JSON.stringify([row]), {
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  assert.deepEqual(await requireOwner(api), {
    id: user.id,
    displayName: 'Fixture',
    avatarUrl: null,
  });
  for (const invalid of [
    { ...profile, active: false },
    { ...profile, role: 'viewer' },
    { ...profile, id: '00000000-0000-0000-0000-000000000002' },
  ]) {
    row = invalid;
    await assert.rejects(requireOwner(api), /Portfolio owner access required/);
  }
});
it('recovery uses physical routes and preserves the Astro repository base exactly once', () => {
  assert.equal(
    getAuthRedirects('http://localhost:4321/portfolio-alonso/').recovery,
    'http://localhost:4321/portfolio-alonso/admin/reset-password/',
  );
  assert.equal(
    getAuthRedirects('https://alarenas1988.github.io/portfolio-alonso/').recovery,
    'https://alarenas1988.github.io/portfolio-alonso/admin/reset-password/',
  );
  assert.equal(
    getAuthRedirects('http://localhost:4321/').recovery,
    'http://localhost:4321/admin/reset-password/',
  );
});
it('recovery rejects external, duplicate, malformed and implicit-token callbacks', () => {
  const site = 'https://alarenas1988.github.io/portfolio-alonso/';
  const route = getAuthRedirects(site).recovery;
  assert.equal(readRecoveryCode(route + '?code=valid_code-123', site), 'valid_code-123');
  for (const url of [
    'https://evil.example/admin/reset-password/?code=x',
    route + '?code=x&code=y',
    route + '?code=',
    route + '?error=access_denied&code=x',
    route + '#access_token=not_accepted',
    route.replace('reset-password/', '') + '?code=x',
    route + '?code=has%20space',
  ])
    assert.throws(() => readRecoveryCode(url, site), /Invalid recovery callback/);
  for (const invalidSite of [
    'http://evil.example/',
    'https://user:pass@example.com/',
    'https://example.com/?redirect=evil',
  ]) {
    assert.throws(() => getAuthRedirects(invalidSite), /Invalid Auth site URL/);
  }
});
