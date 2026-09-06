import { createClient } from '@supabase/supabase-js';
import type { SupabasePublicConfig } from '../config/public.ts';
import type { Database } from '../../types/database.ts';
import { supabaseFetch } from './transport.ts';

/** Anonymous read client; no owner session or privileged key enters the SSG process. */
export function createBuildSupabase(config: SupabasePublicConfig) {
  return createClient<Database>(config.url, config.publishableKey, {
    global: { fetch: supabaseFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
