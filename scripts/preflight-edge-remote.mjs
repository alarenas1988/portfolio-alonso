import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cli, cliJson, verifyProject, verifyLink, ref, sql } from './edge-remote.mjs';
if (process.argv[2] !== '--inspect-f9')
  throw new Error('Explicit --inspect-f9 required; inspection does not deploy.');
const project = verifyProject();
cli(['link', '--project-ref', ref]);
verifyLink();
const state = sql(`begin read only; select jsonb_build_object(
 'postgres',current_setting('server_version'),
 'history',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'public_tables',(select count(*) from pg_tables where schemaname='public'),
 'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relrowsecurity),
 'owners',(select count(*) from public.admin_profiles where role='owner' and active),
 'form_enabled',(select form_enabled from public.contact_settings),
 'contact_count',(select count(*) from public.contact_messages),
 'analytics_count',(select count(*) from public.analytics_events),
 'rate_count',(select count(*) from private.rate_limit_buckets),
 'cron',(select jsonb_build_object('available',default_version,'installed',installed_version) from pg_available_extensions where name='pg_cron'),
 'automatic_rls',(select jsonb_agg(jsonb_build_object('name',evtname,'enabled',evtenabled,'function',evtfoid::regprocedure::text)) from pg_event_trigger where evtname ilike '%rls%'),
 'f9_conflicts',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and (p.proname like 'edge_%' or p.proname='consume_edge_limit')),
 'buckets',(select jsonb_agg(jsonb_build_object('name',id,'public',public,'limit',file_size_limit,'mime',allowed_mime_types) order by id) from storage.buckets)
 ) as state; rollback;`)[0].state;
const functions = cliJson(['functions', 'list', '--project-ref', ref]).map((f) => ({
  slug: f.slug,
  status: f.status,
  verify_jwt: f.verify_jwt,
}));
const secrets = cliJson(['secrets', 'list', '--project-ref', ref]).map((s) => s.name);
const catalog = cliJson(['db', 'query', '--linked', '--file', 'scripts/audit-remote-readiness.sql'])
  .rows[0].audit;
const dryRun = cli(['db', 'push', '--linked', '--dry-run', '--skip-vault']);
const migrations = [
  '20260906002000_edge_intake.sql',
  '20260906002100_edge_build_contracts.sql',
].map((name) => ({
  name,
  sha256: createHash('sha256')
    .update(readFileSync('supabase/migrations/' + name))
    .digest('hex'),
}));
const result = {
  date: new Date().toISOString(),
  project,
  cli: cli(['--version']).trim(),
  state,
  functions,
  secret_names: secrets,
  migrations,
  dry_run: dryRun,
};
mkdirSync('.tools/f9', { recursive: true });
writeFileSync('.tools/f9/remote-preflight.json', JSON.stringify(result, null, 2));
writeFileSync('.tools/f9/remote-pre-catalog.json', JSON.stringify(catalog, null, 2));
console.log(JSON.stringify(result, null, 2));
