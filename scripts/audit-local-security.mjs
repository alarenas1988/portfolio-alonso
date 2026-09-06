import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { fileURLToPath } from 'node:url';

const query =
  "select jsonb_build_object(\n'application_tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'),\n'grants',(select jsonb_agg(to_jsonb(g) order by table_schema,table_name,grantee,grantor,privilege_type) from (select table_schema,table_name,grantee,grantor,privilege_type from information_schema.role_table_grants where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role','PUBLIC')) g),\n'column_grants',(select jsonb_agg(to_jsonb(g) order by table_name,column_name,grantee,privilege_type) from (select table_name,column_name,grantee,privilege_type from information_schema.role_column_grants where table_schema='public' and table_name in ('admin_profiles','contact_messages','media_assets') and grantee in ('anon','authenticated')) g),\n'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'settings',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')),\n'views',(select jsonb_agg(jsonb_build_object('name',c.relname,'options',c.reloptions,'definition',pg_get_viewdef(c.oid,true)) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),\n'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','private') or (schemaname='storage' and tablename='objects')),\n'storage_grants',(select jsonb_agg(to_jsonb(g) order by grantee,grantor,privilege_type) from (select grantee,grantor,privilege_type from information_schema.role_table_grants where table_schema='storage' and table_name='objects' and grantee in ('anon','authenticated')) g),\n'storage_rls',(select relrowsecurity from pg_class where oid='storage.objects'::regclass),\n'application_buckets',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from storage.buckets where id in ('portfolio-public','blog','documents','private')),\n'managed_definer_functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'owner',pg_get_userbyid(p.proowner)) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname not in ('public','private','pg_catalog','information_schema') and n.nspname not like 'pg_temp_%')\n);";
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    'supabase_db_portfolio-alonso-f6-local',
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
    input: query,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  },
);
if (result.status !== 0) throw new Error('Local security catalog audit failed.');
const audit = JSON.parse(result.stdout);
if (audit.application_tables.length !== 35 || audit.application_tables.some((row) => !row.rls)) {
  throw new Error('Application table/RLS inventory mismatch.');
}
const destination = new URL('../docs/SECURITY_AUDIT.json', import.meta.url);
writeFileSync(
  destination,
  await format(JSON.stringify(audit), {
    ...(await resolveConfig(fileURLToPath(destination))),
    parser: 'json',
  }),
  'utf8',
);
console.log('Exported local catalog: 35 RLS tables, grants, policies, views and functions.');
