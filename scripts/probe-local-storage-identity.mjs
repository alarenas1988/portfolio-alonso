// Experimental compatibility test. File operations use Storage API exclusively.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '../src/lib/supabase/transport.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const status = spawnSync(
  process.execPath,
  ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'],
  {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  },
);
if (status.status !== 0) throw new Error('Start the local readiness stack.');
const local = JSON.parse(status.stdout);
if (
  local.API_URL !== 'http://127.0.0.1:57421' ||
  new URL(local.DB_URL).hostname !== '127.0.0.1' ||
  new URL(local.DB_URL).port !== '57422'
)
  throw new Error('Only the isolated readiness loopback stack is permitted.');
function sql(input) {
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
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (result.status !== 0) throw new Error('Local identity probe SQL failed.');
  return result.stdout.trim();
}
const catalogSql = `select json_build_object(
 'columns',(select json_agg(json_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull) order by attnum) from pg_attribute where attrelid='storage.objects'::regclass and attnum>0 and not attisdropped),
 'constraints',(select json_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid='storage.objects'::regclass),
 'indexes',(select json_agg(indexdef order by indexname) from pg_indexes where schemaname='storage' and tablename='objects'),
 'triggers',(select json_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal)
);`;
const before = sql(catalogSql);
assert.match(before, /PRIMARY KEY \(id\)/);
assert.ok(
  JSON.parse(before).columns.some((c) => c.name === 'id' && c.type === 'uuid' && c.not_null),
);
assert.equal(sql('select count(*) from public.admin_profiles;'), '0');
assert.equal(sql("select to_regclass('private.storage_identity_probe') is null;"), 't');
const options = {
  global: { fetch: supabaseFetch },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const service = createClient(local.API_URL, local.SECRET_KEY, options);
const owner = createClient(local.API_URL, local.PUBLISHABLE_KEY, options);
const password = randomBytes(32).toString('base64url') + 'Aa1!';
const email = 'identity-probe-' + randomUUID() + '@example.test';
const objects = [];
const checks = [];
let user;
let probeCreated = false;
const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#22d3ee' } })
  .png()
  .toBuffer();
const objectId = (bucket, path) =>
  sql(`select id from storage.objects where bucket_id='${bucket}' and name='${path}';`);
try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  user = created.data.user;
  assert.ifError((await owner.auth.signInWithPassword({ email, password })).error);
  sql(`insert into public.admin_profiles(id,display_name,active) values('${user.id}','Local identity probe',true);
    create table private.storage_identity_probe(object_id uuid primary key references storage.objects(id) on delete restrict on update restrict);
    alter table private.storage_identity_probe enable row level security;
    revoke all on private.storage_identity_probe from public,anon,authenticated;`);
  probeCreated = true;
  const path = 'temporary/' + randomUUID() + '.png';
  objects.push({ bucket: 'private', path });
  const uploaded = await owner.storage
    .from('private')
    .upload(path, png, { contentType: 'image/png', upsert: false });
  assert.ifError(uploaded.error);
  assert.equal(uploaded.data.id, objectId('private', path));
  checks.push('upload_returns_catalog_uuid');
  sql(`insert into private.storage_identity_probe(object_id) values('${uploaded.data.id}');`);
  assert.ifError((await owner.storage.from('private').download(path)).error);
  checks.push('registered_pk_allows_read');
  const publicPath = 'general/' + randomUUID() + '.png';
  objects.push({ bucket: 'portfolio-public', path: publicPath });
  const copied = await owner.storage
    .from('private')
    .copy(path, publicPath, { destinationBucket: 'portfolio-public' });
  assert.ifError(copied.error);
  const copyId = objectId('portfolio-public', publicPath);
  assert.ok(copyId);
  assert.notEqual(copyId, uploaded.data.id);
  assert.equal(objectId('private', path), uploaded.data.id);
  checks.push('copy_has_new_uuid_preserves_source');
  const publicUrl = owner.storage.from('portfolio-public').getPublicUrl(publicPath).data.publicUrl;
  assert.deepEqual(Buffer.from(await (await fetch(publicUrl)).arrayBuffer()), png);
  checks.push('copied_public_bytes_readable');
  const replacementPath = 'temporary/' + randomUUID() + '.png';
  objects.push({ bucket: 'private', path: replacementPath });
  const replacement = await owner.storage
    .from('private')
    .upload(replacementPath, png, { contentType: 'image/png', upsert: false });
  assert.ifError(replacement.error);
  assert.notEqual(replacement.data.id, uploaded.data.id);
  checks.push('replacement_upload_has_new_uuid');
  const blocked = await owner.storage.from('private').remove([path]);
  assert.ok(blocked.error, 'PK RESTRICT must reject registered deletion');
  assert.equal(objectId('private', path), uploaded.data.id);
  const retained = await owner.storage.from('private').download(path);
  assert.ifError(retained.error);
  assert.deepEqual(Buffer.from(await retained.data.arrayBuffer()), png);
  checks.push('restricted_api_delete_preserves_row_and_bytes');
  sql(`delete from private.storage_identity_probe where object_id='${uploaded.data.id}';`);
  assert.ifError((await owner.storage.from('private').remove([path])).error);
  assert.equal(objectId('private', path), '');
  assert.ok((await owner.storage.from('private').download(path)).error);
  checks.push('unregistered_api_delete_removes_row_and_bytes');
  assert.ifError(
    (
      await owner.storage
        .from('private')
        .upload(path, png, { contentType: 'image/png', upsert: false })
    ).error,
  );
  assert.notEqual(objectId('private', path), uploaded.data.id);
  checks.push('recreated_path_has_different_uuid');
  assert.equal(sql(catalogSql), before);
  checks.push('storage_structure_unchanged');
  await writeFile(
    new URL('../docs/checkpoints/local-storage-identity-probe.json', import.meta.url),
    JSON.stringify(
      {
        postgres: '17.6',
        catalog: JSON.parse(before),
        checks,
        delete_error_code: blocked.error.code ?? blocked.error.statusCode,
        fixture_ids_omitted: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Storage primary-key compatibility probe passed: ' + checks.length + ' checks.');
} finally {
  if (probeCreated) sql('drop table private.storage_identity_probe;');
  for (const object of objects)
    assert.ifError((await service.storage.from(object.bucket).remove([object.path])).error);
  if (user) {
    sql(`delete from public.admin_profiles where id='${user.id}';`);
    assert.ifError((await service.auth.admin.deleteUser(user.id)).error);
  }
  console.log('Probe fixtures removed through Storage/Auth API; no remote used.');
}
