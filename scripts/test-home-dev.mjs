import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { startHomeFixtureServer, fixtureKey } from '../tests/fixtures/home-server.ts';

const reservation = createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const fixture = await startHomeFixtureServer();
let log = '';
const child = spawn(
  process.execPath,
  [
    'node_modules/astro/bin/astro.mjs',
    'dev',
    '--ignore-lock',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--outDir',
    '.tools/home-dev-dist',
  ],
  {
    env: { ...process.env, ...fixture.env, MEDIA_TEST_FIXTURE: '0', ASTRO_DEV_BACKGROUND: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
child.stdout.on('data', (chunk) => {
  log += chunk;
});
child.stderr.on('data', (chunk) => {
  log += chunk;
});
const stopped = once(child, 'exit');
try {
  for (let attempt = 0; !log.includes('Local') && attempt < 120; attempt++) {
    if (child.exitCode !== null)
      throw new Error(
        'Astro dev exited before readiness: ' + log.replaceAll(fixtureKey, '[fixture-key]'),
      );
    await delay(500);
  }
  const origin = `http://127.0.0.1:${port}`;
  const response = await fetch(origin + '/portfolio-alonso/', {
    signal: globalThis.AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  const urls = [
    ...new Set(
      [
        ...html.matchAll(
          /(?:src|href)="(\/portfolio-alonso\/assets\/media\/[a-f0-9]{64}\.(?:png|pdf))"/g,
        ),
      ].map((match) => match[1]),
    ),
  ];
  assert.equal(urls.length, 3);
  for (const url of urls) {
    const asset = await fetch(origin + url, { signal: globalThis.AbortSignal.timeout(10000) });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/png|application\/pdf/);
    assert((await asset.arrayBuffer()).byteLength > 0);
  }
  assert.equal(fixture.requests.snapshot, 1);
  assert.equal(fixture.requests.assets, 3);
  assert.equal(fixture.requests.rejected, 0);
  assert(!log.includes(fixtureKey));
  console.log(
    'Astro dev: anonymous fixture snapshot and three F8 assets served under the site base.',
  );
} finally {
  child.kill();
  await stopped;
  await fixture.close();
}
