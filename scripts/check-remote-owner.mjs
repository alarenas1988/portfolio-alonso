import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual, parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { supabaseFetch } from '../src/lib/supabase/transport.ts';
import { requireOwner } from '../src/lib/auth/owner.ts';
import { loadPublicSnapshot } from '../src/lib/content/snapshot.ts';
import { uploadPrivate, publishMedia } from '../src/lib/media/upload.ts';
import { validateBuildFile } from '../src/lib/media/validation-build.ts';
import { getMedia, updateMetadata } from '../src/lib/media/repository.ts';
import { getMediaUsage } from '../src/lib/media/usage.ts';
import { reportMediaOrphans } from '../src/lib/media/orphans.ts';
import {
  AssetInUseError,
  deleteMedia,
  privatePreview,
  replaceMedia,
} from '../src/lib/media/lifecycle.ts';

// Explicit, one-time operational smoke test. Never part of npm test or deployment.
// Auth secrets, account identity and sessions stay in memory; output is allowlisted.
if (process.argv.length !== 3 || process.argv[2] !== '--initial-deploy-checkpoint')
  throw new Error('Requires explicit --initial-deploy-checkpoint invocation.');
const root = new URL('../', import.meta.url);
const env = parseEnv(readFileSync(new URL('.env.local', root), 'utf8'));
const ref = readFileSync(new URL('supabase/.temp/project-ref', root), 'utf8').trim();
const origin = new URL(env.PUBLIC_SUPABASE_URL);
assert.ok(
  origin.protocol === 'https:' && origin.hostname === ref + '.supabase.co',
  'Project link mismatch',
);
const cli = (args) => {
  const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  });
  if (result.status !== 0) throw new Error('Administrative CLI operation failed; output withheld.');
  return JSON.parse(result.stdout);
};
const sql = (statement) => cli(['db', 'query', '--linked', '-o', 'json', statement]);
const check = (condition, name) => {
  assert.ok(condition, name);
  checks.push({ name, passed: true });
};
const ok = (result, label) => {
  if (result.error) throw new Error(label + ' failed; sensitive response withheld.');
  return result.data;
};
const queryValue = (statement) => Object.values(sql(statement).rows[0])[0];
const before = queryValue(`begin read only; select jsonb_build_object(
  'history', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'owners', (select count(*) from public.admin_profiles where role='owner' and active),
  'profiles', (select count(*) from public.admin_profiles),
  'users', (select count(*) from auth.users),
  'objects', (select count(*) from storage.objects),
  'projects', (select count(*) from public.projects),
  'posts', (select count(*) from public.posts),
  'media', (select count(*) from public.media_assets)
) as state; rollback;`);
assert.ok(
  before.history.length === 1 && before.history[0] === '20260906001900',
  'Unexpected migration history',
);
assert.ok(
  before.owners === 1 && before.profiles === 1 && before.users === 1,
  'Requires bootstrapped sole owner',
);
assert.ok(
  before.objects === 0 && before.projects === 0 && before.posts === 0 && before.media === 0,
  'This initial checkpoint requires no existing editorial content or objects',
);
const keys = cli(['projects', 'api-keys', '--project-ref', ref, '--reveal', '-o', 'json']);
const secret = keys.find((key) => key.type === 'secret')?.api_key;
assert.ok(secret?.startsWith('sb_secret_'), 'Existing administrative credential unavailable');
const makeClient = (key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) =>
  createClient(origin.href, key, {
    global: { fetch: supabaseFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const service = makeClient(secret),
  owner = makeClient(),
  anon = makeClient();
const checks = [],
  actors = [],
  assets = [],
  paths = [];
const run = randomUUID();
const ids = Object.fromEntries(
  [
    'project',
    'draft',
    'publicChild',
    'draftChild',
    'post',
    'draftPost',
    'futurePost',
    'visibleTech',
    'hiddenTech',
    'message',
    'deniedProject',
  ].map((label) => [label, randomUUID()]),
);
const fixtureUsers = [];
const evidencePath = new URL('docs/checkpoints/initial-deploy/owner-smoke.json', root);
const recoveryPath = new URL('.tools/initial-deploy/owner-fixture-cleanup.json', root);
mkdirSync(new URL('.tools/initial-deploy/', root), { recursive: true });
const saveRecovery = (complete = false) =>
  writeFileSync(
    recoveryPath,
    JSON.stringify(
      {
        run,
        ids,
        fixtureUsers,
        assets: assets.map((a) => ({ id: a.id, bucket: a.storage_bucket, path: a.storage_path })),
        paths,
        complete,
      },
      null,
      2,
    ) + '\n',
  );
const track = (asset) => {
  assets.push(asset);
  saveRecovery();
  return asset;
};
const trackPath = (bucket, path) => {
  paths.push({ bucket, path });
  saveRecovery();
  return path;
};
const privateTables = [
  'admin_profiles',
  'contact_messages',
  'analytics_events',
  'analytics_daily',
  'analytics_daily_content',
  'site_builds',
  'admin_activity',
  'media_assets',
];
const png = await sharp({ create: { width: 8, height: 6, channels: 4, background: '#22d3ee' } })
  .png()
  .toBuffer();
const file = new File([png], 'TEMP_CHECKPOINT_imagen.png', { type: 'image/png' });
const metadata = {
  altText: 'Imagen temporal de checkpoint',
  decorative: false,
  caption: 'TEMP_CHECKPOINT',
  category: 'general',
};
const options = { validate: validateBuildFile };
let failure = null,
  cleanupComplete;
try {
  const listed = ok(
    await service.auth.admin.listUsers({ page: 1, perPage: 100 }),
    'Read owner account',
  );
  check(
    listed.users.length === 1 && Boolean(listed.users[0].email_confirmed_at),
    'One confirmed definitive Auth account',
  );
  const user = listed.users[0];
  const link = ok(
    await service.auth.admin.generateLink({ type: 'magiclink', email: user.email }),
    'Generate temporary owner session',
  );
  const signedIn = ok(
    await owner.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' }),
    'Verify owner session',
  );
  check(
    Boolean(signedIn.session) && signedIn.user.id === user.id,
    'Real Auth session for definitive owner without password access',
  );
  check((await requireOwner(owner)).id === user.id, 'Owner JWT maps to active owner profile');
  for (const label of ['normal', 'inactive']) {
    const email = 'checkpoint-' + run + '-' + label + '@example.test';
    const password = randomBytes(32).toString('base64url') + 'Aa1!';
    const created = ok(
      await service.auth.admin.createUser({ email, password, email_confirm: true }),
      'Create temporary Auth fixture',
    );
    fixtureUsers.push(created.user.id);
    saveRecovery();
    const client = makeClient();
    actors.push({ label, client, id: created.user.id });
    ok(await client.auth.signInWithPassword({ email, password }), 'Fixture Auth login');
    if (label === 'inactive')
      sql(`insert into public.admin_profiles(id,display_name,role,active)
      values ('${created.user.id}','TEMP_CHECKPOINT_INACTIVE','owner',false);`);
  }
  const normal = actors.find((actor) => actor.label === 'normal');
  ok(
    await normal.client.auth.updateUser({
      data: { role: 'owner', active: true, is_admin: true, id: user.id },
    }),
    'Manipulate fixture metadata',
  );
  ok(await normal.client.auth.refreshSession(), 'Refresh manipulated fixture session');
  await assert.rejects(requireOwner(normal.client));
  check(true, 'Client-controlled user_metadata and supplied owner UUID cannot authorize');
  const past = new Date(Date.now() - 60000).toISOString();
  ok(
    await owner.from('projects').insert([
      {
        id: ids.project,
        title: 'TEMP_CHECKPOINT_PUBLIC',
        slug: 'checkpoint-' + ids.project,
        published: true,
        published_at: past,
      },
      {
        id: ids.draft,
        title: 'PRIVATE_SENTINEL_PROJECT',
        slug: 'checkpoint-' + ids.draft,
        published: false,
      },
    ]),
    'Owner creates public and draft projects',
  );
  ok(
    await owner.from('project_features').insert([
      { id: ids.publicChild, project_id: ids.project, title: 'TEMP_CHECKPOINT_PUBLIC_CHILD' },
      { id: ids.draftChild, project_id: ids.draft, title: 'PRIVATE_SENTINEL_CHILD' },
    ]),
    'Owner creates child relations',
  );
  ok(
    await owner.from('posts').insert([
      {
        id: ids.post,
        title: 'TEMP_CHECKPOINT_POST',
        slug: 'checkpoint-' + ids.post,
        status: 'published',
        published_at: past,
      },
      {
        id: ids.draftPost,
        title: 'PRIVATE_SENTINEL_DRAFT',
        slug: 'checkpoint-' + ids.draftPost,
        status: 'draft',
      },
      {
        id: ids.futurePost,
        title: 'PRIVATE_SENTINEL_FUTURE',
        slug: 'checkpoint-' + ids.futurePost,
        status: 'published',
        published_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ]),
    'Owner creates published draft and future posts',
  );
  ok(
    await owner.from('technologies').insert([
      {
        id: ids.visibleTech,
        name: 'TEMP_CHECKPOINT_VISIBLE',
        slug: 'checkpoint-' + ids.visibleTech,
        category: 'test',
        visible: true,
      },
      {
        id: ids.hiddenTech,
        name: 'PRIVATE_SENTINEL_HIDDEN',
        slug: 'checkpoint-' + ids.hiddenTech,
        category: 'test',
        visible: false,
      },
    ]),
    'Owner creates visible and hidden technologies',
  );
  ok(
    await service.from('contact_messages').insert({
      id: ids.message,
      submission_id: randomUUID(),
      name: 'TEMP_CHECKPOINT',
      email: 'checkpoint@example.test',
      subject: 'TEMP_CHECKPOINT',
      message: 'PRIVATE_SENTINEL_MESSAGE',
    }),
    'Prepare private message fixture',
  );
  const changed = ok(
    await owner
      .from('projects')
      .update({ title: 'TEMP_CHECKPOINT_UPDATED' })
      .eq('id', ids.project)
      .select('id,title'),
    'Owner updates project',
  );
  check(
    changed.length === 1 && changed[0].title === 'TEMP_CHECKPOINT_UPDATED',
    'Owner CREATE and UPDATE through actual Auth JWT',
  );
  for (const [label, client] of [['anon', anon], ...actors.map((a) => [a.label, a.client])]) {
    for (const [table, id] of [
      ['projects', ids.draft],
      ['project_features', ids.draftChild],
      ['posts', ids.draftPost],
      ['posts', ids.futurePost],
      ['technologies', ids.hiddenTech],
    ]) {
      const rows = ok(
        await client.from(table).select('id').eq('id', id),
        label + ' private editorial query',
      );
      check(rows.length === 0, label + ': hidden ' + table + ' by known UUID');
    }
    for (const table of privateTables) {
      const result = await client.from(table).select('*');
      check(
        result.error?.code === '42501' || (!result.error && result.data.length === 0),
        label + ': private read denied ' + table,
      );
    }
    const insert = await client.from('projects').insert({
      id: ids.deniedProject,
      title: 'TEMP_CHECKPOINT_DENIED',
      slug: 'checkpoint-' + ids.deniedProject,
      published: true,
      published_at: past,
    });
    check(insert.error?.code === '42501', label + ': INSERT published project rejected');
    for (const request of [
      client
        .from('projects')
        .update({ title: 'TEMP_CHECKPOINT_DENIED' })
        .eq('id', ids.project)
        .select('id'),
      client.from('projects').delete().eq('id', ids.project).select('id'),
      client
        .from('project_features')
        .update({ project_id: ids.draft })
        .eq('id', ids.publicChild)
        .select('id'),
    ]) {
      const result = await request;
      check(
        result.error?.code === '42501' || (!result.error && result.data.length === 0),
        label + ': UPDATE DELETE or foreign-key reassignment has no affected rows',
      );
    }
    const profile = await client.from('admin_profiles').insert({
      id: randomUUID(),
      display_name: 'TEMP_CHECKPOINT_DENIED',
      role: 'owner',
      active: true,
    });
    check(profile.error?.code === '42501', label + ': cannot create owner profile');
    for (const changes of [{ role: 'owner' }, { active: true }, { id: randomUUID() }]) {
      const result = await client.from('admin_profiles').update(changes).eq('id', user.id);
      check(
        result.error?.code === '42501',
        label + ': cannot change authorization attributes or identity',
      );
    }
    const privateRpc = await client.schema('private').rpc('is_portfolio_admin');
    check(Boolean(privateRpc.error), label + ': private helper unavailable through API');
    const draftView = ok(
      await client.from('public_media_assets').select('*'),
      label + ' public media view',
    );
    check(draftView.length === 0, label + ': public view does not expose private metadata');
  }
  for (const table of privateTables)
    ok(await owner.from(table).select('*'), 'Owner private read ' + table);
  check(
    ok(
      await owner.from('contact_messages').select('id').eq('id', ids.message),
      'Owner reads private fixture',
    ).length === 1,
    'Owner sees actual private message fixture',
  );
  const secondOwner = await owner
    .from('admin_profiles')
    .insert({ id: normal.id, display_name: 'TEMP_CHECKPOINT_DENIED', role: 'owner', active: true });
  check(secondOwner.error?.code === '42501', 'Owner browser cannot create another owner');
  for (const changes of [{ role: 'owner' }, { active: false }, { id: normal.id }]) {
    const result = await owner.from('admin_profiles').update(changes).eq('id', user.id);
    check(result.error?.code === '42501', 'Owner browser cannot mutate authorization attributes');
  }
  const initialSnapshot = await loadPublicSnapshot(anon);
  const normalize = (snapshot) => {
    const copy = { ...snapshot };
    delete copy.generated_at;
    return copy;
  };
  for (const [label, client] of [
    ['anon', anon],
    ['owner', owner],
    ...actors.map((a) => [a.label, a.client]),
  ]) {
    const snapshot = await loadPublicSnapshot(client);
    check(
      snapshot.projects.length === 1 &&
        snapshot.projects[0].id === ids.project &&
        snapshot.posts.length === 1 &&
        snapshot.posts[0].id === ids.post &&
        snapshot.technologies.length === 1 &&
        snapshot.technologies[0].id === ids.visibleTech,
      label + ': typed snapshot includes exact public fixture IDs',
    );
    check(
      !JSON.stringify(snapshot).includes('PRIVATE_SENTINEL'),
      label + ': snapshot excludes drafts future posts private messages and hidden technologies',
    );
    check(
      isDeepStrictEqual(normalize(snapshot), normalize(initialSnapshot)),
      label + ': public snapshot equivalent across roles',
    );
  }
  console.log('Remote Auth/RLS and snapshot checks passed; starting small Storage lifecycle.');
  const original = track((await uploadPrivate(owner, file, metadata, options)).asset);
  check(
    original.public_url === null && original.visibility === 'private',
    'Upload starts private without permanent public URL',
  );
  const listing = ok(await owner.storage.from('private').list('temporary'), 'Owner private list');
  check(
    listing.some((item) => item.id === original.storage_object_id),
    'Storage API object UUID matches registered media identity',
  );
  const signedUrl = await privatePreview(owner, original);
  const preview = await fetch(signedUrl, { signal: globalThis.AbortSignal.timeout(15000) });
  check(
    preview.ok && Buffer.from(await preview.arrayBuffer()).equals(png),
    'Short-lived signed private URL returns correct bytes',
  );
  const publicPrivate = await fetch(
    new URL('/storage/v1/object/public/private/' + original.storage_path, origin),
  );
  check(!publicPrivate.ok, 'Private bytes cannot be read through public endpoint');
  const published = track(
    (
      await publishMedia(
        owner,
        original,
        { bucket: 'portfolio-public', folder: 'general' },
        options,
      )
    ).asset,
  );
  check(
    published.storage_object_id !== original.storage_object_id &&
      published.storage_path !== original.storage_path,
    'Publication creates separate immutable Storage identity',
  );
  const publicRead = await fetch(published.public_url);
  check(
    publicRead.ok && Buffer.from(await publicRead.arrayBuffer()).equals(png),
    'Anonymous public byte download works',
  );
  for (const [label, client] of [['anon', anon], ...actors.map((a) => [a.label, a.client])]) {
    const listed = await client.storage.from('private').list('temporary');
    check(!listed.error && listed.data.length === 0, label + ': cannot list actual private object');
    check(
      Boolean((await client.storage.from('private').download(original.storage_path)).error),
      label + ': cannot download known private path',
    );
    check(
      Boolean(
        (await client.storage.from('private').createSignedUrl(original.storage_path, 60)).error,
      ),
      label + ': cannot sign private URL',
    );
    const path = trackPath('private', 'temporary/' + randomUUID() + '.png');
    check(
      Boolean(
        (await client.storage.from('private').upload(path, png, { contentType: 'image/png' }))
          .error,
      ),
      label + ': valid upload denied',
    );
    check(
      Boolean(
        (
          await client.storage
            .from('portfolio-public')
            .update(published.storage_path, png, { contentType: 'image/png' })
        ).error,
      ),
      label + ': object update denied',
    );
    check(
      Boolean(
        (
          await client.storage
            .from('portfolio-public')
            .upload(published.storage_path, png, { contentType: 'image/png', upsert: true })
        ).error,
      ),
      label + ': object upsert denied',
    );
    const movePath = trackPath('portfolio-public', 'general/' + randomUUID() + '.png');
    check(
      Boolean(
        (await client.storage.from('portfolio-public').move(published.storage_path, movePath))
          .error,
      ),
      label + ': arbitrary move denied',
    );
    await client.storage.from('portfolio-public').remove([published.storage_path]);
    check(
      (await owner.storage.from('portfolio-public').info(published.storage_path)).data?.id ===
        published.storage_object_id,
      label + ': attempted deletion preserves registered object',
    );
  }
  check(
    Boolean(
      (
        await owner.storage
          .from('portfolio-public')
          .upload(published.storage_path, png, { contentType: 'image/png', upsert: true })
      ).error,
    ),
    'Owner cannot upsert immutable bytes',
  );
  const ownerMove = trackPath('portfolio-public', 'general/' + randomUUID() + '.png');
  check(
    Boolean(
      (await owner.storage.from('portfolio-public').move(published.storage_path, ownerMove)).error,
    ),
    'Owner cannot move immutable object',
  );
  const edited = await updateMetadata(owner, published, {
    ...metadata,
    caption: 'TEMP_CHECKPOINT_EDITED',
  });
  check(edited.caption === 'TEMP_CHECKPOINT_EDITED', 'Owner updates editorial metadata');
  ok(
    await owner
      .from('projects')
      .update({
        featured_image_asset_id: edited.id,
        solution: '![Temporal](media:' + edited.id + ')',
      })
      .eq('id', ids.project),
    'Project references media',
  );
  ok(
    await owner
      .from('posts')
      .update({ content_markdown: '![Temporal](media:' + edited.id + ')' })
      .eq('id', ids.post),
    'Post references media',
  );
  check(
    (await getMediaUsage(owner, edited.id)).length === 3,
    'Project image plus project and post Markdown create three references',
  );
  await assert.rejects(deleteMedia(owner, edited), AssetInUseError);
  check(true, 'Normal delete blocked with all usages reported');
  const directDelete = await owner.storage.from('portfolio-public').remove([edited.storage_path]);
  check(
    Boolean(directDelete.error) &&
      (await owner.storage.from('portfolio-public').info(edited.storage_path)).data?.id ===
        edited.storage_object_id,
    'Storage API direct delete rejected by PK RESTRICT and object survives',
  );
  const replacement = track(
    (
      await publishMedia(
        owner,
        original,
        { bucket: 'portfolio-public', folder: 'general' },
        options,
      )
    ).asset,
  );
  await replaceMedia(owner, edited, replacement);
  check(
    (await getMediaUsage(owner, edited.id)).length === 0 &&
      (await getMediaUsage(owner, replacement.id)).length === 3,
    'Replacement atomically transfers all three references',
  );
  check(
    replacement.storage_object_id !== edited.storage_object_id &&
      !(await owner.storage.from('portfolio-public').info(edited.storage_path)).error,
    'Replacement retains previous bytes until safe retirement',
  );
  const mediaSnapshot = await loadPublicSnapshot(anon);
  check(
    mediaSnapshot.media_assets.length === 1 &&
      mediaSnapshot.media_assets[0].id === replacement.id &&
      !JSON.stringify(mediaSnapshot).includes('token='),
    'Snapshot returns only referenced public media without signed URLs',
  );
  check(
    (await deleteMedia(owner, await getMedia(owner, edited.id))).cleanup.length === 0,
    'Unlinked previous asset safely deleted via metadata then Storage API',
  );
  check(
    Boolean((await owner.storage.from('portfolio-public').info(edited.storage_path)).error),
    'Deleted object is absent from Storage API catalog',
  );
  const invalid = await owner
    .from('media_assets')
    .insert({ ...original, id: randomUUID(), storage_object_id: randomUUID() });
  check(invalid.error?.code === '23503', 'Metadata cannot register nonexistent Storage UUID');
  const orphanPath = trackPath('private', 'temporary/' + randomUUID() + '.png');
  ok(
    await owner.storage.from('private').upload(orphanPath, png, { contentType: 'image/png' }),
    'Create explicit temporary orphan',
  );
  const report = await reportMediaOrphans(owner);
  check(
    report.complete &&
      report.objectsWithoutMetadata.some((obj) => obj.path === orphanPath) &&
      report.metadataWithoutObjects.length === 0,
    'Read-only orphan report identifies unregistered object without broken metadata',
  );
  ok(await owner.storage.from('private').remove([orphanPath]), 'Remove reported fixture orphan');
  const removedProjects = ok(
    await owner.from('projects').delete().in('id', [ids.project, ids.draft]).select('id'),
    'Owner deletes project fixtures',
  );
  const removedPosts = ok(
    await owner
      .from('posts')
      .delete()
      .in('id', [ids.post, ids.draftPost, ids.futurePost])
      .select('id'),
    'Owner deletes post fixtures',
  );
  check(
    removedProjects.length === 2 && removedPosts.length === 3,
    'Owner DELETE allowed and child relations cascade',
  );
  check(
    (await getMediaUsage(owner, replacement.id)).length === 0,
    'Editorial deletion removes media references',
  );
  check(
    (await deleteMedia(owner, await getMedia(owner, replacement.id))).cleanup.length === 0,
    'Delete allowed after controlled unlink',
  );
  check(
    (await deleteMedia(owner, await getMedia(owner, original.id))).cleanup.length === 0,
    'Private source removed through controlled lifecycle',
  );
  const finalOrphans = await reportMediaOrphans(owner);
  check(
    finalOrphans.complete &&
      finalOrphans.objectsWithoutMetadata.length === 0 &&
      finalOrphans.metadataWithoutObjects.length === 0,
    'Final media orphan report is empty',
  );
  console.log(
    'Remote Storage/media lifecycle passed; removing remaining fixture records and sessions.',
  );
} catch (error) {
  // Never serialize SDK responses, tokens or user objects on failure.
  failure = error instanceof Error ? error.message : 'Remote checkpoint failed';
} finally {
  const cleanupErrors = [];
  const attempt = async (label, action) => {
    try {
      await action();
    } catch {
      cleanupErrors.push(label);
    }
  };
  await attempt('editorial fixtures', async () => {
    sql(`begin;
      delete from public.projects where id in ('${ids.project}','${ids.draft}','${ids.deniedProject}');
      delete from public.posts where id in ('${ids.post}','${ids.draftPost}','${ids.futurePost}');
      delete from public.technologies where id in ('${ids.visibleTech}','${ids.hiddenTech}');
      delete from public.contact_messages where id='${ids.message}';
      ${assets.length ? `delete from public.media_assets where id in (${assets.map((a) => "'" + a.id + "'").join(',')});` : ''}
      commit;`);
  });
  for (const obj of [
    ...assets.map((a) => ({ bucket: a.storage_bucket, path: a.storage_path })),
    ...paths,
  ])
    await attempt('fixture Storage object', async () =>
      ok(await service.storage.from(obj.bucket).remove([obj.path]), 'Cleanup Storage fixture'),
    );
  for (const actor of actors)
    await attempt('fixture session', async () =>
      ok(await actor.client.auth.signOut({ scope: 'local' }), 'Close fixture session'),
    );
  for (const id of fixtureUsers)
    await attempt('fixture Auth account', async () => {
      sql(
        `delete from public.admin_profiles where id='${id}' and display_name='TEMP_CHECKPOINT_INACTIVE' and not active;`,
      );
      ok(await service.auth.admin.deleteUser(id), 'Remove fixture Auth account');
    });
  await attempt('owner test session', async () =>
    ok(await owner.auth.signOut({ scope: 'local' }), 'Close only owner test session'),
  );
  cleanupComplete = cleanupErrors.length === 0;
  saveRecovery(cleanupComplete);
  const after = queryValue(`begin read only; select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'active_owners', (select count(*) from public.admin_profiles where role='owner' and active),
    'profiles', (select count(*) from public.admin_profiles),
    'objects', (select count(*) from storage.objects),
    'media', (select count(*) from public.media_assets),
    'references', (select count(*) from public.media_references),
    'projects', (select count(*) from public.projects),
    'posts', (select count(*) from public.posts),
    'technologies', (select count(*) from public.technologies),
    'messages', (select count(*) from public.contact_messages)
  ) as state; rollback;`);
  cleanupComplete &&=
    after.users === 1 &&
    after.active_owners === 1 &&
    after.profiles === 1 &&
    ['objects', 'media', 'references', 'projects', 'posts', 'technologies', 'messages'].every(
      (key) => after[key] === 0,
    );
  saveRecovery(cleanupComplete);
  writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        total: checks.length,
        passed: failure === null && cleanupComplete,
        failure,
        cleanup_errors: cleanupErrors,
        cleanup_complete: cleanupComplete,
        after,
        authentication:
          'Actual Supabase Auth JWTs; existing admin credential used only for Auth setup and fixture preparation/cleanup',
        owner_password_accessed_or_changed: false,
        owner_session:
          'Temporary generated email link verified in memory; local-scope signout revokes its refresh token; issued JWT expires normally',
        signed_urls_persisted: false,
      },
      null,
      2,
    ) + '\n',
  );
}
if (failure || !cleanupComplete) {
  console.log(
    'Remote checkpoint did not pass; see sanitized evidence. Cleanup complete: ' + cleanupComplete,
  );
  process.exitCode = 1;
} else
  console.log(
    'Remote owner checkpoint passed: ' +
      checks.length +
      ' checks; only definitive owner and approved seed remain.',
  );
