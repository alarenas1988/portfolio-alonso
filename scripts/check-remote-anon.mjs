import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { loadPublicSnapshot } from '../src/lib/content/snapshot.ts';

// Explicit operational invocation; only public credentials, never an admin session.
if (process.argv.length !== 3 || process.argv[2] !== '--initial-deploy-checkpoint') {
  throw new Error('Use --initial-deploy-checkpoint after verifying the remote deployment.');
}
const root = new URL('../', import.meta.url);
const env = parseEnv(readFileSync(new URL('.env.local', root), 'utf8'));
const origin = new URL(env.PUBLIC_SUPABASE_URL);
const ref = readFileSync(new URL('supabase/.temp/project-ref', root), 'utf8').trim();
assert.equal(origin.protocol, 'https:');
assert.equal(origin.hostname, ref + '.supabase.co');
assert.ok(env.PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'));
const client = createClient(origin.href, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const checks = [];
const record = (condition, name, evidence) => {
  assert.ok(condition, name);
  checks.push({ name, passed: true, ...(evidence ? { evidence } : {}) });
};
const snapshot = await loadPublicSnapshot(client);
record(snapshot.settings?.brand_short === 'AL', 'typed loadPublicSnapshot and public settings');
record(snapshot.categories.length === 9, 'nine public categories');
record(snapshot.specialties.length === 6, 'six public specialties');
record(snapshot.principles.length === 4, 'four public principles');
record(
  snapshot.projects.length === 0 && snapshot.posts.length === 0,
  'no invented editorial content',
);
record(snapshot.media_assets.length === 0, 'no private media in initial public snapshot');
for (const table of [
  'site_settings',
  'post_categories',
  'specialties',
  'work_principles',
  'public_contact_settings',
]) {
  const result = await client.from(table).select('*');
  record(!result.error && result.data.length > 0, 'public read: ' + table);
}
for (const table of [
  'admin_profiles',
  'contact_messages',
  'analytics_events',
  'analytics_daily',
  'analytics_daily_content',
  'site_builds',
  'admin_activity',
  'media_assets',
]) {
  const result = await client.from(table).select('*');
  record(result.error?.code === '42501', 'private table denied: ' + table, {
    code: result.error?.code,
  });
}
const id = randomUUID();
const storagePath = 'temporary/' + randomUUID() + '.png';
mkdirSync(new URL('.tools/initial-deploy/', root), { recursive: true });
writeFileSync(
  new URL('.tools/initial-deploy/anon-attempt-identities.json', root),
  JSON.stringify({ id, storagePath }),
);
for (const [name, request] of [
  [
    'INSERT published project',
    () =>
      client.from('projects').insert({
        id,
        title: 'TEMP_CHECKPOINT_DENIED',
        slug: 'checkpoint-denied-' + id,
        published: true,
        published_at: new Date().toISOString(),
      }),
  ],
  [
    'UPDATE project',
    () => client.from('projects').update({ title: 'TEMP_CHECKPOINT_DENIED' }).eq('id', id),
  ],
  ['DELETE project', () => client.from('projects').delete().eq('id', id)],
  [
    'INSERT admin profile',
    () =>
      client
        .from('admin_profiles')
        .insert({ id, display_name: 'TEMP_CHECKPOINT_DENIED', role: 'owner', active: true }),
  ],
]) {
  const result = await request();
  record(result.error?.code === '42501', name + ' denied by privilege', {
    code: result.error?.code,
  });
}
const draft = await client.from('projects').select('id').eq('published', false);
record(
  !draft.error && draft.data.length === 0,
  'draft query returns no rows (remote draft fixtures pending)',
);
const headers = { apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
for (const schema of ['public', 'private']) {
  const response = await fetch(new URL('/rest/v1/rpc/is_portfolio_admin', origin), {
    method: 'POST',
    headers: { ...headers, 'Content-Profile': schema },
    body: '{}',
    signal: globalThis.AbortSignal.timeout(15000),
  });
  record(
    response.status === (schema === 'private' ? 406 : 404),
    'private RPC unavailable through ' + schema,
    { status: response.status },
  );
}
const listing = await client.storage.from('private').list('temporary');
record(Boolean(listing.error) || listing.data.length === 0, 'private listing discloses no objects');
const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } })
  .png()
  .toBuffer();
const upload = await client.storage
  .from('private')
  .upload(storagePath, png, { contentType: 'image/png', upsert: false });
record(Boolean(upload.error), 'anonymous valid PNG upload denied', {
  status: upload.error?.statusCode,
});
writeFileSync(
  new URL('docs/checkpoints/initial-deploy/anon.json', root),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      role: 'anon',
      public_key_only: true,
      checks,
      total: checks.length,
      private_editorial_fixtures_created: false,
      limitations:
        'Draft/future/child visibility with real remote fixtures and Storage lifecycle require the owner stage; current empty queries are not that proof.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Remote anonymous API checks passed: ' +
    checks.length +
    '; snapshot validated by loadPublicSnapshot.',
);
