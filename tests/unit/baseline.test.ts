import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { generateBaseline, historicalSources } from '../../scripts/baseline-model.mjs';

test('active installation never creates a foreign key to managed Storage non-PK columns', () => {
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  const sql = readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => readFileSync(new URL(name, directory), 'utf8'))
    .join('\n');
  assert.equal(/references\s+storage\.objects\s*\(\s*bucket_id\s*,\s*name\s*\)/i.test(sql), false);
});

test('initial baseline keeps restrictive UUID integrity and has no managed table DDL', () => {
  const sql = generateBaseline();
  assert.match(sql, /references storage\.objects\(id\)\s+on update restrict on delete restrict/i);
  assert.equal(/alter table\s+(storage|auth)\./i.test(sql), false);
  assert.equal(/storage_object_fk/.test(sql), false);
  assert.equal(/^begin;$/gm.test(sql), true);
  assert.equal((sql.match(/^commit;$/gm) ?? []).length, 1);
});

test('baseline generator fails closed when transformation anchors change', () => {
  const sources = historicalSources();
  const changed = sources.map((source) => ({
    ...source,
    sql: source.sql.replace('media_assets_storage_object_fk', 'unexpected_constraint'),
  }));
  assert.throws(() => generateBaseline(changed), /transformation no longer matches/);
});
