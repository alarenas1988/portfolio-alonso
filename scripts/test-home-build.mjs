import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startHomeFixtureServer, fixtureKey } from '../tests/fixtures/home-server.ts';

for (const mode of ['full', 'empty', 'unavailable', 'incompatible', 'missing-asset']) {
  const fixture = await startHomeFixtureServer(mode);
  const directory = resolve('.tools', `home-build-${mode}`);
  let output = '';
  try {
    const result = await new Promise((done, reject) => {
      const child = spawn(
        process.execPath,
        ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', directory],
        {
          env: {
            ...process.env,
            ...fixture.env,
            MEDIA_TEST_FIXTURE: '0',
            PUBLIC_ANALYTICS_ENABLED: 'false',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
      child.on('error', reject);
      child.on('exit', done);
    });
    assert(!output.includes(fixtureKey), 'Build output must not expose its API key');
    assert.equal(fixture.requests.snapshot, 1);
    assert.equal(fixture.requests.rejected, 0);
    if (mode === 'full' || mode === 'empty') {
      assert.equal(result, 0, output);
      const html = await readFile(resolve(directory, 'index.html'), 'utf8');
      assert(!html.includes(fixtureKey));
      assert(
        !html.includes(fixture.origin),
        'Public artifact cannot depend on fixture API/Storage',
      );
      assert(!html.includes('__fixtures'));
      await assert.rejects(access(resolve(directory, '__fixtures')));
      for (const route of ['proyectos', 'blog', 'sobre-mi', 'contacto']) {
        const page = await readFile(resolve(directory, route, 'index.html'), 'utf8');
        assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
        // F9's enabled contact form intentionally embeds public API configuration.
        // Remove only those two exact data attributes; media/links must stay local.
        const staticPage =
          route === 'contacto'
            ? page
                .replace(`data-key="${fixtureKey}"`, '')
                .replace(`data-url="${fixture.origin}"`, '')
            : page;
        assert(!staticPage.includes(fixtureKey) && !staticPage.includes(fixture.origin));
      }
      const projectPaths = (
        await readdir(resolve(directory, 'proyectos'), { withFileTypes: true })
      ).filter((entry) => entry.isDirectory());
      const postPaths = (await readdir(resolve(directory, 'blog'), { withFileTypes: true })).filter(
        (entry) => entry.isDirectory(),
      );
      assert.equal(projectPaths.length, mode === 'full' ? 3 : 0);
      assert.equal(postPaths.length, mode === 'full' ? 4 : 0);
      for (const [resource, entries] of [
        ['proyectos', projectPaths],
        ['blog', postPaths],
      ]) {
        for (const entry of entries) {
          assert(!entry.name.startsWith('never-'));
          const page = await readFile(
            resolve(directory, resource, entry.name, 'index.html'),
            'utf8',
          );
          assert(!/PRIVATE_\w+_CANARY|FUTURE_\w+_CANARY|ARCHIVED_\w+_CANARY/.test(page));
          assert(!page.includes(fixture.origin) && !page.includes(fixtureKey));
        }
      }
      const manifest = JSON.parse(
        await readFile(resolve(directory, 'assets/media/manifest.json'), 'utf8'),
      );
      assert.equal(Object.keys(manifest.assets).length, mode === 'full' ? 3 : 0);
      if (mode === 'full') {
        assert.equal(fixture.requests.assets, 3);
        const formats = new Set(
          Object.values(manifest.assets).flatMap((asset) =>
            asset.variants.map((variant) => variant.format),
          ),
        );
        assert.deepEqual([...formats].sort(), ['avif', 'png', 'webp']);
      }
    } else {
      assert.notEqual(
        result,
        0,
        'An unavailable contract/required asset must stop production build',
      );
      await assert.rejects(access(resolve(directory, 'index.html')));
    }
    console.log(`Home production build: ${mode} — expected outcome verified.`);
  } finally {
    await fixture.close();
  }
}
