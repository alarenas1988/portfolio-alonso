import type { PublicConfig } from '../config/public.ts';
import type { SnapshotClient } from '../supabase/queries.ts';
import { loadPublicSnapshot } from './snapshot.ts';
import { buildSnapshotAssets } from '../media/build-assets.ts';
import { createHomeModel } from './home.ts';

export async function loadHomePage(
  config: PublicConfig,
  outputDirectory: string,
  client?: SnapshotClient,
) {
  if (!config.supabase) throw new Error('Public Supabase configuration is required to build Home.');
  const snapshot = await loadPublicSnapshot(client);
  const assets = await buildSnapshotAssets(snapshot, {
    supabaseUrl: config.supabase.url,
    outputDirectory,
    base: config.base,
  });
  return createHomeModel(snapshot, assets, config.siteUrl);
}
