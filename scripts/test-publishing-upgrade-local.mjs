import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { localStatus, localSql, cli, root } from './edge-local.mjs';

// This harness destroys only the explicitly checked, disposable local test stack.
try {
  localStatus();
} catch {
  /* A prior start may have failed; fixed config still guards stop/start. */
}
const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
assert.match(config, /project_id = "portfolio-alonso-baseline-local"/);
assert.match(config, /port = 58422/);
const temp = resolve(root, '.tools/f11/upgrade-' + Date.now());
assert(relative(root, temp).startsWith('.tools'));
mkdirSync(join(temp, 'supabase/migrations'), { recursive: true });
writeFileSync(join(temp, 'supabase/config.toml'), config);
copyFileSync(resolve(root, 'supabase/seed.sql'), join(temp, 'supabase/seed.sql'));
cpSync(resolve(root, 'supabase/functions'), join(temp, 'supabase/functions'), { recursive: true });
mkdirSync(join(temp, 'src/types'), { recursive: true });
copyFileSync(resolve(root, 'src/types/database.ts'), join(temp, 'src/types/database.ts'));
const migrations = readdirSync(resolve(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();
assert.equal(migrations.length, 6);
assert(migrations[5].startsWith('20260907002400_'));
for (const file of migrations.slice(0, 5))
  copyFileSync(resolve(root, 'supabase/migrations', file), join(temp, 'supabase/migrations', file));
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, [cli, ...args, '--workdir', cwd], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const diagnostic = ((result.stdout || '') + (result.stderr || ''))
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]')
      .replace(/(?:sb_secret_|sb_publishable_|sbp_)[\w-]+/g, '[redacted]')
      .replace(/postgresql:\/\/[^\s]+/g, '[local-db-url]');
    writeFileSync(resolve(root, '.tools/f11/upgrade-failure.log'), diagnostic);
    throw new Error('Local migration operation failed; sanitized diagnostic remains ignored.');
  }
}
console.log('Recreating guarded local stack at approved migration 023.');
run(['stop', '--no-backup']);
run(['start'], temp);
assert.equal(
  localSql('select max(version) from supabase_migrations.schema_migrations;'),
  '20260906002300',
);
const owner = randomUUID(),
  request = randomUUID();
localSql(`insert into auth.users(id) values('${owner}');
  insert into public.admin_profiles(id,display_name,role,active) values('${owner}','F11 upgrade fixture','owner',true);
  set role service_role; select public.edge_request_build('${request}','${owner}','manual'); reset role;`);
const before = localSql(
  `select row_to_json(b) from public.site_builds b where request_id='${request}';`,
);
const security = localSql(
  "select prosecdef,proowner,proacl,proconfig from pg_proc where oid='public.edge_request_build(uuid,uuid,text,text,uuid,uuid)'::regprocedure;",
);
copyFileSync(
  resolve(root, 'supabase/migrations', migrations[5]),
  join(temp, 'supabase/migrations', migrations[5]),
);
run(['migration', 'up', '--local'], temp);
assert.equal(
  localSql(`select row_to_json(b) from public.site_builds b where request_id='${request}';`),
  before,
);
assert.equal(
  localSql(
    "select prosecdef,proowner,proacl,proconfig from pg_proc where oid='public.edge_request_build(uuid,uuid,text,text,uuid,uuid)'::regprocedure;",
  ),
  security,
);
assert.match(
  localSql(
    `set role service_role; select public.edge_request_build('${request}','${owner}','manual')->>'dispatch'; reset role;`,
  ),
  /false/,
);
console.log(
  '024 upgrade preserved pending build, request identity, owner, ACL and invoker security.',
);
run(['stop', '--no-backup'], temp);
run(['start']);
assert.equal(localSql('select count(*) from supabase_migrations.schema_migrations;'), '6');
assert.equal(localSql('select count(*) from public.site_builds;'), '0');
assert.equal(localSql('select count(*) from auth.users;'), '0');
writeFileSync(
  resolve(root, '.tools/f11/upgrade.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      upgrade: '023 -> 024',
      pending_build_preserved: true,
      security_unchanged: true,
      clean_install: migrations,
      fixtures_remaining: 0,
    },
    null,
    2,
  ),
);
console.log('Clean installation of 019 through 024 and seed passed; no upgrade fixtures remain.');
