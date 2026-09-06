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
const temporary = resolve(root, '.tools/f10/upgrade-' + Date.now());
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
assert.equal(migrations.length, 4);
assert.ok(migrations[3].startsWith('20260906002200_'));
for (const file of migrations.slice(0, 3))
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
    writeFileSync(resolve(root, '.tools/f10/upgrade-failure.log'), diagnostic);
    throw new Error('Local migration operation failed; see ignored sanitized upgrade-failure.log.');
  }
}
console.log('Recreating only the baseline-local test stack with immutable 019/020/021 copies.');
run(['stop', '--no-backup']);
run(['start'], temporary);
assert.equal(
  localSql('select max(version) from supabase_migrations.schema_migrations;'),
  '20260906002100',
);
const event = randomUUID();
localSql(
  `insert into public.analytics_events(event_id,session_hash,event_type,pathname) values('${event}',repeat('8',64),'page_view','/portfolio-alonso/');`,
);
console.log('Applying 022 to the existing 021 schema containing one synthetic event.');
copyFileSync(
  resolve(root, 'supabase/migrations', migrations[3]),
  join(temporary, 'supabase/migrations', migrations[3]),
);
run(['migration', 'up', '--local'], temporary);
assert.equal(
  localSql('select max(version) from supabase_migrations.schema_migrations;'),
  '20260906002200',
);
localSql('set role service_role;select public.refresh_analytics();reset role;');
assert.equal(localSql('select sum(page_views) from public.analytics_daily;'), '1');
assert.equal(
  localSql(`select count(*) from public.analytics_events where event_id='${event}';`),
  '1',
);
localSql(`delete from public.analytics_events where event_id='${event}';`);
console.log(
  'Upgrade passed. Reconstructing the complete worktree schema from an empty local volume.',
);
run(['stop', '--no-backup'], temporary);
run(['start']);
assert.equal(localSql('select count(*) from supabase_migrations.schema_migrations;'), '4');
assert.equal(localSql('select count(*) from public.analytics_events;'), '0');
writeFileSync(
  resolve(root, '.tools/f10/upgrade.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      source: '019/020/021 + existing raw event',
      destination: '022',
      raw_preserved: true,
      aggregate_correct: true,
      fixtures_removed: true,
      subsequent_clean_rebuild: true,
    },
    null,
    2,
  ),
);
console.log('Local upgrade and subsequent clean 019/020/021/022 + seed rebuild verified.');
