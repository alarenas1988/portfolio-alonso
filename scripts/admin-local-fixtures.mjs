import { File } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { localStatus, localSql } from './edge-local.mjs';
import { supabaseFetch } from '../src/lib/supabase/transport.ts';
import { uploadPrivate, publishMedia } from '../src/lib/media/upload.ts';
import { validateBuildFile } from '../src/lib/media/validation-build.ts';
const path = new URL('../.tools/admin-local-state.json', import.meta.url);
export async function prepareAdminFixtures() {
  const local = localStatus();
  if (existsSync(path)) throw new Error('Clean the previous identified local CMS fixture first.');
  if (localSql('select count(*) from public.admin_profiles;') !== '0')
    throw new Error('CMS tests require the isolated local seed without owner profiles.');
  const create = (key) =>
    createClient(local.API_URL, key, {
      global: { fetch: supabaseFetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  const admin = create(local.SECRET_KEY),
    run = randomUUID(),
    state = {
      run,
      actors: {},
      project: randomUUID(),
      post: randomUUID(),
      tech: randomUUID(),
      message: randomUUID(),
      assets: [],
    };
  mkdirSync(new URL('../.tools/', import.meta.url), { recursive: true });
  function save() {
    writeFileSync(path, JSON.stringify(state));
  }
  save();
  for (const kind of ['owner', 'normal', 'inactive']) {
    const email = 'f7-' + run + '-' + kind + '@example.test',
      password = randomBytes(32).toString('base64url') + 'Aa1!';
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error('Local fixture Auth creation failed.');
    state.actors[kind] = { id: data.user.id, email, password };
    save();
  }
  localSql(
    `insert into public.admin_profiles(id,display_name,active) values('${state.actors.owner.id}','Alonso · CMS local',true),('${state.actors.inactive.id}','Inactive fixture',false);`,
  );
  const owner = create(local.PUBLISHABLE_KEY);
  const signed = await owner.auth.signInWithPassword(state.actors.owner);
  if (signed.error) throw new Error('Local fixture login failed.');
  const png = await sharp({
    create: { width: 960, height: 540, channels: 4, background: '#10172a' },
  })
    .png()
    .toBuffer();
  const uploaded = await uploadPrivate(
    owner,
    new File([png], 'cms-fixture.png', { type: 'image/png' }),
    {
      altText: 'Recurso sintético de pruebas locales',
      decorative: false,
      caption: 'Solo testing local',
      category: 'project',
    },
    { validate: validateBuildFile },
  );
  state.assets.push(uploaded.asset);
  save();
  const published = await publishMedia(
    owner,
    uploaded.asset,
    { bucket: 'portfolio-public', folder: 'projects' },
    { validate: validateBuildFile },
  );
  state.assets.push(published.asset);
  save();
  const tech = await owner.from('technologies').insert({
    id: state.tech,
    name: 'TypeScript · fixture',
    slug: 'f7-fixture-typescript',
    category: 'Desarrollo',
    visible: false,
  });
  if (tech.error) throw new Error('Technology fixture failed.');
  const project = await owner.rpc('save_project', {
    p_id: state.project,
    p_expected: null,
    p_record: {
      title: 'Automatización de procesos · fixture',
      slug: 'f7-fixture-project',
      summary:
        'Caso sintético para comprobar la edición y sus relaciones. No es contenido del portfolio.',
      status: 'development',
      year: 2026,
      featured_image_asset_id: published.asset.id,
      problem: '## Contexto\nContenido local de prueba.',
      solution: 'Una solución editorial de prueba.',
    },
    p_relations: {
      features: [{ id: randomUUID(), title: 'Validación de datos', description: 'Fixture local' }],
      technologies: [{ technology_id: state.tech, sort_order: 0 }],
    },
  });
  if (project.error) throw new Error('Project fixture failed: ' + project.error.code);
  const post = await owner.rpc('save_post', {
    p_id: state.post,
    p_expected: null,
    p_record: {
      title: 'Notas de arquitectura · fixture',
      slug: 'f7-fixture-post',
      excerpt: 'Un artículo sintético para verificar Markdown, taxonomías y preview.',
      content_markdown:
        '## Diseñar\nTexto de prueba.\n\n## Construir\n```typescript\nconst ready = true;\n```\n\n## Comprobar\n| Caso | Estado |\n| --- | --- |\n| Local | Listo |\n\n![Prueba](media:' +
        published.asset.id +
        ')',
      featured_image_asset_id: published.asset.id,
    },
    p_relations: {},
  });
  if (post.error) throw new Error('Post fixture failed: ' + post.error.code);
  localSql(
    `insert into public.contact_messages(id,submission_id,name,email,subject,message) values('${state.message}','${randomUUID()}','CMS fixture','cms-fixture@example.test','Consulta local de prueba','<script>window.CMS_XSS=true</script> Mensaje mostrado como texto.');`,
  );
  save();
  return {
    state,
    env: {
      PUBLIC_SUPABASE_URL: local.API_URL,
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
      PUBLIC_SITE_URL: 'https://alarenas1988.github.io/portfolio-alonso/',
      PUBLIC_ANALYTICS_ENABLED: 'false',
    },
  };
}
export async function cleanupAdminFixtures() {
  localStatus();
  if (!existsSync(path)) return;
  const state = JSON.parse(readFileSync(path, 'utf8'));
  const safe = (value) => {
    if (!/^[a-f0-9-]{36}$/.test(value)) throw new Error('Invalid local fixture identity');
    return "'" + value + "'";
  };
  const local = localStatus(),
    admin = createClient(local.API_URL, local.SECRET_KEY, {
      global: { fetch: supabaseFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  // Only the isolated fixture-owned stack is accepted by localStatus. Clean identified resources.
  localSql(
    `delete from public.contact_messages where id=${safe(state.message)};delete from public.posts where id=${safe(state.post)} or slug like 'f7-e2e-%';delete from public.projects where id=${safe(state.project)} or slug like 'f7-e2e-%';delete from public.experiences where organization='F7 E2E local';delete from public.technologies where id=${safe(state.tech)} or slug like 'f7-e2e-%';delete from public.tags where slug like 'f7-e2e-%';delete from public.post_categories where slug like 'f7-e2e-%';delete from public.documents where title like 'F7 E2E%';`,
  );
  const media = localSql(
    `select coalesce(json_agg(json_build_object('storage_bucket',storage_bucket,'storage_path',storage_path)),'[]') from public.media_assets where created_by=${safe(state.actors.owner.id)};`,
  );
  localSql(`delete from public.media_assets where created_by=${safe(state.actors.owner.id)};`);
  for (const asset of JSON.parse(media)) {
    const { error } = await admin.storage.from(asset.storage_bucket).remove([asset.storage_path]);
    if (error) throw new Error('Local fixture byte cleanup failed.');
  }
  localSql(
    `delete from public.admin_profiles where id in (${Object.values(state.actors)
      .map((a) => safe(a.id))
      .join(',')});`,
  );
  for (const actor of Object.values(state.actors)) {
    const { error } = await admin.auth.admin.deleteUser(actor.id);
    if (error) throw new Error('Local Auth fixture cleanup failed.');
  }
  unlinkSync(path);
  console.log('Identified local CMS fixtures removed.');
}
if (process.argv[2] === 'cleanup') await cleanupAdminFixtures();
