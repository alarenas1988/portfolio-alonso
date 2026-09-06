import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cli, cliJson, verifyProject, verifyLink, ref, sql } from './edge-remote.mjs';
if (process.argv[2] !== '--inspect-f7')
  throw new Error('Use --inspect-f7; read-only, no deployment.');
const project = verifyProject();
verifyLink();
const migration = '20260906002300_admin_editorial_transactions.sql';
const source = readFileSync('supabase/migrations/' + migration, 'utf8');
assert(
  !/\bdrop\s+(table|function|schema|index|policy)|alter\s+table\s+(auth|storage)\.|grant\s+all|disable\s+row\s+level/iu.test(
    source,
  ),
);
const state = sql(`begin read only;select jsonb_build_object(
 'postgres',current_setting('server_version'),
 'history',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'raw',(select count(*) from public.analytics_events),'messages',(select count(*) from public.contact_messages),
 'daily',(select count(*) from public.analytics_daily),'content',(select count(*) from public.analytics_daily_content),
 'owners',(select count(*) from public.admin_profiles where role='owner' and active),
 'auth_users',(select count(*) from auth.users),'form_enabled',(select form_enabled from public.contact_settings),
 'collisions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in ('save_project','save_post','save_experience','touch_editorial_parent')),
 'automatic_rls',(select jsonb_agg(jsonb_build_object('name',evtname,'enabled',evtenabled)) from pg_event_trigger where evtname ilike '%rls%')
 ) as state;rollback;`)[0].state;
assert.equal(state.postgres, '17.6');
assert.deepEqual(state.history, [
  '20260906001900',
  '20260906002000',
  '20260906002100',
  '20260906002200',
]);
assert.equal(state.collisions, 0);
assert(state.automatic_rls.every((entry) => entry.enabled === 'O'));
const functions = cliJson(['functions', 'list', '--project-ref', ref]).map((f) => ({
  slug: f.slug,
  status: f.status,
  version: f.version,
  verify_jwt: f.verify_jwt,
}));
assert.equal(functions.length, 2);
assert.deepEqual(functions.map((f) => f.slug).sort(), ['contact-submit', 'track-event']);
assert(functions.every((f) => f.status === 'ACTIVE'));
const secrets = cliJson(['secrets', 'list', '--project-ref', ref])
  .map((s) => s.name)
  .sort();
assert(secrets.includes('ANALYTICS_HMAC_SECRET'));
const catalog = cliJson(['db', 'query', '--linked', '--file', 'scripts/audit-remote-readiness.sql'])
  .rows[0].audit;
const dry = JSON.parse(cli(['db', 'push', '--linked', '--dry-run', '--skip-vault']));
assert.deepEqual(dry.migrations, [migration]);
assert.deepEqual(dry.seeds, []);
assert.deepEqual(dry.roles, []);
mkdirSync('.tools/f7', { recursive: true });
writeFileSync('.tools/f7/remote-pre-catalog.json', JSON.stringify(catalog, null, 2));
const evidence = {
  date: new Date().toISOString(),
  project,
  cli: cli(['--version']).trim(),
  state,
  functions,
  secret_names: secrets,
  migration,
  sha256: createHash('sha256').update(source).digest('hex'),
  dry_run: dry,
  review:
    'Only three SECURITY INVOKER owner-checked editorial RPCs and a private invoker parent-revision trigger. No new tables, table grants, RLS policies, managed DDL or SECURITY DEFINER. DELETE is scoped to the locked editorial parent inside each atomic save.',
};
writeFileSync('.tools/f7/remote-preflight.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
