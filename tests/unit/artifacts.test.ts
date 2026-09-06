import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';

it('rejects a private key in generated HTML without logging its value', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-secret-test-'));
  const secret = 'sb_secret_canary_not_a_real_key';
  try {
    await writeFile(join(directory, 'index.html'), `<p>${secret}</p>`);
    const result = spawnSync(process.execPath, ['scripts/check-secrets.mjs', directory], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /index\.html/);
    assert.equal(result.stderr.includes(secret), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('accepts public configuration but rejects an arbitrary supplied private canary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-canary-test-'));
  try {
    await writeFile(join(directory, 'index.html'), '<p>sb_publishable_test_only</p>');
    const clean = spawnSync(process.execPath, ['scripts/check-secrets.mjs', directory], {
      encoding: 'utf8',
    });
    assert.equal(clean.status, 0, clean.stderr);
    await writeFile(join(directory, 'index.html'), '<p>private-callback-canary-value</p>');
    const leaked = spawnSync(process.execPath, ['scripts/check-secrets.mjs', directory], {
      encoding: 'utf8',
      env: { ...process.env, BUILD_CALLBACK_SECRET: 'private-callback-canary-value' },
    });
    assert.equal(leaked.status, 1);
    assert.equal(leaked.stderr.includes('private-callback-canary-value'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const [name, value] of [
  ['SUPABASE_ACCESS_TOKEN', 'private-supabase-access-canary'],
  ['SUPABASE_SECRET_KEYS', '{"default":"private-supabase-dictionary-canary"}'],
] as const) {
  it(`rejects the ${name} canary without logging its value`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'portfolio-private-env-test-'));
    try {
      await writeFile(join(directory, 'index.html'), `<p>${value}</p>`);
      const result = spawnSync(process.execPath, ['scripts/check-secrets.mjs', directory], {
        encoding: 'utf8',
        env: { ...process.env, [name]: value },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stderr.includes(value), false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

it('rejects a Supabase personal access token pattern', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-supabase-pat-test-'));
  try {
    await writeFile(join(directory, 'index.html'), '<p>sbp_1234567890abcdefghijklmnop</p>');
    const result = spawnSync(process.execPath, ['scripts/check-secrets.mjs', directory], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes('sbp_1234567890abcdefghijklmnop'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('fails static validation when a referenced stylesheet is missing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-static-test-'));
  try {
    const html =
      '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width"><title>AL</title><link rel="stylesheet" href="/portfolio-alonso/_astro/site.css"></head><body><main><h1>AL</h1></main></body></html>';
    await writeFile(join(directory, 'index.html'), html);
    await writeFile(join(directory, '404.html'), html);
    const run = () =>
      spawnSync(process.execPath, ['scripts/check-static-output.mjs', directory], {
        encoding: 'utf8',
        env: { ...process.env, PUBLIC_SITE_URL: 'https://example.com/portfolio-alonso/' },
      });
    assert.equal(run().status, 1);
    await mkdir(join(directory, '_astro'));
    await writeFile(join(directory, '_astro/site.css'), 'body{color:white}');
    const valid = run();
    assert.equal(valid.status, 0, valid.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
