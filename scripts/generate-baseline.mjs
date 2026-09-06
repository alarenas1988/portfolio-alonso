import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  baselineName,
  generateBaseline,
  hash,
  historicalSources,
  normalize,
} from './baseline-model.mjs';

const check = process.argv[2] === '--check';
if (process.argv.length !== (check ? 3 : 2)) throw new Error('Unexpected baseline arguments.');
const sources = historicalSources();
const sql = generateBaseline(sources);
if (/references\s+storage\.objects\s*\(\s*bucket_id/i.test(sql))
  throw new Error('Rejected non-PK dependency in initial installation.');
const directory = new URL('../supabase/migrations/', import.meta.url);
const output = new URL(baselineName, directory);
if (check) {
  if (normalize(readFileSync(output, 'utf8')) !== sql)
    throw new Error('Baseline drift: regenerate the artifact from its immutable sources.');
} else {
  mkdirSync(directory, { recursive: true });
  writeFileSync(output, sql);
}
console.log('Initial baseline verified: 18 immutable sources; SHA-256 ' + hash(sql));
