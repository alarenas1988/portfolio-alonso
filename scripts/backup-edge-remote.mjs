import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cli, verifyProject, verifyLink } from './edge-remote.mjs';
if (process.argv[2] !== '--backup-f9') throw new Error('Explicit --backup-f9 required.');
verifyProject();
verifyLink();
const folder = resolve(process.env.LOCALAPPDATA, 'portfolio-alonso/backups/20260906-f9-edge');
if (!existsSync(folder))
  throw new Error('Create the private backup directory with restricted Windows ACL first.');
const manifest = [];
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
  if (existsSync(path)) throw new Error('Refusing to overwrite a previous recovery artifact.');
  cli(['db', 'dump', '--linked', ...flags, '--file', path], 300000);
  const data = readFileSync(path);
  manifest.push({
    name,
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  });
}
const evidence = {
  date: new Date().toISOString(),
  location: '%LOCALAPPDATA%/portfolio-alonso/backups/20260906-f9-edge',
  files: manifest,
  scope:
    'Logical database roles/schema/data; managed vector tables excluded as in the approved initial checkpoint. Platform settings/catalog separately inventoried. No Storage bytes backup needed: no objects.',
  limitation:
    'Free plan has no managed restore available here. New dump has not been independently restored; use the tested initial-checkpoint recovery procedure in a compatible Supabase target.',
};
writeFileSync('.tools/f9/backup-manifest.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
