import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  baselineName,
  baselineVersion,
  generateBaseline,
  hash,
  historicalSources,
} from './baseline-model.mjs';
import { assertLocal, cli, root, sql, stageLegacy } from './baseline-local.mjs';

if (process.argv.length !== 2)
  throw new Error('This local-only proof accepts no target or extra arguments.');
assertLocal();
const sources = historicalSources();
const baseline = generateBaseline(sources);
assert.equal(
  readFileSync(
    new URL('../supabase/migrations/' + baselineName, import.meta.url),
    'utf8',
  ).replaceAll('\r\n', '\n'),
  baseline,
);
const catalogQuery = readFileSync(new URL('baseline-catalog.sql', import.meta.url), 'utf8');
const snapshotQuery = "select public.get_public_snapshot()-'generated_at';";
const catalog = () => JSON.parse(sql(catalogQuery).stdout);
const scalar = (query) => sql(query).stdout.trim();
const checks = [];
const record = (name) => {
  checks.push(name);
  console.log('Verified: ' + name);
};
const automatic = () =>
  scalar("select pg_get_functiondef('public.rls_auto_enable()'::regprocedure);");
const emptyDirectory = new URL('../.tools/empty-platform/supabase/', import.meta.url);
mkdirSync(new URL('migrations/', emptyDirectory), { recursive: true });
copyFileSync(
  new URL('../supabase/config.toml', import.meta.url),
  new URL('config.toml', emptyDirectory),
);
const emptyWorkdir = fileURLToPath(new URL('../', emptyDirectory));
const backupManifest = JSON.parse(
  readFileSync(new URL('../docs/checkpoints/remote-backup-manifest.json', import.meta.url), 'utf8'),
);
if (!process.env.LOCALAPPDATA)
  throw new Error('LOCALAPPDATA required to find the protected recovery backup.');
const backupDirectory = join(
  process.env.LOCALAPPDATA,
  'portfolio-alonso/backups/20260906-predeploy',
);
const backupFiles = ['roles-retry.sql', 'schema.sql', 'data.sql', 'automatic-rls-event.sql'];
const backupContents = backupFiles.map((file) => {
  const contents = readFileSync(join(backupDirectory, file));
  assert.equal(
    hash(contents),
    backupManifest.files.find((entry) => entry.file === file)?.sha256,
    'Recovery backup hash: ' + file,
  );
  return contents.toString('utf8');
});
const remotePrestate = JSON.parse(
  readFileSync(new URL('../docs/checkpoints/initial-remote-catalog.json', import.meta.url), 'utf8'),
);
function restoreBackup() {
  // This platform-owned parameter grant already exists. postgres cannot re-grant it;
  // assert it instead of escalating privileges or changing the managed role.
  assert.equal(
    scalar("select has_parameter_privilege('supabase_realtime_admin','log_min_messages','SET');"),
    't',
  );
  const managedGrant = 'GRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";';
  assert.equal(backupContents[0].split(managedGrant).length, 2);
  const roles = backupContents[0].replace(
    managedGrant,
    () => '-- Existing managed parameter privilege verified; not re-granted.',
  );
  // CLI's local template leaves sequence UPDATE defaults that are absent remotely.
  // The logical dump does not revoke them; restore the audited source ACL explicitly.
  assert.equal(
    remotePrestate.defaults.find(
      (entry) => entry.role === 'postgres' && entry.schema === 'public' && entry.kind === 'S',
    )?.acl,
    '{postgres=rwU/postgres}',
  );
  sql(
    'begin;\n' +
      [roles, ...backupContents.slice(1)].join('\n') +
      '\nalter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;\ncommit;',
  );
  assert.equal(scalar("select evtenabled from pg_event_trigger where evtname='ensure_rls';"), 'O');
  assert.equal(
    scalar(
      "begin; create table public._automatic_rls_canary(id uuid); select relrowsecurity from pg_class where oid='public._automatic_rls_canary'::regclass; rollback;",
    ),
    't',
  );
}
function resetEmpty() {
  cli(['db', 'reset', '--local', '--no-seed'], { workdir: emptyWorkdir });
  restoreBackup();
  assert.equal(scalar("select count(*) from pg_tables where schemaname='public';"), '0');
  assert.equal(scalar('select count(*) from storage.objects;'), '0');
  assert.deepEqual(
    catalog(),
    remotePrestate,
    'Restored schema/security catalog must match the actual remote prestate',
  );
}
function installObserver() {
  sql(`create schema baseline_probe;
    create table baseline_probe.events(id bigint generated always as identity);
    create function baseline_probe.reject_non_pk_fk() returns event_trigger
    language plpgsql security invoker set search_path='' as $probe$
    begin
      if exists(select 1 from pg_catalog.pg_constraint f join pg_catalog.pg_namespace n on n.oid=f.connamespace
        where f.contype='f' and n.nspname in ('public','private') and f.confrelid='storage.objects'::regclass
          and not exists(select 1 from pg_catalog.pg_constraint p where p.conrelid=f.confrelid and p.contype='p' and p.conkey=f.confkey)) then
        raise exception 'Probe rejected transient non-PK Storage foreign key';
      end if;
      insert into baseline_probe.events default values;
    end;$probe$;
    create event trigger baseline_observer on ddl_command_end execute function baseline_probe.reject_non_pk_fk();`);
}
function removeObserver() {
  sql(
    'drop event trigger baseline_observer; drop function baseline_probe.reject_non_pk_fk(); drop table baseline_probe.events; drop schema baseline_probe;',
  );
}
function seed() {
  sql(readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
}
function semanticSnapshot() {
  const clean = (value) =>
    Array.isArray(value)
      ? value.map(clean)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([key]) => !['id', 'created_at', 'updated_at'].includes(key))
              .map(([key, child]) => [key, clean(child)]),
          )
        : value;
  return clean(JSON.parse(sql(snapshotQuery).stdout));
}
function runProbe() {
  const result = spawnSync(
    process.execPath,
    ['scripts/probe-local-storage-identity.mjs', '--upgrade-f8'],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) {
    writeFileSync(
      new URL('../.tools/baseline-probe-error.log', import.meta.url),
      (result.stderr ?? '') + (result.stdout ?? ''),
    );
    throw new Error('F8 API upgrade probe failed; see ignored local diagnostics.');
  }
  console.log(result.stdout.trim());
}

console.log('Rehearsing the protected remote backup in the isolated local stack.');
resetEmpty();
record('logical_backup_restored_into_empty_local_supabase');
const originalAutomatic = automatic();
installObserver();
const nonPkAttempt = sql(
  'begin; create table public._bad_fk_probe(bucket text,name text,foreign key(bucket,name) references storage.objects(bucket_id,name)); rollback;',
  { expectFailure: true },
);
assert.notEqual(nonPkAttempt.status, 0);
assert.match(nonPkAttempt.stderr, /Probe rejected transient non-PK/);
record('observer_rejects_even_transient_non_pk_dependencies');
const interrupted = sql(
  baseline.replace(
    /commit;\s*$/,
    () =>
      "do $failure$ begin raise exception 'Deliberate baseline rollback'; end; $failure$;\ncommit;",
  ),
  { expectFailure: true },
);
assert.notEqual(interrupted.status, 0);
assert.match(interrupted.stderr, /Deliberate baseline rollback/);
assert.equal(
  scalar("select to_regclass('public.projects') is null and to_regnamespace('private') is null;"),
  't',
);
assert.equal(scalar('select count(*) from storage.buckets;'), '0');
assert.equal(automatic(), originalAutomatic);
record('interrupted_initial_installation_rolls_back_all_application_changes');
cli(['migration', 'up', '--local']);
const observed = Number(scalar('select count(*) from baseline_probe.events;'));
assert.ok(observed > 100);
removeObserver();
assert.equal(automatic(), originalAutomatic);
record('initial_baseline_never_creates_non_pk_fk_and_preserves_automatic_rls');
seed();
const expected = catalog();
const expectedSnapshot = semanticSnapshot();
const duplicate = sql(baseline, { expectFailure: true });
assert.notEqual(duplicate.status, 0);
assert.match(duplicate.stderr, /Initial baseline requires an empty application/);
assert.deepEqual(catalog(), expected);
record('baseline_rejects_populated_application_without_changes');
writeFileSync(
  new URL('../.tools/baseline-reference.json', import.meta.url),
  JSON.stringify(expected),
);

console.log('Rebuilding historical F8 and exercising the immutable 018 transition.');
resetEmpty();
const legacy = stageLegacy({ includeIdentity: false });
cli(['migration', 'up', '--local'], { workdir: legacy });
seed();
runProbe();
record('populated_f8_upgrade_via_018_passes_thirteen_api_checks');
const upgraded = catalog();
const differences = Object.keys(expected).filter(
  (key) => JSON.stringify(expected[key]) !== JSON.stringify(upgraded[key]),
);
writeFileSync(
  new URL('../.tools/legacy-upgraded-catalog.json', import.meta.url),
  JSON.stringify(upgraded),
);
assert.deepEqual(differences, [], 'Schema/security differences between installation paths');
assert.deepEqual(semanticSnapshot(), expectedSnapshot);
record('both_paths_have_identical_schema_grants_rls_functions_storage_and_seed_contract');

// Only reconcile the local ledger after proving the schema. No SQL is replayed here.
const ledgerBefore = scalar(
  'select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m;',
);
writeFileSync(
  new URL('../.tools/legacy-history-before-adoption.json', import.meta.url),
  ledgerBefore,
);
sql(
  "insert into public.projects(title,slug) values('Local adoption fixture','baseline-adoption-fixture');",
);
const persistedBefore = scalar(
  "select to_jsonb(p) from public.projects p where slug='baseline-adoption-fixture';",
);
cli([
  'migration',
  'repair',
  ...sources.map((source) => source.file.slice(0, 14)),
  '--status',
  'reverted',
  '--local',
]);
cli(['migration', 'repair', baselineVersion, '--status', 'applied', '--local']);
assert.equal(
  scalar("select to_jsonb(p) from public.projects p where slug='baseline-adoption-fixture';"),
  persistedBefore,
);
assert.deepEqual(catalog(), expected);
assert.equal(
  scalar(
    "select string_agg(version,',' order by version) from supabase_migrations.schema_migrations;",
  ),
  baselineVersion,
);
cli(['migration', 'up', '--local']);
sql("delete from public.projects where slug='baseline-adoption-fixture';");
record('verified_local_history_adoption_preserves_existing_content_and_future_migrations');

// Final reconstruction repeats the deployable path, with the real recovery prestate.
resetEmpty();
cli(['migration', 'up', '--local']);
seed();
assert.deepEqual(catalog(), expected);
record('final_empty_reconstruction_reproduces_the_verified_baseline');
const result = {
  base: 'c89ed9c0220cfbb088b55138279e4ba14eb54e29',
  baseline: baselineName,
  baseline_sha256: hash(baseline),
  source_count: sources.length,
  checks,
  observed_ddl_events: observed,
  canonical_catalog_sha256: hash(JSON.stringify(expected)),
  compared_sections: Object.keys(expected),
  differences,
  restore_tested: true,
  scope: 'local loopback only; remote not modified',
};
writeFileSync(
  new URL('../docs/checkpoints/initial-baseline-proof.json', import.meta.url),
  JSON.stringify(result, null, 2) + '\n',
);
console.log('Local baseline/recovery proof passed: ' + checks.length + ' groups.');
