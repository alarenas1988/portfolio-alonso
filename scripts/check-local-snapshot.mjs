import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parsePublicSnapshot } from '../src/lib/content/parse-snapshot.ts';

// Fixed local Docker container. Never reads .env.local or contacts the remote project.
const container = 'supabase_db_portfolio-alonso-local';
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-Atq',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  {
    input: 'select public.get_public_snapshot();',
    encoding: 'utf8',
    windowsHide: true,
  },
);
if (result.status !== 0) throw new Error('Local PostgreSQL snapshot query failed.');
const snapshot = parsePublicSnapshot(JSON.parse(result.stdout));
assert.equal(snapshot.settings?.brand_short, 'AL');
assert.equal(snapshot.categories.length, 9);
assert.equal(snapshot.specialties.length, 6);
assert.equal(snapshot.principles.length, 4);
assert.equal(snapshot.projects.length, 0);
assert.equal(snapshot.posts.length, 0);
assert.equal(snapshot.impact_metrics.length, 0);
const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
const repeated = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-Atq',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  {
    input: 'begin;\n' + seed + '\n' + seed + '\nselect public.get_public_snapshot();\nrollback;',
    encoding: 'utf8',
    windowsHide: true,
  },
);
if (repeated.status !== 0) throw new Error('Local seed idempotency check failed.');
const replayed = parsePublicSnapshot(JSON.parse(repeated.stdout.trim()));
assert.deepEqual({ ...snapshot, generated_at: '' }, { ...replayed, generated_at: '' });
console.log('Real PostgreSQL seed snapshot passes the DTO contract; seed replay is idempotent.');
