export function createUrlHelpers(siteUrl: string) {
  const site = new URL(siteUrl);
  const base = site.pathname.replace(/\/+$/, '');

  function withBase(path: string): string {
    const value = path.trim();
    if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//') || value.includes('\\')) {
      throw new Error('Internal links must remain within the configured site.');
    }
    const match = /^([^?#]*)(.*)$/.exec(value);
    const pathname = match?.[1] || '/';
    const suffix = match?.[2] || '';
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      throw new Error('Invalid path encoding.');
    }
    if (
      decoded.split('/').some((part) => part === '..' || part === '.') ||
      /[\\?#]/.test(decoded) ||
      /%2f|%5c/i.test(pathname)
    ) {
      throw new Error('Internal links cannot traverse directories.');
    }
    let result = `/${pathname.replace(/^\/+/, '')}`;
    if (base && result !== base && !result.startsWith(`${base}/`)) result = `${base}${result}`;
    if (!/\.[^/]+$/.test(result) && !result.endsWith('/')) result += '/';
    return `${result}${suffix}`;
  }

  function absoluteUrl(path: string): string {
    return new URL(withBase(path), site.origin).href;
  }

  return { withBase, absoluteUrl };
}
