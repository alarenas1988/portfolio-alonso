import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { cli, cliJson, verifyProject, verifyLink, ref, sql } from './edge-remote.mjs';
import { verifyRemoteContactSource } from './verify-contact-source.mjs';
if (process.argv[2] !== '--deploy-f10')
  throw new Error('Explicit --deploy-f10 required after the full local gate.');
const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0);
  return r.stdout.trim();
};
assert.equal(git('branch', '--show-current'), 'feat/f10-first-party-analytics');
assert.equal(git('status', '--porcelain'), '', 'Commit permanent work before deployment.');
const gate = JSON.parse(readFileSync('.tools/f10/local-gate.json', 'utf8'));
assert.equal(gate.commit, git('rev-parse', 'HEAD'));
assert(gate.checks.length >= 20 && gate.checks.every((c) => c.passed));
verifyProject();
verifyLink();
const before = JSON.parse(readFileSync('.tools/f10/remote-preflight.json', 'utf8'));
const catalog = cliJson(['db', 'query', '--linked', '--file', 'scripts/audit-remote-readiness.sql'])
  .rows[0].audit;
assert.deepEqual(
  catalog,
  JSON.parse(readFileSync('.tools/f10/remote-pre-catalog.json', 'utf8')),
  'Remote catalog changed since inspection.',
);
assert.equal(
  createHash('sha256')
    .update(readFileSync('supabase/migrations/' + before.migration))
    .digest('hex'),
  before.sha256,
);
const names = cliJson(['secrets', 'list', '--project-ref', ref])
  .map((s) => s.name)
  .sort();
assert.deepEqual(names, before.secret_names, 'Secret configuration changed since review.');
assert(names.includes('ANALYTICS_HMAC_SECRET'));
assert(
  !names.includes('ANALYTICS_RATE_LIMIT_HMAC_SECRET'),
  'Do not overwrite an existing rate HMAC.',
);
const backup = JSON.parse(readFileSync('.tools/f10/backup-manifest.json', 'utf8'));
const folder = join(process.env.LOCALAPPDATA, 'portfolio-alonso/backups/20260906-f10-analytics');
for (const file of backup.files)
  assert.equal(
    createHash('sha256')
      .update(readFileSync(join(folder, file.name)))
      .digest('hex'),
    file.sha256,
  );
const dry = JSON.parse(cli(['db', 'push', '--linked', '--dry-run', '--skip-vault']));
assert.deepEqual(dry.migrations, [before.migration]);
assert.deepEqual(dry.seeds, []);
assert.deepEqual(dry.roles, []);
writeFileSync(
  '.tools/f10/deploy-gate.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      commit: gate.commit,
      dry_run: dry,
      catalog_unchanged: true,
      backup_verified: true,
    },
    null,
    2,
  ),
);
const push = JSON.parse(cli(['db', 'push', '--linked', '--skip-vault', '--yes'], 300000));
writeFileSync(
  '.tools/f10/push.json',
  JSON.stringify({ date: new Date().toISOString(), result: push }, null, 2),
);
const history = sql(
  'select version from supabase_migrations.schema_migrations order by version;',
).map((r) => r.version);
assert.deepEqual(history, ['20260906001900', '20260906002000', '20260906002100', '20260906002200']);
const path = join(folder, 'provision-analytics.env');
writeFileSync(path, 'ANALYTICS_RATE_LIMIT_HMAC_SECRET=' + randomBytes(32).toString('hex') + '\n', {
  flag: 'wx',
});
try {
  cli(['secrets', 'set', '--project-ref', ref, '--env-file', path]);
} finally {
  unlinkSync(path);
}
cli(['functions', 'deploy', 'track-event', '--project-ref', ref, '--use-api'], 300000);
const functions = cliJson(['functions', 'list', '--project-ref', ref]).map((f) => ({
  slug: f.slug,
  status: f.status,
  version: f.version,
  verify_jwt: f.verify_jwt,
}));
assert.equal(functions.length, 2);
assert.equal(functions.find((f) => f.slug === 'contact-submit').status, 'ACTIVE');
verifyRemoteContactSource();
assert.equal(functions.find((f) => f.slug === 'track-event').status, 'ACTIVE');
assert.equal(functions.find((f) => f.slug === 'track-event').verify_jwt, false);
const result = {
  date: new Date().toISOString(),
  history,
  functions,
  secret_added: 'ANALYTICS_RATE_LIMIT_HMAC_SECRET',
  secret_reused: 'ANALYTICS_HMAC_SECRET',
  contact_redeployed: false,
};
writeFileSync('.tools/f10/deployed.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
