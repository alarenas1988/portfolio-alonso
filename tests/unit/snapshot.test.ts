import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PublicSnapshot } from '../../src/types/content.ts';
import { parsePublicSnapshot } from '../../src/lib/content/parse-snapshot.ts';
import { loadPublicSnapshot } from '../../src/lib/content/snapshot.ts';
import { createBuildSupabase } from '../../src/lib/supabase/build.ts';

function emptySnapshot(): PublicSnapshot {
  return {
    schema_version: 1,
    generated_at: '2026-09-06T00:00:00Z',
    settings: null,
    contact: null,
    social_links: [],
    projects: [],
    project_features: [],
    project_images: [],
    project_metrics: [],
    project_challenges: [],
    project_technologies: [],
    posts: [],
    categories: [],
    post_category_relations: [],
    tags: [],
    post_tags: [],
    experiences: [],
    experience_highlights: [],
    experience_projects: [],
    experience_technologies: [],
    technologies: [],
    specialties: [],
    principles: [],
    impact_metrics: [],
    media_assets: [],
    media_references: [],
    documents: [],
  };
}
function testClient() {
  return createBuildSupabase({
    url: 'http://127.0.0.1:54321',
    publishableKey: 'sb_publishable_test_not_a_credential',
  });
}

it('accepts an empty RLS-filtered snapshot without inventing content', () => {
  assert.deepEqual(parsePublicSnapshot(emptySnapshot()).projects, []);
});
it('rejects private tables, unknown versions, missing collections and malformed timestamps', () => {
  const snapshot = emptySnapshot();
  for (const invalid of [
    { ...snapshot, admin_activity: [] },
    { ...snapshot, schema_version: 2 },
    { ...snapshot, projects: null },
    { ...snapshot, generated_at: 'yesterday' },
    { ...snapshot, generated_at: 0 },
    null,
  ])
    assert.throws(() => parsePublicSnapshot(invalid), /Invalid public snapshot contract/);
  const { tags: _tags, ...missing } = snapshot;
  assert.equal(_tags.length, 0);
  assert.throws(() => parsePublicSnapshot(missing));
});
it('rejects administrative fields on media, wrong scalar types and unsafe integer precision', () => {
  const media = {
    id: '00000000-0000-0000-0000-000000000001',
    public_url: 'https://example.com/test.png',
    filename: 'test.png',
    mime_type: 'image/png',
    file_size: 123,
    width: null,
    height: null,
    alt_text: null,
    caption: null,
    category: 'general',
    visibility: 'public',
  };
  assert.equal(
    parsePublicSnapshot({ ...emptySnapshot(), media_assets: [media] }).media_assets.length,
    1,
  );
  for (const invalid of [
    { ...media, created_by: 'private-owner-id' },
    { ...media, file_size: '123' },
    { ...media, file_size: Number.MAX_SAFE_INTEGER + 1 },
    { ...media, id: 'not-a-uuid' },
  ])
    assert.throws(() => parsePublicSnapshot({ ...emptySnapshot(), media_assets: [invalid] }));
});
it('loads through exactly one anonymous RPC with validated DTO output', async (context) => {
  const requests: string[] = [];
  context.mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(String(input));
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), null);
    assert.equal(headers.get('apikey'), 'sb_publishable_test_not_a_credential');
    return Promise.resolve(
      new Response(JSON.stringify(emptySnapshot()), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  const snapshot = await loadPublicSnapshot(testClient());
  assert.equal(snapshot.schema_version, 1);
  assert.deepEqual(requests, ['http://127.0.0.1:54321/rest/v1/rpc/get_public_snapshot']);
});
it('aborts on RPC errors without leaking server details or using privileged fallback', async (context) => {
  let calls = 0;
  context.mock.method(globalThis, 'fetch', () => {
    calls++;
    return Promise.resolve(
      new Response(JSON.stringify({ message: 'PRIVATE_SERVER_DETAIL', code: '42501' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  await assert.rejects(loadPublicSnapshot(testClient()), {
    message: 'Public snapshot query failed.',
  });
  assert.equal(calls, 1);
});
it('rejects a successful HTTP response with a broken snapshot contract', async (context) => {
  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response('{"schema_version":1}', {
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  await assert.rejects(loadPublicSnapshot(testClient()), /Invalid public snapshot contract/);
});
