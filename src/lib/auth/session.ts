import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../types/database.ts';

export type AuthClient = Pick<SupabaseClient<Database>, 'auth'>;

/** Verify with Supabase Auth; getSession/localStorage alone is never authorization. */
export async function getVerifiedUser(client: AuthClient): Promise<User> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Authentication required.');
  return data.user;
}
