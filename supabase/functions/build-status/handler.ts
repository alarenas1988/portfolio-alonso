import { endpoint, json, type SafeLog } from '../_shared/http.ts';
import { object, choice, uuid, string, integer, instant } from '../_shared/validation.ts';
import { invalid } from '../_shared/errors.ts';
import { verifyCallback } from '../_shared/crypto.ts';
import { accepted } from '../_shared/repository.ts';
import type { EdgeConfig } from '../_shared/env.ts';
import type { Runtime } from '../_shared/runtime.ts';
import { observePublication, reconcilePublications } from '../_shared/publishing.ts';
import { EdgeError } from '../_shared/errors.ts';
export function buildStatus(
  getConfig: () => EdgeConfig,
  runtime: Runtime,
  log?: (entry: SafeLog) => void,
) {
  return endpoint(
    'build-status',
    getConfig,
    async (request, text, config) => {
      await verifyCallback(request, text, config.callbackSecret, runtime.now());
      const decoded = json(text);
      if (decoded && typeof decoded === 'object' && 'action' in decoded) {
        const command = object(
          decoded,
          decoded.action === 'reconcile'
            ? ['action']
            : ['action', 'build_id', 'run_id', 'run_attempt', 'phase', 'repository'],
        );
        const action = choice(command.action, ['observe', 'reconcile'] as const);
        const { db, publishing } = await runtime.authorize(request, 'none');
        if (!publishing) throw new EdgeError(503, 'not_configured');
        if (action === 'reconcile')
          return { data: await reconcilePublications(db, publishing, config, runtime) };
        if (command.repository !== 'alarenas1988/portfolio-alonso') invalid();
        const build = await publishing.get(uuid(command.build_id));
        if (!build) throw new EdgeError(404, 'not_found');
        const status = await observePublication(
          build,
          integer(command.run_id, 1, Number.MAX_SAFE_INTEGER),
          integer(command.run_attempt, 1, 1000),
          choice(command.phase, ['building', 'finish'] as const),
          db,
          config,
          runtime,
        );
        return { data: { status } };
      }
      const body = object(decoded, [
        'build_id',
        'status',
        'run_id',
        'run_attempt',
        'commit_sha',
        'started_at',
        'completed_at',
        'deployment_id',
        'deployment_url',
        'failure_reason',
      ]);
      const status = choice(body.status, ['building', 'success', 'failed'] as const);
      const sha = string(body.commit_sha, 40, 64);
      if (!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)) invalid();
      const runId = integer(body.run_id, 1, Number.MAX_SAFE_INTEGER);
      const started = instant(body.started_at);
      if (
        (status === 'building') !== (body.completed_at === undefined) ||
        (status === 'success') !== (body.deployment_id !== undefined) ||
        (status === 'failed') !== (body.failure_reason !== undefined)
      )
        invalid();
      if (
        body.deployment_url !== undefined &&
        (status !== 'success' || body.deployment_url !== config.siteUrl)
      )
        invalid();
      const deployment =
        body.deployment_id !== undefined ? string(body.deployment_id, 1, 200) : undefined;
      if (deployment && !/^[a-zA-Z0-9_-]+$/.test(deployment)) invalid();
      const completed = body.completed_at !== undefined ? instant(body.completed_at) : undefined;
      if (
        Date.parse(started) > runtime.now() + 30000 ||
        (completed &&
          (Date.parse(completed) < Date.parse(started) ||
            Date.parse(completed) > runtime.now() + 30000))
      )
        invalid();
      const { db } = await runtime.authorize(request, 'none');
      const result = accepted(
        await db.callback({
          p_build_id: uuid(body.build_id),
          p_status: status,
          p_run_id: runId,
          p_run_attempt: integer(body.run_attempt, 1, 1000),
          p_commit_sha: sha,
          p_started_at: started,
          p_run_url: `https://github.com/${config.githubOwner}/${config.githubRepo}/actions/runs/${runId}`,
          ...(completed ? { p_completed_at: completed } : {}),
          ...(deployment ? { p_deployment_id: deployment } : {}),
          ...(body.failure_reason !== undefined
            ? {
                p_failure_reason: choice(body.failure_reason, [
                  'cancelled',
                  'superseded',
                  'timeout',
                  'build_failed',
                  'deploy_failed',
                ] as const),
              }
            : {}),
        }),
      );
      return { data: { status: result.status } };
    },
    log,
  );
}
