import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { startHomeFixtureServer } from '../tests/fixtures/home-server.ts';

// Isolated contract fixture: PRs need neither a remote database nor production secrets.
const fixture = await startHomeFixtureServer('full');
try {
  const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    env: {
      ...process.env,
      ...fixture.env,
      MEDIA_TEST_FIXTURE: '0',
      PUBLIC_ANALYTICS_ENABLED: 'false',
    },
    stdio: 'inherit',
  });
  const [code] = await once(child, 'exit');
  if (code !== 0) process.exitCode = code ?? 1;
  else if (
    fixture.requests.snapshot !== 1 ||
    fixture.requests.assets !== 3 ||
    fixture.requests.rejected
  )
    throw new Error('CI build did not respect the public snapshot and media contract.');
} finally {
  await fixture.close();
}
