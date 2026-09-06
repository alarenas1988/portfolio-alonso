import { access, readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { listFiles } from './files.mjs';
import { getBuildConfig } from '../src/lib/config/build.ts';

const directory = resolve(process.argv[2] || 'dist');
const config = getBuildConfig('production');
const base = config.base;
await access(resolve(directory, 'index.html'));
await access(resolve(directory, '404.html'));
const htmlFiles = (await listFiles(directory)).filter((file) => extname(file) === '.html');
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const required of [
    /<!doctype html>/i,
    /<html\b[^>]*lang="es"/i,
    /<title>.+?<\/title>/i,
    /name="viewport"/,
    /<main\b/,
    /<h1\b/,
  ]) {
    if (!required.test(html))
      throw new Error(`Missing document structure in ${relative(directory, file)}.`);
  }
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(href)) continue;
    if (!href.startsWith(base))
      throw new Error(`Link outside site base in ${relative(directory, file)}.`);
    const pathname = href.split(/[?#]/)[0];
    const relativeAsset = decodeURIComponent(pathname.slice(base.length));
    const target = resolve(directory, relativeAsset || 'index.html');
    if (relative(directory, target).startsWith('..'))
      throw new Error('Artifact link escapes output directory.');
    await access(extname(target) ? target : resolve(target, 'index.html'));
  }
}
console.log(`Static output passed: ${htmlFiles.length} HTML documents; base ${base}.`);
