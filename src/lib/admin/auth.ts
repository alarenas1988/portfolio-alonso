import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.ts';
import type { OwnerIdentity } from '../auth/owner.ts';
export type AdminAccess =
  { state: 'anonymous' | 'denied' | 'error' } | { state: 'owner'; owner: OwnerIdentity };
/** A fresh server-verified identity plus an RLS-filtered profile; metadata never authorizes. */
export async function resolveAdminAccess(client: SupabaseClient<Database>): Promise<AdminAccess> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error)
      return {
        state:
          error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403
            ? 'anonymous'
            : 'error',
      };
    if (!data.user) return { state: 'anonymous' };
    const profile = await client
      .from('admin_profiles')
      .select('id,display_name,avatar_url,active,role')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profile.error) return { state: 'error' };
    const p = profile.data;
    // RLS deliberately makes absent and inactive profiles indistinguishable to their callers.
    if (!p || p.id !== data.user.id || p.role !== 'owner' || p.active !== true)
      return { state: 'denied' };
    return {
      state: 'owner',
      owner: { id: p.id, displayName: p.display_name, avatarUrl: p.avatar_url },
    };
  } catch {
    return { state: 'error' };
  }
}
