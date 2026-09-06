import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { cli, cliJson, verifyProject, verifyLink, ref, sql } from './edge-remote.mjs';
if (process.argv[2] !== '--deploy-contact-f9')
  throw new Error('Explicit --deploy-contact-f9 required after reviewing the recorded local gate.');
const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0);
  return r.stdout.trim();
};
assert.equal(git('branch', '--show-current'), 'feat/f9-edge-functions');
assert.equal(
  git('status', '--porcelain'),
  '',
  'Commit permanent changes before remote deployment.',
);
const gate = JSON.parse(readFileSync('.tools/f9/local-gate.json', 'utf8'));
assert.equal(gate.commit, git('rev-parse', 'HEAD'));
assert(gate.checks.length >= 16 && gate.checks.every((check) => check.passed));
verifyProject();
verifyLink();
const before = JSON.parse(readFileSync('.tools/f9/remote-preflight.json', 'utf8'));
assert.deepEqual(before.state.history, ['20260906001900']);
assert.equal(before.state.cron.available, '1.6.4');
assert.equal(before.state.f9_conflicts, 0);
assert.equal(before.state.automatic_rls[0].enabled, 'O');
const catalog = cliJson(['db', 'query', '--linked', '--file', 'scripts/audit-remote-readiness.sql'])
  .rows[0].audit;
assert(
  isDeepStrictEqual(catalog, JSON.parse(readFileSync('.tools/f9/remote-pre-catalog.json', 'utf8'))),
  'Remote catalog changed since review.',
);
assert.deepEqual(cliJson(['functions', 'list', '--project-ref', ref]), []);
assert.deepEqual(cliJson(['secrets', 'list', '--project-ref', ref]), []);
for (const migration of before.migrations)
  assert.equal(
    createHash('sha256')
      .update(readFileSync('supabase/migrations/' + migration.name))
      .digest('hex'),
    migration.sha256,
  );
const backup = JSON.parse(readFileSync('.tools/f9/backup-manifest.json', 'utf8'));
for (const file of backup.files)
  assert.equal(
    createHash('sha256')
      .update(
        readFileSync(
          join(process.env.LOCALAPPDATA, 'portfolio-alonso/backups/20260906-f9-edge', file.name),
        ),
      )
      .digest('hex'),
    file.sha256,
  );
const dry = JSON.parse(cli(['db', 'push', '--linked', '--dry-run', '--skip-vault']));
assert.deepEqual(
  dry.migrations,
  before.migrations.map((migration) => migration.name),
);
assert.deepEqual(dry.seeds, []);
assert.deepEqual(dry.roles, []);
writeFileSync(
  '.tools/f9/deploy-gate.json',
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
  '.tools/f9/push.json',
  JSON.stringify({ date: new Date().toISOString(), result: push }, null, 2),
);
const history = sql(
  'select version from supabase_migrations.schema_migrations order by version;',
).map((row) => row.version);
assert.deepEqual(history, ['20260906001900', '20260906002000', '20260906002100']);
const secretsPath = join(
  process.env.LOCALAPPDATA,
  'portfolio-alonso/backups/20260906-f9-edge/provision-edge.env',
);
const settings = {
  CONTACT_RATE_LIMIT_HMAC_SECRET: randomBytes(32).toString('hex'),
  ANALYTICS_HMAC_SECRET: randomBytes(32).toString('hex'),
  PORTFOLIO_SITE_URL: 'https://alarenas1988.github.io/portfolio-alonso/',
  PORTFOLIO_ALLOWED_ORIGINS:
    'https://alarenas1988.github.io,http://localhost:4321,http://127.0.0.1:4321',
  CONTACT_GLOBAL_HOURLY_LIMIT: '100',
};
writeFileSync(
  secretsPath,
  Object.entries(settings)
    .map(([key, value]) => key + '=' + value)
    .join('\n') + '\n',
  { flag: 'wx' },
);
try {
  cli(['secrets', 'set', '--project-ref', ref, '--env-file', secretsPath]);
} finally {
  unlinkSync(secretsPath);
}
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
  configured_names: Object.keys(settings),
  form_enabled: false,
};
writeFileSync('.tools/f9/deployed.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
