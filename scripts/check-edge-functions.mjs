import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const bundle = process.argv.includes('--bundle-local');
for (const name of ['contact-submit', 'publish-site', 'build-status', 'track-event']) {
  const folder = 'supabase/functions/' + name;
  assert.deepEqual(
    JSON.parse(readFileSync(folder + '/deno.json', 'utf8')).imports,
    JSON.parse(readFileSync('supabase/functions/deno.json', 'utf8')).imports,
    'Deployment imports must match tested SDK versions.',
  );
  const result = spawnSync(
    process.execPath,
    ['node_modules/deno/bin.cjs', 'check', '--config', folder + '/deno.json', folder + '/index.ts'],
    { windowsHide: true, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status || 1);
  if (bundle) {
    const { localStatus } = await import('./edge-local.mjs');
    localStatus();
    const compiled = spawnSync(
      'docker',
      [
        'exec',
        'supabase_edge_runtime_portfolio-alonso-baseline-local',
        'edge-runtime',
        'bundle',
        '--entrypoint',
        resolve(folder, 'index.ts')
          .replace(/^[A-Za-z]:/, '')
          .replaceAll('\\', '/'),
        '--output',
        '/tmp/f9-' + name + '.eszip',
        '--timeout',
        '60',
      ],
      { windowsHide: true, stdio: 'inherit' },
    );
    if (compiled.status !== 0) process.exit(compiled.status || 1);
  }
}
console.log(
  'Four function-specific deployment configurations checked' +
    (bundle ? ' and bundled in the real local runtime.' : '.'),
);
