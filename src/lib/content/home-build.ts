import type { PublicConfig } from '../config/public.ts';
import type { SnapshotClient } from '../supabase/queries.ts';
import { loadPublicPages } from './public-build.ts';
import { homeFromPublic } from './home.ts';

export async function loadHomePage(
  config: PublicConfig,
  outputDirectory: string,
  client?: SnapshotClient,
) {
  return homeFromPublic(await loadPublicPages(config, outputDirectory, client));
}
