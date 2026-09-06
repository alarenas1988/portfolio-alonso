import type { PublicConfig } from '../config/public.ts';
import type { SnapshotClient } from '../supabase/queries.ts';
import { loadPublicSnapshot } from './snapshot.ts';
import { buildSnapshotAssets } from '../media/build-assets.ts';
import { createPublicModel } from './home.ts';

// One promise per build: every route and getStaticPaths sees the same snapshot and artifact.
// A failed promise remains failed; there is no fallback to an earlier deployment.
const builds = new Map<string, ReturnType<typeof prepare>>();
async function prepare(config: PublicConfig, outputDirectory: string, client?: SnapshotClient) {
  if (!config.supabase) throw new Error('Public Supabase configuration is required.');
  const snapshot = await loadPublicSnapshot(client);
  const assets = await buildSnapshotAssets(snapshot, {
    supabaseUrl: config.supabase.url,
    outputDirectory,
    base: config.base,
  });
  return createPublicModel(snapshot, assets, config.siteUrl);
}
export function loadPublicPages(
  config: PublicConfig,
  outputDirectory: string,
  client?: SnapshotClient,
) {
  // Explicit clients are isolated tests; development reloads on request for editorial feedback.
  if (client || import.meta.env?.DEV) return prepare(config, outputDirectory, client);
  const key = JSON.stringify([outputDirectory, config.siteUrl, config.supabase?.url]);
  let result = builds.get(key);
  if (!result) {
    result = prepare(config, outputDirectory);
    builds.set(key, result);
  }
  return result;
}
