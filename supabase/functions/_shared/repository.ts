import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.ts';
import { EdgeError } from './errors.ts';
type Functions = Database['public']['Functions'];
export type ContactCommand = Functions['edge_record_contact']['Args'];
export type EventCommand = Functions['edge_record_event']['Args'];
export type BuildCommand = Functions['edge_request_build']['Args'];
export type CallbackCommand = Functions['edge_update_build_status']['Args'];
export type BuildStatus = 'queued' | 'building' | 'success' | 'failed';
export interface OperationResult {
  outcome:
    'accepted' | 'conflict' | 'unavailable' | 'limited' | 'forbidden' | 'invalid' | 'missing';
  created?: boolean;
  retry_after?: number;
  build_id?: string;
  status?: BuildStatus;
  dispatch?: boolean;
  duplicate?: boolean;
}
export interface EdgeRepository {
  contact(input: ContactCommand): Promise<OperationResult>;
  event(input: EventCommand): Promise<OperationResult>;
  requestBuild(input: BuildCommand): Promise<OperationResult>;
  callback(input: CallbackCommand): Promise<OperationResult>;
  dispatchFailed(id: string, reason: 'dispatch_failed' | 'dispatch_timeout'): Promise<void>;
  notification(id: string, status: 'sent' | 'failed'): Promise<void>;
}
function result(value: unknown): OperationResult {
  if (
    !value ||
    typeof value !== 'object' ||
    !('outcome' in value) ||
    !['accepted', 'conflict', 'unavailable', 'limited', 'forbidden', 'invalid', 'missing'].includes(
      String(value.outcome),
    )
  )
    throw new EdgeError(502, 'temporary_failure');
  return value as OperationResult;
}
export function repository(client: SupabaseClient<Database>): EdgeRepository {
  async function operation(query: PromiseLike<{ data: unknown; error: unknown }>) {
    const response = await query;
    if (response.error) throw new EdgeError(503, 'temporary_failure');
    return result(response.data);
  }
  return {
    contact: (input) =>
      operation(client.rpc('edge_record_contact', input).abortSignal(AbortSignal.timeout(8000))),
    event: (input) =>
      operation(client.rpc('edge_record_event', input).abortSignal(AbortSignal.timeout(8000))),
    requestBuild: (input) =>
      operation(client.rpc('edge_request_build', input).abortSignal(AbortSignal.timeout(8000))),
    callback: (input) =>
      operation(
        client.rpc('edge_update_build_status', input).abortSignal(AbortSignal.timeout(8000)),
      ),
    async dispatchFailed(id, reason) {
      const { error } = await client
        .rpc('edge_dispatch_failed', { p_build_id: id, p_reason: reason })
        .abortSignal(AbortSignal.timeout(8000));
      if (error) throw new EdgeError(503, 'temporary_failure');
    },
    async notification(id, status) {
      const { error } = await client
        .from('contact_messages')
        .update({ notification_status: status })
        .eq('submission_id', id)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) throw new EdgeError(503, 'temporary_failure');
    },
  };
}
export function accepted(value: OperationResult) {
  if (value.outcome === 'limited')
    throw new EdgeError(429, 'rate_limited', value.retry_after || 60);
  if (value.outcome === 'conflict') throw new EdgeError(409, 'conflict');
  if (value.outcome === 'unavailable') throw new EdgeError(503, 'not_configured');
  if (value.outcome === 'forbidden') throw new EdgeError(403, 'forbidden');
  if (value.outcome === 'invalid') throw new EdgeError(400, 'invalid_request');
  if (value.outcome === 'missing') throw new EdgeError(404, 'not_found');
  return value;
}
