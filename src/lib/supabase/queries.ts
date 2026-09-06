import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.ts';

export type SnapshotClient = Pick<SupabaseClient<Database>, 'rpc'>;

/** One RPC provides a consistent statement-level snapshot, without privileged retries. */
export async function queryPublicSnapshot(client: SnapshotClient): Promise<unknown> {
  const { data, error } = await client.rpc('get_public_snapshot');
  if (error || data === null) throw new Error('Public snapshot query failed.');
  return data;
}
