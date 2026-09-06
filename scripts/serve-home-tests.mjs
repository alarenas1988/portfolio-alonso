import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { startHomeFixtureServer } from '../tests/fixtures/home-server.ts';

const fixture = await startHomeFixtureServer();
const env = {
  ...process.env,
  ...fixture.env,
  MEDIA_TEST_FIXTURE: '1',
  PUBLIC_ANALYTICS_ENABLED: 'false',
};
const astro = 'node_modules/astro/bin/astro.mjs';
const output = '.tools/home-e2e-dist';
const build = spawn(process.execPath, [astro, 'build', '--outDir', output], {
  env,
  stdio: 'inherit',
});
const [code] = await once(build, 'exit');
await fixture.close();
if (code !== 0) process.exit(code ?? 1);
if (fixture.requests.snapshot !== 1 || fixture.requests.assets !== 3 || fixture.requests.rejected)
  throw new Error('Offline Home build did not use the expected anonymous content contract.');
console.log('Fixture API stopped: browser tests now use only the static artifact.');
const preview = spawn(
  process.execPath,
  [astro, 'preview', '--outDir', output, '--host', '127.0.0.1', '--port', '4322'],
  { env, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => preview.kill(signal));
const [previewCode] = await once(preview, 'exit');
process.exitCode = previewCode ?? 0;
