/**
 * SDK 2.115 fixes API-key Bearer fallback for Edge calls, but keeps it for Storage/REST.
 * This transport guard only removes that fallback; Auth still owns user JWTs and refresh.
 * Remove after the SDK enforces this boundary for all services (regression test included).
 */
export const supabaseFetch: typeof fetch = (input, init) => {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  if (/^Bearer sb_(?:publishable|secret)_/i.test(headers.get('Authorization') ?? '')) {
    headers.delete('Authorization');
  }
  return fetch(input, { ...init, headers });
};
