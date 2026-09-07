import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.ts';
import { EdgeError } from './errors.ts';

export type Publication = Database['public']['Tables']['site_builds']['Row'];
export interface PublishingRepository {
  get(id: string): Promise<Publication | null>;
  active(): Promise<Publication[]>;
  expire(row: Publication, reason: 'dispatch_missing' | 'timeout'): Promise<boolean>;
}
export function publishingRepository(client: SupabaseClient<Database>): PublishingRepository {
  return {
    async get(id) {
      const { data, error } = await client
        .from('site_builds')
        .select('*')
        .eq('id', id)
        .abortSignal(AbortSignal.timeout(8000))
        .maybeSingle();
      if (error) throw new EdgeError(503, 'temporary_failure');
      return data;
    },
    async active() {
      const { data, error } = await client
        .from('site_builds')
        .select('*')
        .in('status', ['queued', 'building'])
        .order('created_at')
        .limit(20)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) throw new EdgeError(503, 'temporary_failure');
      return data;
    },
    async expire(row, reason) {
      // Compare-and-swap: never overwrite a callback arriving after the read.
      const { data, error } = await client
        .from('site_builds')
        .update({
          status: 'failed',
          failure_reason: reason,
          completed_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('updated_at', row.updated_at)
        .in('status', ['queued', 'building'])
        .select('id')
        .abortSignal(AbortSignal.timeout(8000));
      if (error) throw new EdgeError(503, 'temporary_failure');
      return Boolean(data?.length);
    },
  };
}
