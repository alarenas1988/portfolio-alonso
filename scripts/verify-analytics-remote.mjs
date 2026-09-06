import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { format, resolveConfig } from 'prettier';
import { cli, cliJson, sql, verifyProject, verifyLink, ref } from './edge-remote.mjs';
import { localSql } from './edge-local.mjs';
import { verifyRemoteContactSource } from './verify-contact-source.mjs';
if (process.argv[2] !== '--verify-f10')
  throw new Error('Use --verify-f10 after local validation/deployment. Read-only.');
verifyProject();
verifyLink();
const query = `begin read only;set local search_path='';select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(x) order by table_schema,table_name,ordinal_position) from (select table_schema,table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default from information_schema.columns where table_schema in ('public','private')) x),
 'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_catalog.pg_get_constraintdef(k.oid)) order by n.nspname,c.relname,k.conname) from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')),
 'indexes',(select jsonb_agg(to_jsonb(x) order by schemaname,tablename,indexname) from pg_catalog.pg_indexes x where schemaname in ('public','private')),
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'definition',pg_catalog.pg_get_functiondef(p.oid),'owner',pg_catalog.pg_get_userbyid(p.proowner),'acl',p.proacl::text) order by n.nspname,p.proname) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname<>'rls_auto_enable'),
 'policies',(select jsonb_agg(to_jsonb(x) order by schemaname,tablename,policyname) from pg_catalog.pg_policies x where schemaname in ('public','private') or (schemaname='storage' and tablename='objects')),
 'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'definition',pg_catalog.pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and not t.tgisinternal),
 'relations',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text,'options',c.reloptions) order by n.nspname,c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','v')),
 'views',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'definition',pg_catalog.pg_get_viewdef(c.oid)) order by n.nspname,c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='v'),
 'column_grants',(select jsonb_agg(to_jsonb(x) order by table_schema,table_name,column_name,grantee,privilege_type) from (select table_schema,table_name,column_name,grantee,privilege_type from information_schema.column_privileges where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role')) x),
 'jobs',(select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'command',command,'active',active) order by jobname) from cron.job where jobname like 'portfolio-%')
) as catalog;rollback;`;
const local = JSON.parse(localSql(query)),
  remote = sql(query)[0].catalog;
writeFileSync('.tools/f10/local-schema.json', JSON.stringify(local, null, 2));
writeFileSync('.tools/f10/remote-schema.json', JSON.stringify(remote, null, 2));
const matches = {};
for (const key of Object.keys(local)) {
  try {
    assert.deepEqual(remote[key], local[key]);
    matches[key] = true;
  } catch {
    matches[key] = false;
  }
}
assert(
  Object.values(matches).every(Boolean),
  'Application catalog drift; inspect ignored local/remote schema evidence.',
);
const raw = cli(
  ['gen', 'types', '--linked', '--lang', 'typescript', '--schema', 'public,private'],
  180000,
);
const normalize = async (text) =>
  format(
    text
      .slice(text.indexOf('export type Json'))
      .replace(
        /\s*\/\/ Allows to automatically instantiate createClient[^\n]*\n\s*\/\/ instead of createClient[^\n]*\n\s*__InternalSupabase:\s*\{\s*PostgrestVersion:\s*"[^"]+"\s*\};?/g,
        '',
      ),
    { ...(await resolveConfig('src/types/database.ts')), parser: 'typescript' },
  );
const generated = await normalize(raw),
  expected = await normalize(readFileSync('src/types/database.ts', 'utf8'));
writeFileSync('.tools/f10/remote-database.ts', generated);
assert.equal(
  generated,
  expected,
  'Remote/local generated types differ; investigate before accepting.',
);
const dry = JSON.parse(cli(['db', 'push', '--linked', '--dry-run', '--skip-vault']));
assert.deepEqual(dry.migrations, []);
const state = sql(
  `select jsonb_build_object('history',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'raw',(select count(*) from public.analytics_events),'daily',(select count(*) from public.analytics_daily),'content',(select count(*) from public.analytics_daily_content),'dimensions',(select count(*) from private.analytics_daily_dimensions),'sessions',(select count(*) from private.analytics_daily_sessions),'messages',(select count(*) from public.contact_messages),'owners',(select count(*) from public.admin_profiles where role='owner' and active),'auth_users',(select count(*) from auth.users),'automatic_rls',(select bool_and(evtenabled='O') from pg_event_trigger where evtname ilike '%rls%'),'buckets',(select jsonb_agg(id order by id) from storage.buckets),'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private') and c.relrowsecurity),'definers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'owner',pg_get_userbyid(p.proowner),'search_path',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute')) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef)) as state;`,
)[0].state;
assert.equal(state.rls_tables, 35);
assert.equal(state.definers.filter((entry) => entry.name !== 'rls_auto_enable').length, 4);
assert.equal(state.automatic_rls, true);
const functions = cliJson(['functions', 'list', '--project-ref', ref]).map((f) => ({
  slug: f.slug,
  version: f.version,
  status: f.status,
  verify_jwt: f.verify_jwt,
}));
verifyRemoteContactSource();
assert.equal(functions.find((f) => f.slug === 'contact-submit').status, 'ACTIVE');
const evidence = {
  date: new Date().toISOString(),
  catalog_matches: matches,
  catalog_counts: Object.fromEntries(Object.entries(local).map(([k, v]) => [k, v.length])),
  types_equal: true,
  types_sha256: createHash('sha256').update(generated).digest('hex'),
  types_normalization:
    'Generator comments and platform PostgrestVersion annotation only, if present',
  dry_run: dry,
  state,
  functions,
};
writeFileSync('.tools/f10/post-deploy.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
