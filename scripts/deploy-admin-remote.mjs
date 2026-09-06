import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { cli, cliJson, verifyProject, verifyLink, ref, sql } from './edge-remote.mjs';
assert.equal(process.argv[2], '--deploy-f7', 'Explicit F7 deployment after local validation only.');
const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0);
  return r.stdout.trim();
};
assert.equal(git('branch', '--show-current'), 'feat/f7-admin-cms');
assert.equal(git('status', '--porcelain'), '', 'Commit permanent work before deployment.');
const gate = JSON.parse(readFileSync('.tools/f7/local-gate.json', 'utf8'));
assert.equal(gate.commit, git('rev-parse', 'HEAD'));
assert(gate.checks.length >= 25 && gate.checks.every((c) => c.passed));
verifyProject();
verifyLink();
const before = JSON.parse(readFileSync('.tools/f7/remote-preflight.json', 'utf8'));
const catalog = cliJson(['db', 'query', '--linked', '--file', 'scripts/audit-remote-readiness.sql'])
  .rows[0].audit;
assert.deepEqual(
  catalog,
  JSON.parse(readFileSync('.tools/f7/remote-pre-catalog.json', 'utf8')),
  'Remote catalog changed since reviewed preflight.',
);
const digest = (data) => createHash('sha256').update(data).digest('hex');
assert.equal(digest(readFileSync('supabase/migrations/' + before.migration)), before.sha256);
assert.deepEqual(
  cliJson(['secrets', 'list', '--project-ref', ref])
    .map((s) => s.name)
    .sort(),
  before.secret_names,
);
const backup = JSON.parse(readFileSync('.tools/f7/backup-manifest.json', 'utf8'));
const folder = join(process.env.LOCALAPPDATA, 'portfolio-alonso/backups/20260906-f7-admin');
for (const file of backup.files)
  assert.equal(digest(readFileSync(join(folder, file.name))), file.sha256);
const dry = JSON.parse(cli(['db', 'push', '--linked', '--dry-run', '--skip-vault']));
assert.deepEqual(dry.migrations, ['20260906002300_admin_editorial_transactions.sql']);
assert.deepEqual(dry.seeds, []);
assert.deepEqual(dry.roles, []);
writeFileSync(
  '.tools/f7/deploy-gate.json',
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
const result = JSON.parse(cli(['db', 'push', '--linked', '--skip-vault', '--yes'], 300000));
writeFileSync(
  '.tools/f7/push.json',
  JSON.stringify({ date: new Date().toISOString(), result }, null, 2),
);
const history = sql(
  'select version from supabase_migrations.schema_migrations order by version;',
).map((r) => r.version);
assert.deepEqual(history, [
  '20260906001900',
  '20260906002000',
  '20260906002100',
  '20260906002200',
  '20260906002300',
]);
console.log(
  'Only F7 migration 023 applied. No seed, Auth configuration, buckets, secrets or Edge deployments.',
);
