import { File } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '../src/lib/supabase/transport.ts';
import { uploadPrivate, publishMedia } from '../src/lib/media/upload.ts';
import { validateBuildFile } from '../src/lib/media/validation-build.ts';
import { updateMetadata, getMedia } from '../src/lib/media/repository.ts';
import { getMediaUsage } from '../src/lib/media/usage.ts';
import {
  deleteMedia,
  replaceMedia,
  privatePreview,
  registerDocument,
  activateCv,
  AssetInUseError,
} from '../src/lib/media/lifecycle.ts';
import { reportMediaOrphans } from '../src/lib/media/orphans.ts';
import { buildSnapshotAssets } from '../src/lib/media/build-assets.ts';
import { loadPublicSnapshot } from '../src/lib/content/snapshot.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const status = spawnSync(process.execPath, [cli, 'status', '--output', 'json'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
});
if (status.status !== 0) throw new Error('Start the readiness local stack.');
const local = JSON.parse(status.stdout);
if (
  local.API_URL !== 'http://127.0.0.1:57421' ||
  new URL(local.DB_URL).hostname !== '127.0.0.1' ||
  new URL(local.DB_URL).port !== '57422'
)
  throw new Error('Media tests permit only the isolated readiness local stack.');
function sql(statement) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_portfolio-alonso-readiness-local',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atq',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: statement, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error('Local media SQL failed: ' + result.stderr.replace(/DETAIL:[\s\S]*/, ''));
  return result.stdout.trim();
}
if (sql('select count(*) from public.admin_profiles;') !== '0')
  throw new Error('Media tests require a clean local seed.');
const makeClient = (transport = supabaseFetch, key = local.PUBLISHABLE_KEY) =>
  createClient(local.API_URL, key, {
    global: { fetch: transport },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const service = makeClient(supabaseFetch, local.SECRET_KEY),
  anon = makeClient(),
  actors = {};
const run = randomUUID(),
  password = randomBytes(32).toString('base64url') + 'Aa1!';
const technologyId = randomUUID();
const projectId = randomUUID(),
  postId = randomUUID();
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks++;
}
const png = await sharp({ create: { width: 64, height: 48, channels: 4, background: '#22d3ee' } })
  .png()
  .toBuffer();
const file = new File([png], 'diseño repetido.png', { type: 'image/png' });
const metadata = {
  altText: 'Diagrama local',
  decorative: false,
  caption: 'Texto conservado',
  category: 'general',
};
const options = { validate: validateBuildFile };
try {
  for (const name of ['owner', 'normal', 'inactive']) {
    const email = 'f8-' + run + '-' + name + '@example.test';
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error);
    const client = makeClient();
    const login = await client.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    actors[name] = { client, user: created.data.user, session: login.data.session };
  }
  sql(
    "insert into public.admin_profiles(id,display_name,active) values('" +
      actors.owner.user.id +
      "','Fixture',true),('" +
      actors.inactive.user.id +
      "','Fixture inactive',false);",
  );
  const owner = actors.owner.client,
    states = [];
  const original = (
    await uploadPrivate(owner, file, metadata, {
      ...options,
      onProgress: (event) => states.push(event.state),
    })
  ).asset;
  check(
    original.storage_bucket === 'private' &&
      original.visibility === 'private' &&
      original.public_url === null,
    'Upload remains private',
  );
  check(
    states.includes('uploading') && states.includes('processing') && states.at(-1) === 'complete',
    'Upload reports recoverable states',
  );
  const duplicate = (await uploadPrivate(owner, file, metadata, options)).asset;
  check(
    original.storage_object_id ===
      sql(
        `select id from storage.objects where bucket_id='private' and name='${original.storage_path}';`,
      ),
    'Media stores the UUID returned by Storage API and matching its primary key',
  );
  const absentObject = await owner
    .from('media_assets')
    .insert({ ...original, id: randomUUID(), storage_object_id: randomUUID() });
  check(absentObject.error?.code === '23503', 'Metadata cannot reference an absent Storage UUID');
  const mismatchedObject = await owner
    .from('media_assets')
    .insert({ ...original, id: randomUUID(), storage_object_id: duplicate.storage_object_id });
  check(
    mismatchedObject.error?.code === '23503',
    'Existing Storage UUID cannot be paired with a different path',
  );
  const duplicateObject = await owner
    .from('media_assets')
    .insert({ ...original, id: randomUUID() });
  check(duplicateObject.error?.code === '23505', 'One object cannot be registered twice');
  const changedIdentity = await owner
    .from('media_assets')
    .update({ storage_object_id: duplicate.storage_object_id })
    .eq('id', original.id);
  check(Boolean(changedIdentity.error), 'Owner cannot mutate registered Storage identity');
  for (let race = 0; race < 3; race++) {
    const racePath = 'temporary/' + randomUUID() + '.png';
    const allocated = await owner.storage
      .from('private')
      .upload(racePath, png, { contentType: 'image/png', upsert: false });
    assert.ifError(allocated.error);
    const [registration] = await Promise.all([
      owner
        .from('media_assets')
        .insert({
          ...original,
          id: randomUUID(),
          storage_path: racePath,
          storage_object_id: allocated.data.id,
        })
        .select()
        .single(),
      owner.storage.from('private').remove([racePath]),
    ]);
    if (registration.data) {
      assert.ifError((await owner.storage.from('private').download(racePath)).error);
      assert.ifError(
        (await owner.from('media_assets').delete().eq('id', registration.data.id)).error,
      );
    } else {
      assert.equal(
        (await owner.from('media_assets').select('id').eq('storage_object_id', allocated.data.id))
          .data?.length,
        0,
      );
    }
    assert.ifError((await owner.storage.from('private').remove([racePath])).error);
    check(
      true,
      'Concurrent registration/delete cannot leave registered metadata without its object',
    );
  }
  check(
    original.storage_path !== duplicate.storage_path,
    'Repeated Unicode filename produces different immutable UUID paths',
  );
  const signed = await privatePreview(owner, original);
  check((await fetch(signed)).ok, 'Owner signed private preview downloads real bytes');
  check(
    !(await fetch(local.API_URL + '/storage/v1/object/public/private/' + original.storage_path)).ok,
    'Private bytes have no public download',
  );
  const published = (
    await publishMedia(owner, original, { bucket: 'portfolio-public', folder: 'general' }, options)
  ).asset;
  check(
    published.visibility === 'public' && published.public_url !== null,
    'Explicit publication creates public copy',
  );
  check(
    published.storage_object_id !== original.storage_object_id &&
      published.storage_object_id ===
        sql(
          `select id from storage.objects where bucket_id='portfolio-public' and name='${published.storage_path}';`,
        ),
    'Publication registers a new Storage UUID and keeps private source identity',
  );
  check(
    Buffer.from(await (await fetch(published.public_url)).arrayBuffer()).equals(png),
    'Anonymous public download matches bytes',
  );
  for (const [name, client] of [
    ['anon', anon],
    ['normal', actors.normal.client],
    ['inactive', actors.inactive.client],
  ]) {
    const listed = await client.storage.from('private').list('temporary');
    check(!listed.error && listed.data.length === 0, name + ' cannot list private objects');
    const read = await client.storage.from('private').download(original.storage_path);
    check(Boolean(read.error), name + ' cannot download private object by known path');
    const signedResult = await client.storage
      .from('private')
      .createSignedUrl(original.storage_path, 60);
    check(Boolean(signedResult.error), name + ' cannot sign private URL');
    const upload = await client.storage
      .from('private')
      .upload('temporary/' + randomUUID() + '.png', png, { contentType: 'image/png' });
    check(Boolean(upload.error), name + ' upload denied');
    const update = await client.storage
      .from('portfolio-public')
      .update(published.storage_path, png, { contentType: 'image/png' });
    check(Boolean(update.error), name + ' update denied');
    const upsert = await client.storage
      .from('portfolio-public')
      .upload(published.storage_path, png, { contentType: 'image/png', upsert: true });
    check(Boolean(upsert.error), name + ' upsert denied');
    await client.storage.from('portfolio-public').remove([published.storage_path]);
    check(
      (await fetch(published.public_url)).ok,
      name + ' delete leaves existing public bytes intact',
    );
  }
  const ownerOverwrite = await owner.storage
    .from('portfolio-public')
    .upload(published.storage_path, png, { contentType: 'image/png', upsert: true });
  check(Boolean(ownerOverwrite.error), 'Even owner cannot overwrite immutable bytes');
  const directDelete = await owner.storage
    .from('portfolio-public')
    .remove([published.storage_path]);
  check(
    Boolean(directDelete.error) && (await fetch(published.public_url)).ok,
    'Storage API cannot bypass registered metadata FK',
  );
  for (const [mime, extension, bytes] of [
    ['image/svg+xml', 'svg', Buffer.from('<svg/>')],
    ['text/html', 'png', Buffer.from('<html/>')],
    ['image/png', 'png', Buffer.alloc(10485761)],
  ]) {
    const rejected = await owner.storage
      .from('private')
      .upload('temporary/' + randomUUID() + '.' + extension, bytes, { contentType: mime });
    check(Boolean(rejected.error), 'Bucket rejects ' + mime + ' size ' + bytes.length);
  }
  const edited = await updateMetadata(owner, published, {
    ...metadata,
    caption: 'Caption editado',
  });
  check(edited.caption === 'Caption editado', 'Owner edits editorial metadata');
  assert.ifError(
    (
      await owner.from('projects').insert({
        id: projectId,
        title: 'Media fixture',
        slug: 'f8-' + run,
        published: true,
        published_at: new Date(Date.now() - 60000).toISOString(),
        featured_image_asset_id: edited.id,
        solution: '![Diagrama](media:' + edited.id + ')',
      })
    ).error,
  );
  assert.ifError(
    (
      await owner.from('posts').insert({
        id: postId,
        title: 'Media post fixture',
        slug: 'f8-' + run,
        content_markdown: '![Diagrama](media:' + edited.id + ')',
      })
    ).error,
  );
  check(
    (await getMediaUsage(owner, edited.id)).length === 3,
    'Project, article and Markdown references are registered',
  );
  await assert.rejects(deleteMedia(owner, edited), AssetInUseError);
  checks++;
  const newer = (
    await publishMedia(owner, duplicate, { bucket: 'portfolio-public', folder: 'general' }, options)
  ).asset;
  const failedReplacement = makeClient(async (input, init) => {
    if (new Request(input, init).url.includes('/rpc/replace_media_asset'))
      return new Response('{"message":"injected local failure"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    return supabaseFetch(input, init);
  });
  assert.ifError((await failedReplacement.auth.setSession(actors.owner.session)).error);
  await assert.rejects(replaceMedia(failedReplacement, edited, newer));
  checks++;
  check(
    (await getMediaUsage(owner, edited.id)).length === 3 && (await fetch(edited.public_url)).ok,
    'Partial replacement keeps previous references and bytes valid',
  );
  await replaceMedia(owner, edited, newer);
  check(
    (await getMediaUsage(owner, edited.id)).length === 0,
    'Replacement unlinks previous references',
  );
  check(
    (await getMediaUsage(owner, newer.id)).length === 3,
    'Replacement persists all new references',
  );
  check((await fetch(edited.public_url)).ok, 'Previous bytes retained after replacement');
  const blogImage = (
    await publishMedia(owner, duplicate, { bucket: 'blog', folder: 'posts' }, options)
  ).asset;
  const logo = (
    await publishMedia(
      owner,
      duplicate,
      { bucket: 'portfolio-public', folder: 'technologies' },
      options,
    )
  ).asset;
  assert.ifError(
    (
      await owner.from('technologies').insert({
        id: technologyId,
        name: 'Media technology',
        slug: 'media-tech-' + run,
        category: 'test',
        visible: true,
        icon_asset_id: logo.id,
      })
    ).error,
  );
  assert.ifError(
    (
      await owner
        .from('posts')
        .update({
          status: 'published',
          published_at: new Date(Date.now() - 60000).toISOString(),
          featured_image_asset_id: blogImage.id,
        })
        .eq('id', postId)
    ).error,
  );
  const snapshot = await loadPublicSnapshot(anon);
  const outputDirectory = await mkdtemp(join(tmpdir(), 'portfolio-real-media-build-'));
  const map = await buildSnapshotAssets(snapshot, {
    supabaseUrl: local.API_URL,
    base: '/portfolio-alonso/',
    outputDirectory,
  });
  check(
    Object.values(map.assets).every((a) => a.src.startsWith('/portfolio-alonso/assets/media/')),
    'Real public snapshot and Storage produce local artifact paths',
  );
  check(
    Object.keys(map.assets).length === 3,
    'Snapshot pipeline includes project, blog and technology images',
  );
  await assert.rejects(
    buildSnapshotAssets(
      {
        ...snapshot,
        projects: snapshot.projects.map((project) => ({
          ...project,
          solution: '![Missing](media:10000000-0000-4000-8000-000000000099)',
        })),
      },
      { supabaseUrl: local.API_URL, base: '/', outputDirectory },
    ),
  );
  checks++;
  const manifest = await readFile(join(outputDirectory, 'assets/media/manifest.json'), 'utf8');
  check(
    !manifest.includes(local.SECRET_KEY) && !manifest.includes('token='),
    'Artifact contains no signed URLs or secrets',
  );
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const pdfFile = new File([await pdf.save()], 'CV fixture.pdf', { type: 'application/pdf' });
  const privatePdf = (
    await uploadPrivate(owner, pdfFile, { ...metadata, category: 'document' }, options)
  ).asset;
  const publicPdf = (
    await publishMedia(owner, privatePdf, { bucket: 'documents', folder: 'cv' }, options)
  ).asset;
  const firstCv = await registerDocument(owner, publicPdf, 'Local CV');
  await activateCv(owner, firstCv.id);
  const secondCv = await registerDocument(owner, publicPdf, 'Local CV next');
  await activateCv(owner, secondCv.id);
  const cvs = await owner.from('documents').select('id').eq('type', 'cv').eq('active', true);
  check(
    cvs.data?.length === 1 && cvs.data[0].id === secondCv.id,
    'CV activation is atomic and unique',
  );
  const orphanPath = 'temporary/' + randomUUID() + '.png';
  assert.ifError(
    (await owner.storage.from('private').upload(orphanPath, png, { contentType: 'image/png' }))
      .error,
  );
  check(
    (await reportMediaOrphans(owner)).objectsWithoutMetadata.some((o) => o.path === orphanPath),
    'Maintenance reports unregistered objects without deleting them',
  );
  // A transport fault after Storage upload tests compensation against real Storage.
  const failing = makeClient(async (input, init) => {
    const request = new Request(input, init);
    if (request.url.includes('/rest/v1/media_assets') && request.method === 'POST')
      return new Response('{"message":"injected local failure"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    return supabaseFetch(input, init);
  });
  assert.ifError((await failing.auth.setSession(actors.owner.session)).error);
  const before = (await reportMediaOrphans(owner)).objectsWithoutMetadata.length;
  await assert.rejects(uploadPrivate(failing, file, metadata, options));
  checks++;
  check(
    (await reportMediaOrphans(owner)).objectsWithoutMetadata.length === before,
    'Failed metadata insert compensates uploaded bytes',
  );
  const removal = await deleteMedia(owner, await getMedia(owner, edited.id));
  check(removal.cleanup.length === 0, 'Unlinked previous asset can be safely retired');
  check(
    !(await fetch(edited.public_url, { cache: 'no-store' })).ok,
    'Retired bytes no longer exist',
  );
  const lostResponse = makeClient(async (input, init) => {
    const request = new Request(input, init);
    const result = await supabaseFetch(input, init);
    if (request.url.includes('/rest/v1/media_assets') && request.method === 'POST' && result.ok)
      return new Response('{"message":"lost response"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    return result;
  });
  assert.ifError((await lostResponse.auth.setSession(actors.owner.session)).error);
  const reconciled = (await uploadPrivate(lostResponse, file, metadata, options)).asset;
  check(
    Boolean((await getMedia(owner, reconciled.id)).id),
    'Committed insert with lost response is reconciled without deleting bytes',
  );
  const failedRemoval = makeClient(async (input, init) => {
    const request = new Request(input, init);
    if (request.url.includes('/storage/v1/object/') && request.method === 'DELETE')
      return new Response('{"message":"injected delete failure"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    return supabaseFetch(input, init);
  });
  assert.ifError((await failedRemoval.auth.setSession(actors.owner.session)).error);
  const partial = await deleteMedia(failedRemoval, reconciled);
  check(partial.cleanup.length === 1, 'Storage deletion failure returns explicit cleanup work');
  check(
    (await reportMediaOrphans(owner)).objectsWithoutMetadata.some(
      (o) => o.path === reconciled.storage_path,
    ),
    'Failed byte deletion appears in orphan report',
  );
  // Simulate an inaccessible backend through transport, never forge Storage rows.
  const unavailableClient = makeClient(async (input, init) => {
    const request = new Request(input, init);
    if (request.method === 'GET' && request.url.endsWith('/private/' + original.storage_path))
      return new Response('{"message":"injected backend failure"}', {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    return supabaseFetch(input, init);
  });
  assert.ifError((await unavailableClient.auth.setSession(actors.owner.session)).error);
  check(
    (await reportMediaOrphans(unavailableClient)).unavailableObjects.some(
      (o) => o.id === original.id,
    ),
    'Maintenance reports unreadable backend bytes without claiming that a 500 confirms deletion',
  );
  for (const scenario of ['missing', 'different-uuid']) {
    const inconsistent = makeClient(async (input, init) => {
      const request = new Request(input, init);
      const response = await supabaseFetch(input, init);
      if (request.url.endsWith('/storage/v1/object/list/private') && response.ok) {
        const rows = await response.json();
        const adjusted =
          scenario === 'missing'
            ? rows.filter((row) => row.id !== original.storage_object_id)
            : rows.map((row) =>
                row.id === original.storage_object_id ? { ...row, id: randomUUID() } : row,
              );
        return new Response(JSON.stringify(adjusted), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return response;
    });
    assert.ifError((await inconsistent.auth.setSession(actors.owner.session)).error);
    const report = await reportMediaOrphans(inconsistent);
    check(
      scenario === 'missing'
        ? report.metadataWithoutObjects.some((a) => a.id === original.id)
        : !report.complete && report.identityMismatches.some((a) => a.id === original.id),
      'Read-only orphan report detects ' + scenario + ' without deleting anything',
    );
  }
  console.log('Real local Storage/media integration passed: ' + checks + ' checks.');
} finally {
  const users = Object.values(actors).map((a) => a.user.id);
  if (users.length) {
    const quoted = users.map((id) => "'" + id + "'").join(',');
    const objects = JSON.parse(
      sql(
        "select coalesce(json_agg(json_build_object('bucket',bucket_id,'path',name)),'[]') from storage.objects where owner_id in (" +
          quoted +
          ');',
      ),
    );
    sql(
      "begin; delete from public.projects where id='" +
        projectId +
        "'; delete from public.posts where id='" +
        postId +
        "'; delete from public.technologies where id='" +
        technologyId +
        "'; delete from public.documents where asset_id in(select id from public.media_assets where created_by in(" +
        quoted +
        ')); delete from public.media_assets where created_by in(' +
        quoted +
        '); commit;',
    );
    for (const obj of objects)
      assert.ifError((await service.storage.from(obj.bucket).remove([obj.path])).error);
    sql('delete from public.admin_profiles where id in(' + quoted + ');');
    for (const user of users) assert.ifError((await service.auth.admin.deleteUser(user)).error);
  }
  console.log('F8 fixture users, metadata and bytes removed. No remote endpoint used.');
}
