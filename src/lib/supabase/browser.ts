import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicConfig } from '../config/public.ts';
import type { Database } from '../../types/database.ts';
import { supabaseFetch } from './transport.ts';

let client: SupabaseClient<Database> | undefined;

/** Loaded only by future admin scripts, never by the public bootstrap page. */
export function getBrowserSupabase(): SupabaseClient<Database> {
  if (typeof window === 'undefined')
    throw new Error('Browser Supabase client cannot run during build.');
  const { supabase } = getPublicConfig();
  if (!supabase)
    throw new Error('Supabase is not configured. Complete the public variables in .env.local.');
  client ??= createClient<Database>(supabase.url, supabase.publishableKey, {
    global: {
      fetch: (input, init) => {
        const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
        return supabaseFetch(input, {
          ...init,
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        });
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return client;
}
