import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync, mkdirSync, copyFileSync, readdirSync, cpSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import assert from 'node:assert/strict';
import { localStatus, localSql, cli, root } from './edge-local.mjs';

// Destructive only to the explicitly guarded, disposable local testing stack.
// A clean start also avoids a CLI reset race in managed Realtime/Logflare schemas.
// Existing stack may already be stopped after a prior failed CLI initialization.
try {
  localStatus();
} catch {
  /* Config and the fixed project ID still guard stop/start. */
}
const temporary = resolve(root, '.tools/f7/upgrade-' + Date.now());
assert.ok(relative(root, temporary).startsWith('.tools'));
const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
assert.match(config, /project_id = "portfolio-alonso-baseline-local"/);
assert.match(config, /port = 58422/);
mkdirSync(join(temporary, 'supabase/migrations'), { recursive: true });
writeFileSync(join(temporary, 'supabase/config.toml'), config);
copyFileSync(resolve(root, 'supabase/seed.sql'), join(temporary, 'supabase/seed.sql'));
cpSync(resolve(root, 'supabase/functions'), join(temporary, 'supabase/functions'), {
  recursive: true,
});
mkdirSync(join(temporary, 'src/types'), { recursive: true });
copyFileSync(resolve(root, 'src/types/database.ts'), join(temporary, 'src/types/database.ts'));
const migrations = readdirSync(resolve(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();
assert.ok(migrations.length >= 5);
assert.ok(migrations[4].startsWith('20260906002300_'));
for (const file of migrations.slice(0, 4))
  copyFileSync(
    resolve(root, 'supabase/migrations', file),
    join(temporary, 'supabase/migrations', file),
  );
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, [cli, ...args, '--workdir', cwd], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const diagnostic = ((result.stdout || '') + (result.stderr || '') + String(result.error || ''))
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]')
      .replace(/(?:sb_secret_|sb_publishable_|sbp_)[\w-]+/g, '[redacted]')
      .replace(/postgresql:\/\/[^\s]+/g, '[local-db-url]');
    writeFileSync(resolve(root, '.tools/f7/upgrade-failure.log'), diagnostic);
    throw new Error('Local migration operation failed; see ignored sanitized upgrade-failure.log.');
  }
}
console.log('Recreating only the baseline-local test stack with immutable 019/020/021/022 copies.');
run(['stop', '--no-backup']);
run(['start'], temporary);
assert.equal(
  localSql('select max(version) from supabase_migrations.schema_migrations;'),
  '20260906002200',
);
const project = randomUUID(),
  child = randomUUID();
localSql(
  `insert into public.projects(id,title,slug) values('${project}','F7 local upgrade','f7-upgrade');insert into public.project_features(id,project_id,title) values('${child}','${project}','Preserved relation');`,
);
const revision = localSql(`select updated_at from public.projects where id='${project}';`);
console.log('Applying 023 to existing 022 with editorial parent and child.');
copyFileSync(
  resolve(root, 'supabase/migrations', migrations[4]),
  join(temporary, 'supabase/migrations', migrations[4]),
);
run(['migration', 'up', '--local'], temporary);
assert.equal(
  localSql('select max(version) from supabase_migrations.schema_migrations;'),
  '20260906002300',
);
assert.equal(localSql(`select updated_at from public.projects where id='${project}';`), revision);
assert.equal(
  localSql(`select title from public.project_features where id='${child}';`),
  'Preserved relation',
);
localSql(`update public.project_features set title='Updated relation' where id='${child}';`);
assert.notEqual(
  localSql(`select updated_at from public.projects where id='${project}';`),
  revision,
);
console.log(
  'Upgrade passed. Reconstructing the complete worktree schema from an empty local volume.',
);
run(['stop', '--no-backup'], temporary);
run(['start']);
assert.equal(
  localSql('select count(*) from supabase_migrations.schema_migrations;'),
  String(migrations.length),
);
assert.equal(localSql('select count(*) from public.analytics_events;'), '0');
writeFileSync(
  resolve(root, '.tools/f7/upgrade.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      source: '019/020/021/022 + existing editorial parent and child',
      destination: '023',
      editorial_data_preserved: true,
      child_advances_parent_revision: true,
      fixtures_removed: true,
      subsequent_clean_rebuild: true,
    },
    null,
    2,
  ),
);
console.log('Local upgrade and subsequent clean 019/020/021/022/023 + seed rebuild verified.');
