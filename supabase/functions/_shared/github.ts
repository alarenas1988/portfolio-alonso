import type { EdgeConfig } from './env.ts';
import { EdgeError } from './errors.ts';
export function dispatchConfigured(config: EdgeConfig) {
  if (
    !config.githubToken ||
    !/^[a-zA-Z0-9_.-]+$/.test(config.githubOwner) ||
    !/^[a-zA-Z0-9_.-]+$/.test(config.githubRepo)
  )
    throw new EdgeError(503, 'not_configured');
}
export async function dispatch(
  config: EdgeConfig,
  buildId: string,
  transport: typeof fetch = fetch,
  timeout = 8000,
): Promise<void> {
  dispatchConfigured(config);
  try {
    const response = await transport(
      `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/dispatches`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(timeout),
        headers: {
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          event_type: 'portfolio_publish',
          client_payload: { build_id: buildId },
        }),
      },
    );
    // Do not read/log provider bodies; 204 is accepted dispatch, not deployed content.
    await response.body?.cancel();
    if (response.status !== 204) throw new EdgeError(502, 'temporary_failure');
  } catch (error) {
    if (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))
      throw new EdgeError(504, 'temporary_failure');
    if (error instanceof EdgeError) throw error;
    // Network failure after sending is ambiguous, just like a timeout.
    throw new EdgeError(504, 'temporary_failure');
  }
}
