import type { PublicSnapshot } from '../../types/content.ts';
import { getPublicConfig } from '../config/public.ts';
import { createBuildSupabase } from '../supabase/build.ts';
import { queryPublicSnapshot, type SnapshotClient } from '../supabase/queries.ts';
import { parsePublicSnapshot } from './parse-snapshot.ts';

/** Build-only entrypoint. F3 will wire this into pages after F6 grants are verified. */
export async function loadPublicSnapshot(client?: SnapshotClient): Promise<PublicSnapshot> {
  if (!client) {
    const config = getPublicConfig().supabase;
    if (!config) throw new Error('Public Supabase configuration is required for content builds.');
    client = createBuildSupabase(config);
  }
  return parsePublicSnapshot(await queryPublicSnapshot(client));
}
