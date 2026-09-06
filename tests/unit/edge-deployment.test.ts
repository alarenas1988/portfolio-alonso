import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('each deployed function carries its own pinned import map and lock, without relying on parent config', () => {
  for (const name of ['contact-submit', 'publish-site', 'build-status', 'track-event']) {
    const folder = new URL('../../supabase/functions/' + name + '/', import.meta.url);
    const config = JSON.parse(readFileSync(new URL('deno.json', folder), 'utf8'));
    const lock = JSON.parse(readFileSync(new URL('deno.lock', folder), 'utf8'));
    assert.equal(config.imports['@supabase/server'], 'npm:@supabase/server@1.5.3');
    assert.equal(config.imports['@supabase/supabase-js'], 'npm:@supabase/supabase-js@2.115.0');
    assert.equal(
      lock.specifiers['npm:@supabase/server@1.5.3'],
      '1.5.3_@supabase+supabase-js@2.115.0',
    );
    assert(Object.keys(lock.npm).length > 0);
  }
});
