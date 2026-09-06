-- Catalog inspection only. No credentials, Auth rows, or application payloads.
begin read only;
set local statement_timeout = '15s';
select jsonb_build_object(
  'server_version', current_setting('server_version'),
  'inspection_role', current_user,
  'schemas', (select jsonb_agg(nspname order by nspname) from pg_catalog.pg_namespace where nspname not like 'pg_%'),
  'extensions', (select jsonb_agg(jsonb_build_object('name', name, 'available', default_version, 'installed', installed_version) order by name) from pg_catalog.pg_available_extensions),
  'tables', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'owner', pg_catalog.pg_get_userbyid(c.relowner), 'rls', c.relrowsecurity) order by n.nspname,c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','private','auth','storage','supabase_migrations')),
  'functions', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname, 'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid), 'owner', pg_catalog.pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef, 'config', p.proconfig) order by n.nspname,p.proname,p.oid) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','storage')),
  'views', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'options', c.reloptions, 'definition', pg_catalog.pg_get_viewdef(c.oid)) order by n.nspname,c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.relkind in ('v','m') and n.nspname in ('public','private','auth','storage','graphql_public')),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_catalog.pg_policies p where schemaname in ('public','private','auth','storage')),
  'event_triggers', (select jsonb_agg(jsonb_build_object('name',e.evtname,'enabled',e.evtenabled,'event',e.evtevent,'tags',e.evttags,'function',e.evtfoid::regprocedure::text) order by e.evtname) from pg_catalog.pg_event_trigger e),
  'buckets', (select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets),
  'storage_object_count', (select count(*) from storage.objects),
  'storage_indexes', (select jsonb_agg(indexdef order by indexname) from pg_catalog.pg_indexes where schemaname='storage' and tablename='objects'),
  'migration_history_exists', to_regclass('supabase_migrations.schema_migrations') is not null
) as audit;
rollback;
