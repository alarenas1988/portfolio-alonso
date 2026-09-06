import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adminRoutes } from '../src/lib/admin/routes.ts';
export function checkAdminStatic(directory = 'dist', forbidden = []) {
  const root = resolve(directory);
  assert(!relative(process.cwd(), root).startsWith('..'), 'Output must be within this worktree.');
  for (const route of adminRoutes) {
    const html = readFileSync(join(root, 'admin', route, 'index.html'), 'utf8');
    assert.match(html, /name="robots" content="noindex,nofollow"/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, 'One static H1 in ' + route);
    assert(!html.includes('data-analytics-endpoint'), 'Admin must not initialize public tracking.');
  }
  let count = 0;
  function walk(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(html|js|json)$/.test(entry.name)) {
        const source = readFileSync(path, 'utf8');
        for (const value of forbidden.filter((v) => typeof v === 'string' && v.length > 5))
          assert(
            !source.includes(value),
            'Private fixture value present in static output (value withheld).',
          );
        count++;
      }
    }
  }
  walk(root);
  return { admin_routes: adminRoutes.length, artifacts: count, private_canaries: forbidden.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(checkAdminStatic());
