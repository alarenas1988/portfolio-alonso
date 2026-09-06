import { EdgeError } from './errors.ts';
/** Gateway metadata is only an abuse signal, never identity or authorization.
 * Hosted Supabase is behind Cloudflare; XFF's last hop is a rotating intermediary.
 * CLI local has one known Kong hop and must ignore caller-supplied CF headers.
 */
export function clientSignal(
  request: Request,
  mode: 'cloudflare' | 'local-proxy' = 'local-proxy',
): string {
  const raw =
    mode === 'cloudflare'
      ? (request.headers.get('cf-connecting-ip') || '').trim()
      : (request.headers.get('x-forwarded-for') || '').split(',').at(-1)?.trim() || '';
  const missing = () => {
    if (mode === 'cloudflare') throw new EdgeError(503, 'not_configured');
    return 'unknown';
  };
  if (!raw || raw.length > 64) return missing();
  try {
    if (raw.includes(':')) return new URL(`http://[${raw}]/`).hostname.toLowerCase();
    const octets = raw.split('.');
    if (octets.length === 4 && octets.every((n) => /^\d{1,3}$/.test(n) && Number(n) <= 255))
      return octets.map(Number).join('.');
  } catch {
    /* Invalid signals share the conservative unknown bucket. */
  }
  return missing();
}
export function userAgent(request: Request) {
  const ua = (request.headers.get('user-agent') || '').slice(0, 1024);
  return {
    device: !ua
      ? 'unknown'
      : /ipad|tablet/i.test(ua)
        ? 'tablet'
        : /mobi|android/i.test(ua)
          ? 'mobile'
          : 'desktop',
    browser: !ua
      ? 'unknown'
      : /edg\//i.test(ua)
        ? 'Edge'
        : /firefox\//i.test(ua)
          ? 'Firefox'
          : /chrome\//i.test(ua)
            ? 'Chromium'
            : /safari\//i.test(ua)
              ? 'Safari'
              : 'other',
  };
}
export function referrer(value: string | null): string | null {
  if (!value) return null;
  const allowed = [
    'google.com',
    'google.cl',
    'bing.com',
    'duckduckgo.com',
    'github.com',
    'linkedin.com',
  ];
  const host = value.toLowerCase().replace(/^www\./, '');
  return allowed.includes(host) ? host : 'other';
}
