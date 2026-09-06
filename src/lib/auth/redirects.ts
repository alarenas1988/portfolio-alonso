import { createUrlHelpers } from '../utils/urls.ts';

/** Fixed physical Astro routes; never use a browser-provided returnTo as an Auth redirect. */
export function getAuthRedirects(siteUrl: string) {
  const site = new URL(siteUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
  if (
    (site.protocol !== 'https:' && !(local && site.protocol === 'http:')) ||
    site.username ||
    site.password ||
    site.search ||
    site.hash
  ) {
    throw new Error('Invalid Auth site URL.');
  }
  const { absoluteUrl } = createUrlHelpers(site.href);
  return Object.freeze({
    login: absoluteUrl('/admin/login/'),
    admin: absoluteUrl('/admin/'),
    recovery: absoluteUrl('/admin/reset-password/'),
  });
}

/** Parse only the PKCE code for our fixed route; SDK performs the actual exchange in F7. */
export function readRecoveryCode(callbackUrl: string, siteUrl: string): string {
  const callback = new URL(callbackUrl);
  const expected = new URL(getAuthRedirects(siteUrl).recovery);
  if (
    callback.origin !== expected.origin ||
    callback.pathname !== expected.pathname ||
    callback.username ||
    callback.password ||
    callback.hash ||
    callback.searchParams.has('error') ||
    callback.searchParams.getAll('code').length !== 1
  ) {
    throw new Error('Invalid recovery callback.');
  }
  const code = callback.searchParams.get('code');
  if (!code || !/^[A-Za-z0-9_-]{1,512}$/.test(code)) throw new Error('Invalid recovery callback.');
  return code;
}
