/** Finite categories shared with the browser. Never retain a full referring URL. */
export function referrer(value: string | null): string | null {
  if (!value) return null;
  const allowed = [
    'same-site',
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
