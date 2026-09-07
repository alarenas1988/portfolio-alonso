import { endpoint, json, type SafeLog } from '../_shared/http.ts';
import { object, choice, uuid } from '../_shared/validation.ts';
import { EdgeError, invalid } from '../_shared/errors.ts';
import { dispatchConfigured } from '../_shared/github.ts';
import { accepted } from '../_shared/repository.ts';
import type { EdgeConfig } from '../_shared/env.ts';
import type { Runtime } from '../_shared/runtime.ts';
export function publishSite(
  getConfig: () => EdgeConfig,
  runtime: Runtime,
  log?: (entry: SafeLog) => void,
) {
  return endpoint(
    'publish-site',
    getConfig,
    async (request, text, config) => {
      const { db, ownerId } = await runtime.authorize(request, 'user');
      if (!ownerId) throw new EdgeError(403, 'forbidden');
      const body = object(json(text), [
        'request_id',
        'trigger_type',
        'entity_type',
        'entity_id',
        'retry_of',
      ]);
      const trigger = choice(body.trigger_type, ['manual', 'content_change', 'retry'] as const);
      if (
        (body.entity_type === undefined) !== (body.entity_id === undefined) ||
        (trigger === 'retry') !== (body.retry_of !== undefined)
      )
        invalid();
      const input = {
        p_request_id: uuid(body.request_id),
        p_actor: ownerId,
        p_trigger: trigger,
        ...(body.entity_type !== undefined
          ? {
              p_entity_type: choice(body.entity_type, [
                'project',
                'post',
                'experience',
                'settings',
                'media',
                'document',
                'profile',
                'contact',
                'technology',
              ] as const),
              p_entity_id: uuid(body.entity_id),
            }
          : {}),
        ...(body.retry_of !== undefined ? { p_retry_of: uuid(body.retry_of) } : {}),
      };
      dispatchConfigured(config); // No queued orphan when F11 credentials are absent.
      const result = accepted(await db.requestBuild(input));
      if (!result.build_id || !result.status) throw new EdgeError(502, 'temporary_failure');
      if (result.dispatch) {
        try {
          await runtime.dispatch(config, result.build_id);
        } catch (error) {
          const timeout = error instanceof EdgeError && error.status === 504;
          if (timeout) {
            // GitHub may have accepted the dispatch. Preserve queued/idempotency until
            // an authenticated observer or the bounded reconciliation finds the run.
            return {
              status: 202,
              data: {
                build_id: result.build_id,
                status: 'queued',
                dispatch_status: 'pending_verification',
              },
            };
          }
          await db.dispatchFailed(result.build_id, 'dispatch_failed');
          throw new EdgeError(502, 'temporary_failure');
        }
      }
      return { status: 202, data: { build_id: result.build_id, status: result.status } };
    },
    log,
  );
}
