import type { EdgeConfig } from './env.ts';
import { EdgeError } from './errors.ts';
import type { Runtime } from './runtime.ts';
import type { Publication, PublishingRepository } from './publishing-repository.ts';
import { accepted, type EdgeRepository } from './repository.ts';

const repo = 'alarenas1988/portfolio-alonso';
const path = '.github/workflows/deploy-pages.yml';
const site = 'https://alarenas1988.github.io/portfolio-alonso/';
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EdgeError(502, 'temporary_failure');
  return value as RecordValue;
}
function rows(value: unknown): RecordValue[] {
  if (!Array.isArray(value) || value.length > 100) throw new EdgeError(502, 'temporary_failure');
  return value.map(record);
}
function instant(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    throw new EdgeError(502, 'temporary_failure');
  return new Date(value).toISOString();
}
function number(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new EdgeError(502, 'temporary_failure');
  return Number(value);
}

export function githubReader(config: EdgeConfig, transport = fetch) {
  if (
    `${config.githubOwner}/${config.githubRepo}` !== repo ||
    config.siteUrl !== site ||
    !config.githubToken
  )
    throw new EdgeError(503, 'not_configured');
  return async (suffix: string, publicMetadata = false): Promise<unknown> => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'portfolio-c2',
    };
    if (!publicMetadata) headers.Authorization = `Bearer ${config.githubToken}`;
    let response: Response;
    try {
      response = await transport(`https://api.github.com/repos/${repo}${suffix}`, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new EdgeError(503, 'temporary_failure');
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new EdgeError(503, 'temporary_failure');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new EdgeError(502, 'temporary_failure');
    let text = '',
      size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 1024 * 1024) {
          await reader.cancel();
          throw new EdgeError(502, 'temporary_failure');
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      return JSON.parse(text + decoder.decode());
    } catch {
      throw new EdgeError(502, 'temporary_failure');
    } finally {
      reader.releaseLock();
    }
  };
}

function verifyRun(run: RecordValue, build: Publication, requestedAttempt?: number) {
  if (
    record(run.repository).full_name !== repo ||
    run.path !== path ||
    run.head_branch !== 'main' ||
    run.event !== 'repository_dispatch' ||
    run.display_title !== `C2 ${build.id}` ||
    typeof run.head_sha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(run.head_sha) ||
    (build.github_run_id !== null && build.github_run_id !== run.id) ||
    (requestedAttempt !== undefined && requestedAttempt !== run.run_attempt) ||
    Date.parse(instant(run.created_at)) < Date.parse(build.created_at) - 300000
  )
    throw new EdgeError(409, 'conflict');
  number(run.id);
  number(run.run_attempt);
}

export async function observePublication(
  build: Publication,
  runId: number,
  attempt: number | undefined,
  phase: 'building' | 'finish' | 'reconcile',
  db: EdgeRepository,
  config: EdgeConfig,
  runtime: Runtime,
) {
  const get = githubReader(config, runtime.githubFetch);
  const run = record(await get(`/actions/runs/${runId}`));
  if (run.id !== runId) throw new EdgeError(409, 'conflict');
  verifyRun(run, build, attempt);
  const base = {
    p_build_id: build.id,
    p_run_id: number(run.id),
    p_run_attempt: number(run.run_attempt),
    p_commit_sha: String(run.head_sha),
    p_run_url: `https://github.com/${repo}/actions/runs/${run.id}`,
    p_started_at: instant(run.created_at),
  };
  if (phase === 'building') {
    if (run.status !== 'in_progress') throw new EdgeError(409, 'conflict');
    return accepted(await db.callback({ ...base, p_status: 'building' })).status;
  }
  const jobsResult = record(
    await get(`/actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100`),
  );
  if (Number(jobsResult.total_count) > 100) throw new EdgeError(503, 'temporary_failure');
  const jobs = rows(jobsResult.jobs);
  const deploy = jobs.find((job) => job.name === 'Deploy Pages');
  const buildJob = jobs.find((job) => job.name === 'Build approved main');
  if (
    deploy?.conclusion === 'success' &&
    rows(deploy.steps).some(
      (step) => step.name === 'Publish Pages artifact' && step.conclusion === 'success',
    )
  ) {
    // Deployment metadata is public for this public repository. The PAT only needs
    // Contents:write + Actions:read; no broader Deployments permission is requested.
    const deployments = rows(
      await get(`/deployments?environment=github-pages&sha=${run.head_sha}&per_page=100`, true),
    );
    for (const deployment of deployments
      .filter((d) => Date.parse(instant(d.created_at)) >= Date.parse(instant(run.created_at)))
      .slice(0, 10)) {
      const statuses = rows(
        await get(`/deployments/${number(deployment.id)}/statuses?per_page=100`, true),
      );
      if (
        statuses.some(
          (status) =>
            status.state === 'success' &&
            status.environment_url === site &&
            typeof status.log_url === 'string' &&
            status.log_url.startsWith(`https://github.com/${repo}/actions/runs/${runId}/`),
        )
      ) {
        return accepted(
          await db.callback({
            ...base,
            p_status: 'success',
            p_completed_at: instant(deploy.completed_at),
            p_deployment_id: String(deployment.id),
          }),
        ).status;
      }
    }
    throw new EdgeError(503, 'temporary_failure'); // Wait for actual Pages/environment confirmation.
  }
  const failure = jobs.find((job) =>
    ['failure', 'cancelled', 'timed_out'].includes(String(job.conclusion)),
  );
  if (run.status === 'completed' || (phase === 'finish' && failure)) {
    const conclusion = run.conclusion ?? failure?.conclusion;
    const reason =
      conclusion === 'cancelled'
        ? 'cancelled'
        : conclusion === 'timed_out'
          ? 'timeout'
          : buildJob?.conclusion !== 'success'
            ? 'build_failed'
            : 'deploy_failed';
    return accepted(
      await db.callback({
        ...base,
        p_status: 'failed',
        p_completed_at: instant(failure?.completed_at ?? run.updated_at),
        p_failure_reason: reason,
      }),
    ).status;
  }
  return build.status;
}

export async function reconcilePublications(
  db: EdgeRepository,
  publishing: PublishingRepository,
  config: EdgeConfig,
  runtime: Runtime,
) {
  const active = await publishing.active();
  let settled = 0;
  const get = githubReader(config, runtime.githubFetch);
  for (const build of active) {
    let runId = build.github_run_id;
    if (!runId) {
      const since = new Date(Date.parse(build.created_at) - 300000).toISOString();
      const result = record(
        await get(
          `/actions/workflows/deploy-pages.yml/runs?event=repository_dispatch&branch=main&created=${encodeURIComponent('>=' + since)}&per_page=100`,
        ),
      );
      // Truncated results cannot prove dispatch was lost; fail without expiring anything.
      if (Number(result.total_count) > 100) throw new EdgeError(503, 'temporary_failure');
      const matching = rows(result.workflow_runs)
        .filter((run) => run.display_title === `C2 ${build.id}`)
        .sort((a, b) => number(a.id) - number(b.id));
      runId = matching[0] ? number(matching[0].id) : null;
    }
    if (!runId) {
      if (runtime.now() - Date.parse(build.created_at) > 60 * 60 * 1000)
        settled += Number(await publishing.expire(build, 'dispatch_missing'));
      continue;
    }
    const status = await observePublication(
      build,
      runId,
      undefined,
      'reconcile',
      db,
      config,
      runtime,
    );
    if (['success', 'failed'].includes(String(status))) settled++;
    // GitHub availability failures never become a false failure/success. The workflow
    // has explicit timeouts; its terminal result is observed on the next successful sweep.
  }
  return { inspected: active.length, settled };
}
