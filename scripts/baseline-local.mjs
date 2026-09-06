import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { historicalSources } from './baseline-model.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const container = 'supabase_db_portfolio-alonso-baseline-local';
export const legacyWorkdir = fileURLToPath(new URL('../.tools/legacy-f8/', import.meta.url));
export const cliPath = fileURLToPath(
  new URL('../node_modules/supabase/dist/supabase.js', import.meta.url),
);

export function cli(args, { workdir = root, expectFailure = false } = {}) {
  if (args.some((arg) => ['--linked', '--db-url', '--project-ref'].includes(arg)))
    throw new Error('Remote CLI targets are forbidden in the local baseline harness.');
  const result = spawnSync(process.execPath, [cliPath, ...args, '--workdir', workdir], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 && !expectFailure) {
    // CLI responses can contain connection credentials; keep diagnostics local and ignored.
    mkdirSync(new URL('../.tools/', import.meta.url), { recursive: true });
    writeFileSync(
      new URL('../.tools/baseline-cli-error.log', import.meta.url),
      (result.stderr ?? '') + (result.stdout ?? ''),
    );
    throw new Error(
      'Local CLI failed: ' +
        args.slice(0, 2).join(' ') +
        '; inspect ignored .tools/baseline-cli-error.log',
    );
  }
  return result;
}

export function assertLocal() {
  const status = JSON.parse(cli(['status', '-o', 'json']).stdout);
  if (
    status.API_URL !== 'http://127.0.0.1:58421' ||
    new URL(status.DB_URL).hostname !== '127.0.0.1' ||
    new URL(status.DB_URL).port !== '58422'
  )
    throw new Error('Only the isolated baseline loopback stack is permitted.');
}

export function sql(input, { expectFailure = false } = {}) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atq',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (result.status !== 0 && !expectFailure) {
    mkdirSync(new URL('../.tools/', import.meta.url), { recursive: true });
    writeFileSync(
      new URL('../.tools/baseline-sql-error.log', import.meta.url),
      result.stderr ?? '',
    );
    throw new Error('Local baseline SQL failed; inspect ignored .tools/baseline-sql-error.log');
  }
  return result;
}

export function stageLegacy({ includeIdentity = true } = {}) {
  const dir = new URL('../.tools/legacy-f8/supabase/', import.meta.url);
  mkdirSync(new URL('migrations/', dir), { recursive: true });
  for (const source of historicalSources()) {
    const target = new URL('migrations/' + source.file, dir);
    if (!includeIdentity && source.file === '20260906001800_storage_object_identity.sql') {
      // Exact generated staging file only; immutable archive is never removed.
      if (existsSync(target)) unlinkSync(target);
    } else writeFileSync(target, source.sql);
  }
  for (const file of ['config.toml', 'seed.sql'])
    copyFileSync(new URL('../supabase/' + file, import.meta.url), new URL(file, dir));
  // Only the fixed project's config is copied; no remote link/cache or credentials.
  const config = readFileSync(new URL('config.toml', dir), 'utf8');
  if (!config.includes('project_id = "portfolio-alonso-baseline-local"'))
    throw new Error('Unexpected staged project.');
  return legacyWorkdir;
}
