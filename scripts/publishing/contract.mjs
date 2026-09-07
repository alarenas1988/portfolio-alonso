import { createHmac } from 'node:crypto';

export const repository = 'alarenas1988/portfolio-alonso';
export const siteUrl = 'https://alarenas1988.github.io/portfolio-alonso/';
export const workflowPath = '.github/workflows/deploy-pages.yml';
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function buildIdentity(eventName, event, env) {
  if (env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== 'refs/heads/main')
    throw new Error('Publishing is restricted to the approved main branch.');
  if (!['push', 'repository_dispatch', 'workflow_dispatch'].includes(eventName))
    throw new Error('Unsupported publishing trigger.');
  if (eventName === 'repository_dispatch') {
    if (
      event.action !== 'portfolio_publish' ||
      !event.client_payload ||
      Object.keys(event.client_payload).join(',') !== 'build_id' ||
      !uuid.test(event.client_payload.build_id)
    )
      throw new Error('Invalid portfolio publishing payload.');
    return event.client_payload.build_id;
  }
  // Code/manual deployments are not CMS requests and do not invent editorial records.
  return null;
}

export function signBody(body, secret, now = Date.now()) {
  if (!secret || secret.length < 32) throw new Error('Callback signing is not configured.');
  const timestamp = String(Math.floor(now / 1000));
  return {
    'content-type': 'application/json',
    'x-build-timestamp': timestamp,
    'x-build-signature':
      'v1=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex'),
  };
}

export async function sendSigned(url, payload, secret, transport = fetch) {
  const target = new URL(url);
  if (
    !(target.protocol === 'https:' && /^[a-z]{20}\.supabase\.co$/.test(target.hostname)) &&
    !(target.protocol === 'http:' && target.hostname === '127.0.0.1')
  )
    throw new Error('Callback origin is not permitted.');
  if (
    target.pathname !== '/functions/v1/build-status' ||
    target.search ||
    target.hash ||
    target.username ||
    target.password
  )
    throw new Error('Callback URL is invalid.');
  const body = JSON.stringify(payload);
  // Exact same payload, new signature timestamp; DB callbacks/reconciliation are idempotent.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await transport(target, {
        method: 'POST',
        headers: signBody(body, secret),
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      await response.body?.cancel();
      if (response.ok) return;
      if (response.status < 500 && response.status !== 429)
        throw new Error('Callback rejected', { cause: 'terminal' });
    } catch (error) {
      if (error.cause === 'terminal' || attempt === 2)
        throw new Error('Callback delivery failed.', { cause: error });
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
  }
  throw new Error('Callback delivery failed.');
}
