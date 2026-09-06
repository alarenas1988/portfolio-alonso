import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { cli, cliJson, verifyProject, verifyLink, ref, sql } from './edge-remote.mjs';
const replace = process.argv[2] === '--replace-contact-f9';
if (process.argv[2] !== '--deploy-function-only-f9' && !replace)
  throw new Error('Explicit function-only F9 resume required. Does not push DB or set secrets.');
verifyProject();
verifyLink();
const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8', windowsHide: true });
assert.equal(status.status, 0);
assert.equal(status.stdout.trim(), '');
const head = spawnSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
  windowsHide: true,
}).stdout.trim();
const gate = JSON.parse(readFileSync('.tools/f9/function-bundle-gate.json', 'utf8'));
assert.equal(gate.commit, head);
assert(gate.local_bundle && gate.edge_tests && gate.http_tests && gate.unit_tests);
const history = sql(
  'select version from supabase_migrations.schema_migrations order by version;',
).map((row) => row.version);
assert.deepEqual(history, ['20260906001900', '20260906002000', '20260906002100']);
assert.equal(sql('select form_enabled from public.contact_settings;')[0].form_enabled, false);
const previousFunctions = cliJson(['functions', 'list', '--project-ref', ref]);
if (replace) {
  assert.equal(previousFunctions.length, 1);
  assert.equal(previousFunctions[0].slug, 'contact-submit');
  assert.equal(previousFunctions[0].status, 'ACTIVE');
  assert.equal(previousFunctions[0].version, 1);
} else assert.deepEqual(previousFunctions, []);
const names = cliJson(['secrets', 'list', '--project-ref', ref])
  .map((s) => s.name)
  .sort();
assert.deepEqual(
  names,
  [
    'ANALYTICS_HMAC_SECRET',
    'CONTACT_GLOBAL_HOURLY_LIMIT',
    'CONTACT_RATE_LIMIT_HMAC_SECRET',
    'PORTFOLIO_ALLOWED_ORIGINS',
    'PORTFOLIO_SITE_URL',
  ].sort(),
);
cli(['functions', 'deploy', 'contact-submit', '--project-ref', ref, '--use-api'], 300000);
const functions = cliJson(['functions', 'list', '--project-ref', ref]).map((f) => ({
  slug: f.slug,
  status: f.status,
  verify_jwt: f.verify_jwt,
  version: f.version,
}));
assert.equal(functions.length, 1);
assert.equal(functions[0].slug, 'contact-submit');
assert.equal(functions[0].status, 'ACTIVE');
const result = {
  date: new Date().toISOString(),
  history,
  functions,
  configured_names: names,
  form_enabled: false,
  function_only_resume: true,
};
writeFileSync('.tools/f9/deployed.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
