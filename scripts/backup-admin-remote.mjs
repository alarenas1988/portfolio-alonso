import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cli, verifyProject, verifyLink } from './edge-remote.mjs';
if (process.argv[2] !== '--backup-f7') throw new Error('Explicit --backup-f7 required.');
verifyProject();
verifyLink();
const folder = resolve(process.env.LOCALAPPDATA, 'portfolio-alonso/backups/20260906-f7-admin');
if (!existsSync(folder))
  throw new Error('Prepare the private backup directory with restricted Windows ACL first.');
const files = [];
for (const [name, flags] of [
  ['roles.sql', ['--role-only']],
  ['schema.sql', []],
  [
    'data.sql',
    [
      '--data-only',
      '--use-copy',
      '--exclude',
      'storage.buckets_vectors',
      '--exclude',
      'storage.vector_indexes',
    ],
  ],
]) {
  const path = join(folder, name);
  if (existsSync(path)) throw new Error('Refusing to overwrite a recovery artifact.');
  cli(['db', 'dump', '--linked', ...flags, '--file', path], 300000);
  const data = readFileSync(path);
  files.push({ name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
const evidence = {
  date: new Date().toISOString(),
  location: '%LOCALAPPDATA%/portfolio-alonso/backups/20260906-f7-admin',
  files,
  scope:
    'Logical roles/schema/data; excludes managed vector catalogs as in approved baseline backup. No Storage bytes; configuration inventoried separately.',
  limitation:
    'Free managed restore unavailable in approved checkpoint. This fresh logical backup has not been independently restored; use the previously tested compatible Supabase recovery procedure.',
};
writeFileSync('.tools/f7/backup-manifest.json', JSON.stringify(evidence, null, 2));
console.log('Private logical backup captured; manifest contains hashes, no data or credentials.');
