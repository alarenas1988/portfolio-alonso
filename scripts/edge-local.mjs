import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const cli = fileURLToPath(
  new URL('../node_modules/supabase/dist/supabase.js', import.meta.url),
);
export const container = 'supabase_db_portfolio-alonso-baseline-local';
let verified = false;
export function localStatus() {
  const result = spawnSync(process.execPath, [cli, 'status', '-o', 'json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Start the local Supabase stack first.');
  const status = JSON.parse(result.stdout);
  if (
    status.API_URL !== 'http://127.0.0.1:58421' ||
    new URL(status.DB_URL).hostname !== '127.0.0.1' ||
    new URL(status.DB_URL).port !== '58422'
  )
    throw new Error('Edge integration tests only accept the isolated loopback stack.');
  return status;
}
export function localSql(input) {
  if (!verified) {
    localStatus();
    verified = true;
  }
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
    { input, encoding: 'utf8', cwd: root, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.status !== 0)
    throw new Error(
      'Local fixture SQL failed: ' +
        result.stderr.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]'),
    );
  return result.stdout.trim();
}
export function prepareEdgeEnvironment() {
  localStatus();
  const path = new URL('../.env.edge.local', import.meta.url);
  if (!existsSync(path)) {
    const lines = [
      'PORTFOLIO_SITE_URL=https://alarenas1988.github.io/portfolio-alonso/',
      'PORTFOLIO_ALLOWED_ORIGINS=https://alarenas1988.github.io,http://localhost:4321,http://127.0.0.1:4321,http://127.0.0.1:4322,http://127.0.0.1:4339',
      'CONTACT_GLOBAL_HOURLY_LIMIT=100',
    ];
    for (const name of [
      'CONTACT_RATE_LIMIT_HMAC_SECRET',
      'ANALYTICS_HMAC_SECRET',
      'ANALYTICS_RATE_LIMIT_HMAC_SECRET',
      'BUILD_CALLBACK_HMAC_SECRET',
    ])
      lines.push(name + '=' + randomBytes(32).toString('hex'));
    writeFileSync(path, lines.join('\n') + '\n');
  }
  mkdirSync(new URL('../.tools/', import.meta.url), { recursive: true });
  return parseEnv(readFileSync(path, 'utf8'));
}
