import { EdgeError } from './errors.ts';
export interface EdgeConfig {
  origins: string[];
  siteUrl: string;
  contactSecret: string;
  analyticsSecret: string;
  analyticsRateSecret: string;
  callbackSecret: string;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  contactGlobalLimit: number;
}
export function config(get: (key: string) => string | undefined): EdgeConfig {
  const siteUrl = get('PORTFOLIO_SITE_URL') || 'https://alarenas1988.github.io/portfolio-alonso/';
  const origins = (get('PORTFOLIO_ALLOWED_ORIGINS') || 'https://alarenas1988.github.io')
    .split(',')
    .map((s) => s.trim());
  try {
    for (const origin of origins) {
      const parsed = new URL(origin);
      if (
        parsed.origin !== origin ||
        !(
          parsed.protocol === 'https:' ||
          (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
        )
      )
        throw 0;
    }
    if (
      new URL(siteUrl).pathname !== '/portfolio-alonso/' ||
      !origins.includes(new URL(siteUrl).origin)
    )
      throw 0;
  } catch {
    throw new EdgeError(503, 'not_configured');
  }
  const limit = Number(get('CONTACT_GLOBAL_HOURLY_LIMIT') || 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw new EdgeError(503, 'not_configured');
  return {
    origins,
    siteUrl,
    contactGlobalLimit: limit,
    contactSecret: get('CONTACT_RATE_LIMIT_HMAC_SECRET') || '',
    analyticsSecret: get('ANALYTICS_HMAC_SECRET') || '',
    analyticsRateSecret: get('ANALYTICS_RATE_LIMIT_HMAC_SECRET') || '',
    callbackSecret: get('BUILD_CALLBACK_HMAC_SECRET') || '',
    githubToken: get('GITHUB_FINE_GRAINED_TOKEN') || '',
    githubOwner: get('GITHUB_REPOSITORY_OWNER') || 'alarenas1988',
    githubRepo: get('GITHUB_REPOSITORY_NAME') || 'portfolio-alonso',
  };
}
export function secret(value: string): string {
  if (value.length < 32) throw new EdgeError(503, 'not_configured');
  return value;
}
