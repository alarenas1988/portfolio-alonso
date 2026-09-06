import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { baselineName, generateBaseline, hash } from './baseline-model.mjs';

// Catalog comparison is read-only. The executable forward SQL is the versioned baseline,
// already applied under a DDL observer to a restoration of this remote prestate.
if (process.argv.length !== 2) throw new Error('No targets or extra arguments accepted.');
const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
const before = read('docs/checkpoints/initial-remote-catalog.json');
const after = read('.tools/baseline-reference.json');
const proof = read('docs/checkpoints/initial-baseline-proof.json');
const baseline = generateBaseline();
assert.equal(hash(baseline), proof.baseline_sha256);
assert.equal(hash(JSON.stringify(after)), proof.canonical_catalog_sha256);
assert.deepEqual(proof.differences, []);
assert.equal(proof.restore_tested, true);
assert.equal(before.relations, null);
assert.equal(before.buckets, null);
assert.equal(before.schemas.length, 1);
assert.deepEqual(
  before.schemas[0],
  after.schemas.find((schema) => schema.name === 'public'),
);
assert.equal(before.functions.length, 1);
assert.equal(before.functions[0].name, 'rls_auto_enable');
assert.deepEqual(
  before.functions[0],
  after.functions.find((fn) => fn.name === 'rls_auto_enable'),
);
assert.deepEqual(before.automatic_rls, after.automatic_rls);
assert.deepEqual(before.managed_storage, after.managed_storage);
const changes = before.defaults.filter((entry) => {
  const target = after.defaults.find(
    (value) =>
      value.role === entry.role && value.schema === entry.schema && value.kind === entry.kind,
  );
  return target?.acl !== entry.acl;
});
assert.equal(changes.length, 1);
assert.equal(changes[0].role, 'postgres');
assert.equal(changes[0].schema, 'public');
assert.equal(changes[0].kind, 'r');
assert.equal(
  after.defaults.find(
    (entry) => entry.role === 'postgres' && entry.schema === 'public' && entry.kind === 'r',
  ).acl,
  '{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}',
);
assert.equal(/alter table\s+(auth|storage)\./i.test(baseline), false);
assert.equal(/references\s+storage\.objects\s*\(\s*bucket_id/i.test(baseline), false);
assert.equal(
  /(?:drop|alter|create(?: or replace)?)\s+(?:event trigger|function)\s+(?:public\.)?(?:ensure_rls|rls_auto_enable)/i.test(
    baseline,
  ),
  false,
);
const expectedRemovals = baseline
  .split('\n')
  .map((line) => line.trim())
  .filter((line) =>
    /^drop (policy|view|function|index)\b|^alter table public\.[a-z_]+ drop constraint\b/i.test(
      line,
    ),
  );
const result = {
  direction: 'actual remote prestate -> initial portfolio baseline',
  method: 'catalog comparison and exact forward SQL replay against restored remote prestate',
  sql: 'supabase/migrations/' + baselineName,
  sql_sha256: hash(baseline),
  removed_preexisting_application_objects: [],
  managed_storage_structure_unchanged: true,
  automatic_rls_function_owner_acl_body_and_event_unchanged: true,
  public_schema_unchanged: true,
  application_tables: after.relations.filter((relation) => ['r', 'p'].includes(relation.kind))
    .length,
  tables_without_rls: after.relations.filter(
    (relation) => ['r', 'p'].includes(relation.kind) && !relation.rls,
  ).length,
  views: after.views.length,
  policies: after.policies.length,
  storage_policies: after.policies
    .filter((policy) => policy.schemaname === 'storage')
    .map((policy) => ({ name: policy.policyname, operation: policy.cmd })),
  buckets: after.buckets,
  constraints: after.constraints.length,
  indexes: after.indexes.length,
  default_privilege_change:
    'Revoke anon/authenticated default table privileges owned by postgres in public; no change to managed role defaults or sequence defaults.',
  expected_internal_replacements: expectedRemovals,
  replacement_scope:
    'Only objects created earlier inside this same transaction; no pre-existing objects are dropped.',
  remote_sql_executed: false,
};
writeFileSync(
  new URL('../docs/checkpoints/initial-forward-diff.json', import.meta.url),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  'Forward review passed: no pre-existing object removal; Automatic RLS and managed Storage preserved.',
);
