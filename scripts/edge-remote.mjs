import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const env = parseEnv(readFileSync(new URL('../.env.local', import.meta.url), 'utf8'));
const url = new URL(env.PUBLIC_SUPABASE_URL);
if (url.protocol !== 'https:' || !/^([a-z]{20})\.supabase\.co$/.test(url.hostname))
  throw new Error('Expected configured hosted Supabase project.');
export const ref = url.hostname.split('.')[0];
/** CLI output may contain secrets. Callers explicitly select non-sensitive evidence. */
export function cli(args, timeout = 120000) {
  const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    // Deployment diagnostics contain bundler errors; preserve them after redaction.
    // Other commands (API keys, SQL) may carry private values and are never logged.
    if (args[0] === 'functions' && args[1] === 'deploy') {
      let diagnostic = (result.stdout || '') + (result.stderr || '');
      for (const value of Object.values(env))
        if (value) diagnostic = diagnostic.replaceAll(value, '[public-config-redacted]');
      diagnostic = diagnostic
        .replaceAll(ref, '[project-ref]')
        .replace(
          /(?:sb_secret_|sbp_|ghp_|github_pat_)[A-Za-z0-9_-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+/g,
          '[credential-redacted]',
        );
      mkdirSync('.tools/f9', { recursive: true });
      writeFileSync('.tools/f9/deployment-error-' + Date.now() + '.log', diagnostic);
    }
    throw new Error(
      'Supabase CLI operation failed: ' + args.slice(0, 2).join(' ') + '; details withheld.',
    );
  }
  return result.stdout;
}
export function cliJson(args) {
  return JSON.parse(cli([...args, '-o', 'json']));
}
export function verifyProject() {
  const projects = cliJson(['projects', 'list']);
  const project = projects.find((project) => project.id === ref);
  if (
    !project ||
    project.name !== 'portfolio-alonso' ||
    project.region !== 'sa-east-1' ||
    project.status !== 'ACTIVE_HEALTHY'
  )
    throw new Error('Remote project identity/state does not match the approved target.');
  return { name: project.name, region: project.region, status: project.status };
}
export function verifyLink() {
  const path = new URL('../supabase/.temp/project-ref', import.meta.url);
  if (!existsSync(path) || readFileSync(path, 'utf8').trim() !== ref)
    throw new Error('Link the verified configured project before remote operations.');
}
export function sql(statement) {
  verifyLink();
  const result = cliJson(['db', 'query', '--linked', statement]);
  return result.rows;
}
