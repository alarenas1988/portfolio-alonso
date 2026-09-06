import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.ts';
import { getVerifiedUser } from './session.ts';

export interface OwnerIdentity {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

/** UX guard only. Every DB operation is independently authorized by grants and RLS. */
export async function requireOwner(client: SupabaseClient<Database>): Promise<OwnerIdentity> {
  const user = await getVerifiedUser(client);
  const { data, error } = await client
    .from('admin_profiles')
    .select('id, display_name, avatar_url, role, active')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data || data.id !== user.id || !data.active || data.role !== 'owner') {
    throw new Error('Portfolio owner access required.');
  }
  return Object.freeze({ id: data.id, displayName: data.display_name, avatarUrl: data.avatar_url });
}
