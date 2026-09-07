import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Autosave } from '../../src/lib/admin/autosave.ts';
import { AdminError, databaseError } from '../../src/lib/admin/errors.ts';
import { suggestSlug, validateFields, safeHttps } from '../../src/lib/admin/validation.ts';
import { safeAdminReturn, readEditorId, adminRoutes } from '../../src/lib/admin/routes.ts';
import { resources } from '../../src/lib/admin/resources.ts';
import { parseRow } from '../../src/lib/admin/repository.ts';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.ts';
import { resolveAdminAccess } from '../../src/lib/admin/auth.ts';
import { requestPublication, buildLabels } from '../../src/lib/admin/builds.ts';
const site = 'https://alarenas1988.github.io/portfolio-alonso/';
test('Safe return links allow only existing physical admin pages', () => {
  for (const value of [
    'https://evil.test/',
    '//evil.test',
    '/portfolio-alonso/admin/../',
    '/portfolio-alonso/admin/%2f',
    '/other/',
    '/portfolio-alonso/admin/login/?returnTo=evil',
  ])
    assert.equal(safeAdminReturn(value, site), '/portfolio-alonso/admin/');
  assert.equal(
    safeAdminReturn(
      '/portfolio-alonso/admin/projects/edit/?id=10000000-0000-4000-8000-000000000001&token=secret',
      site,
    ),
    '/portfolio-alonso/admin/projects/edit/?id=10000000-0000-4000-8000-000000000001',
  );
  assert.equal(readEditorId('?id=wrong'), null);
  assert.equal(readEditorId('?id=x&id=x'), null);
  assert.ok(adminRoutes.includes('reset-password'));
});
test('Slug, URL, fields and temporal rules match editorial constraints', () => {
  assert.equal(suggestSlug('Solución ágil + Datos'), 'solucion-agil-datos');
  for (const url of [
    'javascript:alert(1)',
    'http://example.com',
    'https://user:password@example.com',
    'data:text/html,x',
  ])
    assert.equal(safeHttps(url), false);
  assert.equal(safeHttps('https://example.com/demo/'), true);
  assert.ok(
    validateFields({ title: 'X', slug: 'Upper', status: 'concept' }, resources.projects.fields)
      .slug,
  );
  assert.ok(
    validateFields(
      { position: 'A', organization: 'B', start_date: '2026-01-02', end_date: '2026-01-01' },
      resources.experiences.fields,
    ).end_date,
  );
  assert.ok(validateFields({ email_visible: true }, resources.contact_settings.fields).email);
  assert.ok(
    validateFields({ canonical_base: 'https://evil.test/' }, resources.site_settings.fields, site)
      .canonical_base,
  );
  assert.equal(
    Object.keys(
      validateFields(
        { value: '-70%', label: 'Reducción', sort_order: 0, visible: false },
        resources.impact_metrics.fields,
      ),
    ).length,
    0,
  );
});
test('Autosave debounces, serializes concurrent edits and never loses the last edit', async () => {
  let calls = 0,
    release: () => void = () => {};
  const events: string[] = [];
  const save = new Autosave(
    async () => {
      calls++;
      if (calls === 1)
        await new Promise<void>((r) => {
          release = r;
        });
    },
    (s) => events.push(s),
    10000,
  );
  save.change();
  save.change();
  const pending = save.flush();
  save.change();
  release();
  assert.equal(await pending, true);
  assert.equal(calls, 2);
  assert.equal(save.dirty, false);
  assert.equal(save.state, 'saved');
  save.dispose();
  assert.ok(events.includes('saving'));
});
test('Failed and conflicting saves retain dirty edits and require retry', async () => {
  let failure = true;
  const save = new Autosave(
    async () => {
      if (failure) throw new AdminError('conflict', 'Conflict');
    },
    () => {},
    10000,
  );
  save.change();
  assert.equal(await save.flush(), false);
  assert.equal(save.state, 'conflict');
  assert.equal(save.dirty, true);
  failure = false;
  assert.equal(await save.flush(), true);
  assert.equal(save.dirty, false);
  save.dispose();
});
test('Supabase errors do not expose SQL and DTO rejects nested private payloads', () => {
  assert.equal(databaseError({ code: '23505' }).kind, 'validation');
  assert.equal(databaseError({ code: '42501' }).kind, 'permission');
  assert.equal(databaseError({ code: '40001' }).kind, 'conflict');
  assert.equal(databaseError({ code: 'PT409' }).kind, 'conflict');
  assert.throws(() => parseRow({ id: 'x', updated_at: 'now', nested: { secret: 'data' } }));
  assert.equal(
    parseRow({ id: 'x', updated_at: 'now', title: '<script>x</script>' }).title,
    '<script>x</script>',
  );
});

test('Guard verifies server identity and active owner profile independently of client metadata', async () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const encoded = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  // Deliberately unsigned local fixture: the stub is the server; no credential is persisted.
  const token = [
    encoded({ alg: 'none' }),
    encoded({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }),
    'fixture',
  ].join('.');
  for (const scenario of [
    'owner',
    'missing',
    'inactive',
    'wrong-id',
    'wrong-role',
    'offline',
  ] as const) {
    const user = { id, user_metadata: { role: 'owner', active: true }, aud: 'authenticated' };
    const client = createClient<Database>('http://127.0.0.1:1', 'fixture', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input) => {
          const url = String(input);
          if (url.includes('/token'))
            return Response.json({
              access_token: token,
              refresh_token: 'fixture',
              expires_in: 3600,
              token_type: 'bearer',
              user,
            });
          if (url.includes('/user')) return Response.json({ user });
          if (scenario === 'offline') throw new TypeError('Network unavailable');
          return Response.json(
            scenario === 'missing'
              ? null
              : {
                  id: scenario === 'wrong-id' ? 'different' : id,
                  display_name: 'Fixture',
                  avatar_url: null,
                  active: scenario !== 'inactive',
                  role: scenario === 'wrong-role' ? 'viewer' : 'owner',
                },
          );
        },
      },
    });
    await client.auth.signInWithPassword({ email: 'fixture@example.test', password: 'test-only' });
    const access = await resolveAdminAccess(client);
    assert.equal(
      access.state,
      scenario === 'owner' ? 'owner' : scenario === 'offline' ? 'error' : 'denied',
      scenario,
    );
  }
  const anonymous = createClient<Database>('http://127.0.0.1:1', 'fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.equal((await resolveAdminAccess(anonymous)).state, 'anonymous');
  assert.deepEqual(await requestPublication(anonymous), { state: 'anonymous' });
  assert.deepEqual(Object.keys(buildLabels), ['queued', 'building', 'success', 'failed']);
});
