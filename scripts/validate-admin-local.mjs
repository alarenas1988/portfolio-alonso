import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const mode = process.argv[2];
assert(
  ['npm', 'database'].includes(mode),
  'Choose npm or database validation; never a remote target.',
);
const npm =
  process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
assert(existsSync(npm), 'Use the pinned Node/npm installation.');
const commands =
  mode === 'npm'
    ? [
        ['ci'],
        ['ls', '--depth=0'],
        ['audit', '--audit-level=high'],
        ...[
          'format:check',
          'lint',
          'typecheck',
          'test',
          'build',
          'check:static',
          'check:secrets',
          'test:e2e',
        ].map((s) => ['run', s]),
      ]
    : [
        'db:lint',
        'db:test',
        'db:types:check',
        'db:snapshot:check',
        'test:auth:local',
        'test:media:local',
        'edge:check',
        'test:edge',
        'test:edge:http',
        'test:analytics:local',
        'test:contact:local',
      ].map((s) => ['run', s]);
mkdirSync('.tools/f7', { recursive: true });
const resume = process.argv[3] === '--resume-format' && mode === 'npm';
const checks = resume
  ? JSON.parse(readFileSync('.tools/f7/npm-checks.json', 'utf8')).checks.slice(0, 3)
  : [];
assert(checks.every((c) => c.passed));
if (resume) commands.splice(0, 3);
for (const args of commands) {
  const name = args.join(' '),
    started = Date.now();
  console.log('Checking npm ' + name);
  const result = spawnSync(process.execPath, [npm, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
    timeout: 1200000,
  });
  const log = '.tools/f7/' + args.join('-').replaceAll(':', '-') + '.log';
  writeFileSync(log, (result.stdout || '') + (result.stderr || ''));
  checks.push({ name, passed: result.status === 0, milliseconds: Date.now() - started, log });
  writeFileSync(
    '.tools/f7/' + mode + '-checks.json',
    JSON.stringify({ date: new Date().toISOString(), checks }, null, 2),
  );
  assert.equal(result.status, 0, 'Validation failed: ' + name + '; inspect ' + log);
  console.log('Passed ' + name);
}
