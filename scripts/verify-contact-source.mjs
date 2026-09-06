import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cli, ref } from './edge-remote.mjs';
/** Read-only source check: project-wide secrets may increment platform versions. */
export function verifyRemoteContactSource() {
  const base = 'e528078f19a245af7d56b00be6895e3af681777a';
  const folder = '.tools/f10/contact-source-' + Date.now();
  mkdirSync(folder + '/supabase', { recursive: true });
  writeFileSync(folder + '/supabase/config.toml', 'project_id = "f10-read-only-function-audit"\n');
  cli([
    'functions',
    'download',
    'contact-submit',
    '--project-ref',
    ref,
    '--use-api',
    '--workdir',
    folder,
  ]);
  const directory = folder + '/supabase/functions/';
  const results = [];
  for (const file of readdirSync(directory, { recursive: true }).filter(
    (file) => file.endsWith('.ts') || file.endsWith('.json'),
  )) {
    const path = 'supabase/functions/' + file.replaceAll('\\', '/');
    const original = spawnSync('git', ['show', base + ':' + path], {
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(original.status, 0, 'Unexpected deployed source path.');
    const deployed = readFileSync(directory + file, 'utf8').replaceAll('\r\n', '\n');
    assert.equal(
      deployed,
      original.stdout.replaceAll('\r\n', '\n'),
      'Deployed contact source changed: ' + path,
    );
    results.push({
      path,
      equal: true,
      sha256: createHash('sha256').update(deployed).digest('hex'),
    });
  }
  assert.equal(results.length, 14, 'Contact source inventory changed.');
  const evidence = { date: new Date().toISOString(), base, results, all_equal: true };
  writeFileSync('.tools/f10/contact-source-comparison.json', JSON.stringify(evidence, null, 2));
  return evidence;
}
