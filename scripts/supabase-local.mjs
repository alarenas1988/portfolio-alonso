import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const commands = {
  start: ['start'],
  reset: ['db', 'reset', '--local'],
  lint: ['db', 'lint', '--local', '--schema', 'public,private', '--fail-on', 'warning'],
  test: ['test', 'db', '--local'],
};
const action = process.argv[2];
if (!Object.hasOwn(commands, action) || process.argv.length !== 3) {
  throw new Error('Use a documented local DB command without additional arguments.');
}
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const result = spawnSync(process.execPath, [cli, ...commands[action]], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  windowsHide: true,
  // The CLI prints local credentials on start. Capture stdout to avoid disclosing them.
  stdio: ['ignore', 'pipe', 'inherit'],
});
if (action !== 'start') process.stdout.write(result.stdout ?? '');
if (result.status !== 0) {
  console.error('Local Supabase command failed.');
  process.exit(result.status ?? 1);
}
if (action === 'start')
  console.log('Local Supabase is running; credentials are omitted from this log.');
