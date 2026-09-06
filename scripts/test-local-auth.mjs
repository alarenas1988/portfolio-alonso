import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '../src/lib/supabase/transport.ts';
import { loadPublicSnapshot } from '../src/lib/content/snapshot.ts';
import { requireOwner } from '../src/lib/auth/owner.ts';
import { getAuthRedirects } from '../src/lib/auth/redirects.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const status = spawnSync(process.execPath, [cli, 'status', '--output', 'json'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
});
if (status.status !== 0) throw new Error('Start the readiness local Supabase stack first.');
const local = JSON.parse(status.stdout);
if (
  local.API_URL !== 'http://127.0.0.1:58421' ||
  new URL(local.DB_URL).hostname !== '127.0.0.1' ||
  new URL(local.DB_URL).port !== '58422'
) {
  throw new Error('Auth integration tests only permit the isolated readiness loopback stack.');
}
const container = 'supabase_db_portfolio-alonso-baseline-local';
function sql(statement) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
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
      input: statement,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (result.status !== 0) throw new Error('Local SQL fixture operation failed.');
  return result.stdout.trim();
}
if (
  sql(
    'select (not exists(select 1 from public.admin_profiles) and not exists(select 1 from public.projects) and not exists(select 1 from public.contact_settings where email is not null))::text;',
  ) !== 'true'
) {
  throw new Error(
    'Auth tests require a clean readiness local seed. Run npm run db:reset locally first.',
  );
}
let checks = 0;
function check(condition, label) {
  if (!condition) throw new Error('Auth/RLS integration failed: ' + label);
  checks++;
}
function client(key = local.PUBLISHABLE_KEY) {
  return createClient(local.API_URL, key, {
    global: { fetch: supabaseFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
const admin = client(local.SECRET_KEY);
const anon = client();
const actors = {};
const run = randomUUID();
const password = randomBytes(32).toString('base64url') + 'Aa1!';
const ids = Object.fromEntries(
  [
    'project',
    'draft',
    'child',
    'privateChild',
    'post',
    'draftPost',
    'futurePost',
    'tech',
    'hiddenTech',
    'message',
    'asset',
  ].map((k) => [k, randomUUID()]),
);
const extraProjects = [];
const authAssetPath = 'temporary/' + randomUUID() + '.png';
const uid = (value) => {
  if (!/^[a-f0-9-]{36}$/.test(value)) throw new Error('Invalid fixture identity.');
  return "'" + value + "'";
};
try {
  for (const label of ['normal', 'inactive', 'owner']) {
    const email = 'f6-' + run + '-' + label + '@example.test';
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    check(!result.error && result.data.user, 'local admin creates ' + label);
    const user = result.data.user;
    if (!user) throw new Error('Missing local fixture user.');
    actors[label] = { user, client: client(), email };
  }
  const authAssetBytes = await sharp({
    create: { width: 1, height: 1, channels: 4, background: '#22d3ee' },
  })
    .png()
    .toBuffer();
  const authAsset = await admin.storage
    .from('private')
    .upload(authAssetPath, authAssetBytes, { contentType: 'image/png', upsert: false });
  check(
    !authAsset.error && authAsset.data?.id,
    'Auth fixture allocates a real Storage object through API',
  );
  sql(`begin;
    insert into public.admin_profiles(id,display_name,active) values
      (${uid(actors.owner.user.id)},'Local test owner',true),
      (${uid(actors.inactive.user.id)},'Local inactive owner',false);
    insert into public.projects(id,title,slug,published,published_at) values
      (${uid(ids.project)},'Public test','f6-public-test',true,now()-interval '1 day'),
      (${uid(ids.draft)},'PRIVATE_REST_SENTINEL','f6-private-test',false,null);
    insert into public.project_features(id,project_id,title) values
      (${uid(ids.child)},${uid(ids.project)},'Public child'),
      (${uid(ids.privateChild)},${uid(ids.draft)},'PRIVATE_REST_SENTINEL');
    insert into public.posts(id,title,slug,status,published_at) values
      (${uid(ids.post)},'Public post','f6-public-post','published',now()-interval '1 day'),
      (${uid(ids.draftPost)},'PRIVATE_REST_SENTINEL','f6-draft-post','draft',null),
      (${uid(ids.futurePost)},'PRIVATE_REST_SENTINEL','f6-future-post','published',now()+interval '1 day');
    insert into public.technologies(id,name,slug,category,visible) values
      (${uid(ids.tech)},'Public tech','f6-public-tech','test',true),
      (${uid(ids.hiddenTech)},'PRIVATE_REST_SENTINEL','f6-hidden-tech','test',false);
    insert into public.contact_messages(id,submission_id,name,email,subject,message) values
      (${uid(ids.message)},${uid(randomUUID())},'PRIVATE_REST_SENTINEL','test@example.test','Test','PRIVATE_REST_SENTINEL');
    insert into public.media_assets(id,storage_object_id,storage_bucket,storage_path,public_url,filename,mime_type,file_size,created_by,width,height,alt_text) values
      (${uid(ids.asset)},${uid(authAsset.data.id)},'private','${authAssetPath}',null,'test.png','image/png',${authAssetBytes.length},${uid(actors.owner.user.id)},1,1,'PRIVATE_REST_SENTINEL');
    update public.contact_settings set email='PRIVATE_REST_SENTINEL@example.test',email_visible=false;
    commit;`);
  for (const [label, actor] of Object.entries(actors)) {
    const result = await actor.client.auth.signInWithPassword({ email: actor.email, password });
    check(
      !result.error && result.data.session,
      label + ' logs in through real Auth (' + (result.error?.code ?? 'ok') + ')',
    );
    actor.session = result.data.session;
  }
  const signup = await anon.auth.signUp({ email: 'f6-signup-' + run + '@example.test', password });
  check(Boolean(signup.error), 'public signup disabled');
  const metadata = await actors.normal.client.auth.updateUser({
    data: { role: 'owner', active: true, is_admin: true, id: actors.owner.user.id },
  });
  check(!metadata.error, 'fixture can manipulate user_metadata');
  const refreshed = await actors.normal.client.auth.refreshSession();
  check(!refreshed.error, 'metadata receives a real signed JWT');
  const snapshots = [];
  for (const [label, actorClient] of [
    ['anon', anon],
    ...Object.entries(actors).map(([k, v]) => [k, v.client]),
  ]) {
    const snapshot = await loadPublicSnapshot(actorClient);
    check(
      snapshot.projects.length === 1 && snapshot.projects[0]?.id === ids.project,
      label + ' public project snapshot',
    );
    check(
      snapshot.posts.length === 1 && snapshot.posts[0]?.id === ids.post,
      label + ' excludes draft/future posts',
    );
    check(
      snapshot.technologies.length === 1 && snapshot.technologies[0]?.id === ids.tech,
      label + ' visible technology snapshot',
    );
    check(
      !JSON.stringify(snapshot).includes('PRIVATE_REST_SENTINEL'),
      label + ' snapshot excludes private values',
    );
    snapshots.push(JSON.stringify({ ...snapshot, generated_at: '' }));
    const projection = await actorClient.from('public_contact_settings').select('*');
    check(!projection.error && projection.data?.[0]?.email === null, label + ' safe contact view');
    const transportSession = await actorClient.auth.getSession();
    const rpcHeaders = { apikey: local.PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
    if (transportSession.data.session)
      rpcHeaders.Authorization = 'Bearer ' + transportSession.data.session.access_token;
    const privateRpc = await fetch(local.API_URL + '/rest/v1/rpc/is_portfolio_admin', {
      method: 'POST',
      headers: rpcHeaders,
      body: '{}',
    });
    check(!privateRpc.ok, label + ' private helper not exposed as RPC');
    const privateSchema = await fetch(local.API_URL + '/rest/v1/rpc/is_portfolio_admin', {
      method: 'POST',
      headers: { ...rpcHeaders, 'Content-Profile': 'private' },
      body: '{}',
    });
    check(privateSchema.status === 406, label + ' private schema is not exposed');
  }
  check(new Set(snapshots).size === 1, 'public snapshot equivalent for all roles');
  for (const [label, actorClient] of [
    ['anon', anon],
    ['normal', actors.normal.client],
    ['inactive', actors.inactive.client],
  ]) {
    for (const [table, id] of [
      ['projects', ids.draft],
      ['project_features', ids.privateChild],
      ['posts', ids.draftPost],
    ]) {
      const result = await actorClient.from(table).select('*').eq('id', id);
      check(
        !result.error && result.data.length === 0,
        label + ' direct private UUID hidden: ' + table,
      );
    }
    const insert = await actorClient.from('projects').insert({
      title: 'Attack',
      slug: 'attack-' + label,
      published: true,
      published_at: new Date().toISOString(),
    });
    check(Boolean(insert.error), label + ' cannot insert published content');
    const update = await actorClient
      .from('projects')
      .update({ title: 'Attack' })
      .eq('id', ids.project)
      .select('id');
    check(
      Boolean(update.error) || update.data.length === 0,
      label + ' cannot update public content',
    );
    const remove = await actorClient.from('projects').delete().eq('id', ids.project).select('id');
    check(
      Boolean(remove.error) || remove.data.length === 0,
      label + ' cannot delete public content',
    );
    const reparent = await actorClient
      .from('project_features')
      .update({ project_id: ids.draft })
      .eq('id', ids.child)
      .select('id');
    check(
      Boolean(reparent.error) || reparent.data.length === 0,
      label + ' cannot change parent FK',
    );
    for (const table of [
      'contact_messages',
      'analytics_events',
      'site_builds',
      'admin_activity',
      'media_assets',
      'admin_profiles',
      'admin_analytics_daily_dimensions',
    ]) {
      const result = await actorClient.from(table).select('*');
      check(
        Boolean(result.error) || result.data.length === 0,
        label + ' private data hidden: ' + table,
      );
    }
    const createOwner = await actorClient
      .from('admin_profiles')
      .insert({ id: actors.normal.user.id, display_name: 'Attack', active: true, role: 'owner' });
    check(Boolean(createOwner.error), label + ' cannot create second owner');
    const elevate = await actorClient
      .from('admin_profiles')
      .update({ active: true })
      .eq('id', actors.inactive.user.id);
    check(Boolean(elevate.error), label + ' cannot edit active');
    try {
      await requireOwner(actorClient);
      throw new Error('Guard allowed nonowner');
    } catch (error) {
      check(error.message !== 'Guard allowed nonowner', label + ' frontend guard denies as UX');
    }
  }
  const owner = actors.owner.client;
  check(
    (await requireOwner(owner)).id === actors.owner.user.id,
    'owner UX guard uses verified Auth and DB profile',
  );
  const created = await owner
    .from('projects')
    .insert({ title: 'Owner CRUD', slug: 'f6-owner-crud' })
    .select('id')
    .single();
  check(!created.error && created.data, 'owner REST insert');
  extraProjects.push(created.data.id);
  const edited = await owner
    .from('projects')
    .update({ title: 'Edited' })
    .eq('id', created.data.id)
    .select('title')
    .single();
  check(!edited.error && edited.data?.title === 'Edited', 'owner REST update');
  const removed = await owner.from('projects').delete().eq('id', created.data.id).select('id');
  check(!removed.error && removed.data?.length === 1, 'owner REST delete');
  const ownName = await owner
    .from('admin_profiles')
    .update({ display_name: 'Edited local owner' })
    .eq('id', actors.owner.user.id)
    .select('id');
  check(!ownName.error && ownName.data?.length === 1, 'owner profile display update');
  for (const change of [{ active: false }, { role: 'owner' }, { id: actors.normal.user.id }]) {
    const result = await owner.from('admin_profiles').update(change).eq('id', actors.owner.user.id);
    check(Boolean(result.error), 'owner cannot alter authorization fields');
  }
  const messages = await owner.from('contact_messages').select('id');
  check(!messages.error && messages.data?.length === 1, 'owner private message read');
  const statusChange = await owner
    .from('contact_messages')
    .update({ status: 'read' })
    .eq('id', ids.message);
  check(!statusChange.error, 'owner message status update');
  const forgedAudit = await owner
    .from('admin_activity')
    .insert({ action: 'fake', entity_type: 'project' });
  check(Boolean(forgedAudit.error), 'owner browser cannot forge audit');
  const validOwnerJwt = actors.owner.session.access_token;
  const segments = validOwnerJwt.split('.');
  segments[1] = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(segments[1], 'base64url').toString()),
      sub: actors.normal.user.id,
    }),
  ).toString('base64url');
  const forged = await fetch(local.API_URL + '/rest/v1/projects?select=id', {
    headers: {
      apikey: local.PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + segments.join('.'),
    },
  });
  check(forged.status === 401, 'modified JWT subject/signature rejected at API');
  // Prove that the local legacy key is accepted before testing expiration with it.
  function signedToken(exp) {
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: actors.owner.user.id,
        role: 'authenticated',
        aud: 'authenticated',
        exp,
      }),
    ).toString('base64url');
    const body = head + '.' + payload;
    return body + '.' + createHmac('sha256', local.JWT_SECRET).update(body).digest('base64url');
  }
  const jwtRequest = (token) =>
    fetch(local.API_URL + '/rest/v1/projects?select=id&id=eq.' + ids.draft, {
      headers: { apikey: local.PUBLISHABLE_KEY, Authorization: 'Bearer ' + token },
    });
  const valid = await jwtRequest(signedToken(Math.floor(Date.now() / 1000) + 120));
  check(valid.ok && (await valid.json()).length === 1, 'local signed token baseline accepted');
  const expired = await jwtRequest(signedToken(Math.floor(Date.now() / 1000) - 120));
  check(expired.status === 401, 'expired signed owner JWT rejected');
  const recovery = await actors.normal.client.auth.resetPasswordForEmail(actors.normal.email, {
    redirectTo: getAuthRedirects('http://localhost:4321/portfolio-alonso/').recovery,
  });
  check(!recovery.error, 'local recovery request accepted with fixed physical route');
  sql('update public.admin_profiles set active=false where id=' + uid(actors.owner.user.id));
  const revoked = await owner.from('projects').select('id').eq('id', ids.draft);
  check(
    !revoked.error && revoked.data.length === 0,
    'deactivated owner loses draft access with the same valid JWT',
  );
  const revokedWrite = await owner
    .from('projects')
    .insert({ title: 'Revoked', slug: 'f6-revoked-owner' });
  check(Boolean(revokedWrite.error), 'deactivated owner loses writes immediately');
  console.log('Real local Auth + REST integration passed: ' + checks + ' checks.');
} finally {
  const users = Object.values(actors).map((a) => uid(a.user.id));
  sql(`begin;
    delete from public.project_features where id in (${uid(ids.child)},${uid(ids.privateChild)});
    delete from public.projects where id in (${[ids.project, ids.draft, ...extraProjects].map(uid).join(',')});
    delete from public.posts where id in (${[ids.post, ids.draftPost, ids.futurePost].map(uid).join(',')});
    delete from public.technologies where id in (${uid(ids.tech)},${uid(ids.hiddenTech)});
    delete from public.contact_messages where id=${uid(ids.message)};
    delete from public.media_assets where id=${uid(ids.asset)};
    update public.contact_settings set email=null,email_visible=false where email='PRIVATE_REST_SENTINEL@example.test';
    ${users.length ? 'delete from public.admin_profiles where id in (' + users.join(',') + ');' : ''}
    commit;`);
  let cleanupComplete = true;
  if ((await admin.storage.from('private').remove([authAssetPath])).error) {
    cleanupComplete = false;
    process.exitCode = 1;
  }
  for (const actor of Object.values(actors)) {
    const result = await admin.auth.admin.deleteUser(actor.user.id);
    if (result.error) {
      cleanupComplete = false;
      process.exitCode = 1;
    }
  }
  if (cleanupComplete) console.log('Local Auth fixtures removed; no remote endpoint was used.');
  else console.error('Local Auth fixture cleanup failed.');
}
