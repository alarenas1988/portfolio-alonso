import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { env, ref, cliJson, verifyProject, verifyLink, sql } from './edge-remote.mjs';
import { supabaseFetch } from '../src/lib/supabase/transport.ts';
import { resolveAdminAccess } from '../src/lib/admin/auth.ts';
import {
  saveRecord,
  getRecord,
  loadRelations,
  removeRecord,
  listRecords,
} from '../src/lib/admin/repository.ts';
import { loadAnalyticsReport, analyticsRange } from '../src/lib/analytics/queries.ts';
import { loadBuilds } from '../src/lib/admin/builds.ts';
import { uploadPrivate, publishMedia } from '../src/lib/media/upload.ts';
import { validateBuildFile } from '../src/lib/media/validation-build.ts';
import { getMedia } from '../src/lib/media/repository.ts';
import { getMediaUsage } from '../src/lib/media/usage.ts';
import { deleteMedia, replaceMedia, privatePreview } from '../src/lib/media/lifecycle.ts';
import { checkAdminStatic } from './check-admin-static.mjs';

assert.equal(process.argv[2], '--smoke-f7', 'Explicit remote fixture test required.');
verifyProject();
verifyLink();
const versions = sql(
  'begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;',
).map((r) => r.version);
assert.deepEqual(versions, [
  '20260906001900',
  '20260906002000',
  '20260906002100',
  '20260906002200',
  '20260906002300',
]);
const profiles = sql(
  'begin read only;select id,role,active,updated_at from public.admin_profiles;rollback;',
);
assert.equal(profiles.length, 1);
assert(profiles[0].active && profiles[0].role === 'owner');
const profileHash = createHash('sha256').update(JSON.stringify(profiles)).digest('hex');
const keys = cliJson(['projects', 'api-keys', '--project-ref', ref, '--reveal']);
const secret = keys.find((k) => k.type === 'secret')?.api_key;
assert(secret?.startsWith('sb_secret_'));
const make = (key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) =>
  createClient(env.PUBLIC_SUPABASE_URL, key, {
    global: {
      fetch: (input, init) => supabaseFetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const privileged = make(secret),
  owner = make(),
  anon = make(),
  normal = make();
const ok = (r, label) => {
  if (r.error) throw new Error(label + ' failed (response withheld).');
  return r.data;
};
const checks = [];
const check = (condition, name) => {
  assert(condition, name);
  checks.push({ name, passed: true });
};
const run = randomUUID(),
  ids = Object.fromEntries(
    ['project', 'post', 'experience', 'tech', 'tag'].map((n) => [n, randomUUID()]),
  ),
  assets = [];
let fixtureUser, browser, preview, ownerSession, failure;
mkdirSync('.tools/f7', { recursive: true });
const saveCleanup = () =>
  writeFileSync(
    '.tools/f7/remote-fixture-cleanup.json',
    JSON.stringify(
      {
        run,
        ids,
        fixtureUser,
        assets: assets.map((a) => ({ id: a.id, bucket: a.storage_bucket, path: a.storage_path })),
      },
      null,
      2,
    ),
  );
saveCleanup();
try {
  const user = ok(
    await privileged.auth.admin.getUserById(profiles[0].id),
    'Read existing owner',
  ).user;
  const link = ok(
    await privileged.auth.admin.generateLink({ type: 'magiclink', email: user.email }),
    'Generate temporary owner session',
  );
  ownerSession = ok(
    await owner.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' }),
    'Exchange one-time link',
  ).session;
  check(
    (await resolveAdminAccess(owner)).state === 'owner',
    'Real definitive owner Auth session and RLS profile',
  );
  check((await resolveAdminAccess(anon)).state === 'anonymous', 'Anonymous guard');
  const credentials = {
    email: 'f7-checkpoint-' + run + '@example.test',
    password: randomBytes(32).toString('base64url') + 'Aa1!',
  };
  fixtureUser = ok(
    await privileged.auth.admin.createUser({ ...credentials, email_confirm: true }),
    'Create noowner fixture',
  ).user.id;
  saveCleanup();
  ok(await normal.auth.signInWithPassword(credentials), 'Sign in noowner');
  ok(
    await normal.auth.updateUser({ data: { role: 'owner', active: true } }),
    'Forge fixture metadata',
  );
  check(
    (await resolveAdminAccess(normal)).state === 'denied',
    'Forged metadata cannot authorize noowner',
  );
  const beforeSnapshot = ok(await anon.rpc('get_public_snapshot'), 'Read public snapshot');
  const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#22d3ee' } })
    .png()
    .toBuffer();
  const uploaded = await uploadPrivate(
    owner,
    new File([png], 'F7_TEMP.png', { type: 'image/png' }),
    {
      altText: 'Temporary CMS test image',
      decorative: false,
      caption: 'F7 checkpoint temporary',
      category: 'project',
    },
    { validate: validateBuildFile },
  );
  assets.push(uploaded.asset);
  saveCleanup();
  const signed = await privatePreview(owner, uploaded.asset);
  check(
    (await fetch(signed, { signal: AbortSignal.timeout(15000) })).ok,
    'Owner private signed preview',
  );
  const copied = await publishMedia(
    owner,
    uploaded.asset,
    { bucket: 'portfolio-public', folder: 'projects' },
    { validate: validateBuildFile },
  );
  assets.push(copied.asset);
  saveCleanup();
  check(
    copied.asset.storage_object_id !== uploaded.asset.storage_object_id,
    'Public copy uses a new immutable object UUID',
  );
  const tech = await saveRecord(owner, 'technologies', ids.tech, null, {
    name: 'F7 TEMP technology',
    slug: 'f7-temp-' + run,
    category: 'Testing',
    visible: false,
    featured: false,
    sort_order: 0,
  });
  let project = await saveRecord(
    owner,
    'projects',
    ids.project,
    null,
    {
      title: 'F7 TEMP project',
      slug: 'f7-temp-' + run,
      published: false,
      featured_image_asset_id: copied.asset.id,
    },
    {
      features: [{ id: randomUUID(), title: 'Temporary feature', sort_order: 0 }],
      technologies: [{ technology_id: tech.id, sort_order: 0 }],
    },
  );
  check(
    (await loadRelations(owner, 'projects', project.id)).features.length === 1,
    'Project parent and relation persisted atomically',
  );
  const previous = project.updated_at;
  project = await saveRecord(owner, 'projects', project.id, previous, {
    subtitle: 'Controlled update',
  });
  const stale = await owner.rpc('save_project', {
    p_id: project.id,
    p_expected: previous,
    p_record: { title: 'Stale overwrite' },
  });
  check(
    stale.status === 409 && stale.error?.code === 'PT409',
    'Stale revision returns immediate HTTP 409',
  );
  const denied = await normal.rpc('save_project', {
    p_id: project.id,
    p_expected: project.updated_at,
    p_record: { published: true },
  });
  check(denied.error?.code === '42501', 'Direct noowner RPC cannot publish or alter another UUID');
  check(
    (await getMediaUsage(owner, copied.asset.id)).length > 0,
    'Referenced media reports actual editorial usage',
  );
  let blocked = false;
  try {
    await deleteMedia(owner, await getMedia(owner, copied.asset.id));
  } catch {
    blocked = true;
  }
  check(blocked, 'Deletion of media in use is blocked');
  const replacement = await publishMedia(
    owner,
    uploaded.asset,
    { bucket: 'portfolio-public', folder: 'projects' },
    { validate: validateBuildFile },
  );
  assets.push(replacement.asset);
  saveCleanup();
  await replaceMedia(owner, await getMedia(owner, copied.asset.id), replacement.asset);
  check(
    (await getRecord(owner, 'projects', project.id)).featured_image_asset_id ===
      replacement.asset.id,
    'Replacement updates references while keeping old object',
  );
  await saveRecord(owner, 'tags', ids.tag, null, { name: 'F7 TEMP tag', slug: 'f7-temp-' + run });
  const post = await saveRecord(
    owner,
    'posts',
    ids.post,
    null,
    {
      title: 'F7 TEMP post',
      slug: 'f7-temp-' + run,
      status: 'draft',
      content_markdown: '## Temporary\nNo production content.',
    },
    { tags: [{ tag_id: ids.tag }] },
  );
  check(
    (await loadRelations(owner, 'posts', post.id)).tags.length === 1,
    'Draft post and tag relation',
  );
  const experience = await saveRecord(
    owner,
    'experiences',
    ids.experience,
    null,
    {
      position: 'F7 TEMP position',
      organization: 'F7 TEMP',
      start_date: '2026-01-01',
      current: true,
      visible: false,
    },
    {
      highlights: [{ id: randomUUID(), title: 'Temporary highlight', sort_order: 0 }],
      projects: [{ project_id: project.id }],
      technologies: [{ technology_id: tech.id }],
    },
  );
  check(
    (await loadRelations(owner, 'experiences', experience.id)).highlights.length === 1,
    'Experience and three relation types',
  );
  for (const client of [anon, normal]) {
    const draft = await client.from('projects').select('id').eq('id', project.id);
    check(!draft.data?.length, 'Unauthorized direct draft lookup exposes no row');
    for (const table of [
      'contact_messages',
      'analytics_daily',
      'admin_profiles',
      'site_builds',
      'admin_activity',
    ]) {
      const data = await client.from(table).select('*').limit(1);
      check(!data.data?.length, 'Private ' + table + ' remains inaccessible');
    }
  }
  check(
    (await listRecords(owner, 'projects', { search: 'F7 TEMP' })).rows.some(
      (r) => r.id === project.id,
    ),
    'Typed paginated repository returns owner draft',
  );
  const period = analyticsRange(7);
  check(
    (await loadAnalyticsReport(owner, period.from, period.to)).timezone === 'America/Santiago',
    'Existing owner-only Analytics DTO',
  );
  check((await loadBuilds(owner)).length <= 20, 'Read-only bounded site builds');
  const afterSnapshot = ok(await anon.rpc('get_public_snapshot'), 'Read snapshot with drafts');
  delete beforeSnapshot.generated_at;
  delete afterSnapshot.generated_at;
  check(
    JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot),
    'Temporary private editorial content does not enter public snapshot',
  );
  checkAdminStatic('dist', [
    user.id,
    user.email,
    credentials.email,
    credentials.password,
    ...Object.values(ids),
  ]);
  check(true, 'Real remote private identities and fixtures absent from static build');
  // Use the existing supported Auth session in the official browser SDK. No password,
  // custom owner flag or privileged credential enters the page or its HTML.
  preview = spawn(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', '4341'],
    { windowsHide: true, stdio: 'ignore', env: { ...process.env, ASTRO_PREVIEW_BACKGROUND: '0' } },
  );
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch('http://127.0.0.1:4341/portfolio-alonso/admin/login/')).ok) break;
    } catch {
      /* Preview is still starting. */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4341/portfolio-alonso/admin/login/');
  const chunk = readdirSync('dist/_astro').find(
    (f) =>
      f.endsWith('.js') &&
      readFileSync('dist/_astro/' + f, 'utf8').includes(
        'Browser Supabase client cannot run during build.',
      ),
  );
  assert(chunk, 'Browser SDK chunk missing');
  const source = readFileSync('dist/_astro/' + chunk, 'utf8');
  const factoryName = source.match(/function ([\w$]+)\(\)\{[^{}]*Browser Supabase client/)?.[1];
  assert(factoryName, 'SDK factory declaration missing');
  const exportName = source
    .slice(source.lastIndexOf('export{'))
    .split(',')
    .map((x) => x.replace('export{', '').trim())
    .find((x) => x.startsWith(factoryName + ' as '))
    ?.split(' as ')[1]
    ?.replace(/[};].*$/, '');
  assert(exportName, 'SDK factory export missing');
  await page.evaluate(
    async ({ chunk, exportName, session }) => {
      const exports = await import('/portfolio-alonso/_astro/' + chunk);
      const factory = exports[exportName];
      if (typeof factory !== 'function') throw new Error('Browser SDK factory missing');
      const client = factory();
      const result = await client.auth.setSession(session);
      if (result.error) throw new Error('Browser session setup failed');
    },
    {
      chunk,
      exportName,
      session: {
        access_token: ownerSession.access_token,
        refresh_token: ownerSession.refresh_token,
      },
    },
  );
  await page.goto('http://127.0.0.1:4341/portfolio-alonso/admin/projects/edit/?id=' + project.id);
  await page.getByLabel('Título', { exact: true }).first().waitFor();
  check(
    (await page.getByLabel('Título', { exact: true }).first().inputValue()) === 'F7 TEMP project',
    'Browser Admin loads real remote owner draft',
  );
  await page.getByLabel('Subtítulo', { exact: true }).fill('F7 TEMP browser update');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.locator('[data-save-state="saved"]').waitFor();
  check(
    (await getRecord(owner, 'projects', project.id)).subtitle === 'F7 TEMP browser update',
    'Browser CMS save persists remotely with owner JWT',
  );
  await page.goto('http://127.0.0.1:4341/portfolio-alonso/admin/analytics/');
  await page.getByRole('heading', { name: 'Vistas por día' }).waitFor();
  check(true, 'Browser Analytics consumes real remote owner-only report');
} catch (error) {
  failure = error;
} finally {
  if (browser) await browser.close();
  if (preview) preview.kill();
  for (const [table, key] of [
    ['experiences', 'experience'],
    ['posts', 'post'],
    ['projects', 'project'],
    ['technologies', 'tech'],
    ['tags', 'tag'],
  ]) {
    const row = await getRecord(owner, table, ids[key]);
    if (row) await removeRecord(owner, table, row);
  }
  for (const asset of [...assets].reverse()) {
    const current = await getMedia(owner, asset.id);
    const result = await deleteMedia(owner, current);
    assert.equal(result.cleanup.length, 0, 'Fixture bytes cleanup incomplete');
  }
  if (fixtureUser)
    ok(await privileged.auth.admin.deleteUser(fixtureUser), 'Delete noowner fixture');
  await owner.auth.signOut({ scope: 'local' });
  await normal.auth.signOut({ scope: 'local' });
  const after = sql(
    'begin read only;select id,role,active,updated_at from public.admin_profiles;rollback;',
  );
  check(
    createHash('sha256').update(JSON.stringify(after)).digest('hex') === profileHash,
    'Definitive owner profile unchanged; no second owner',
  );
  saveCleanup();
}
const result = {
  date: new Date().toISOString(),
  checks,
  passed: !failure,
  fixtures_removed: true,
  owner_auth:
    'Existing owner, administrative one-time link exchanged in memory; no email sent or password changed',
  remote_writes:
    'Only explicitly identified temporary fixtures; no Auth configuration, tracking, seed, bucket or policy change',
};
writeFileSync('.tools/f7/remote-smoke.json', JSON.stringify(result, null, 2));
if (failure)
  throw new Error(
    'Remote CMS check failed; fixtures cleaned. ' +
      (failure instanceof Error ? failure.message : 'Unknown failure'),
  );
console.log(
  'Remote CMS smoke passed: ' + checks.length + ' checks; all identified fixtures removed.',
);
