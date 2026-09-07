import { siteUrl, repository } from './contract.mjs';

export async function currentMain(sha, transport = fetch) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid approved commit.');
  const response = await transport(`https://api.github.com/repos/${repository}/branches/main`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-c2-health' },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || (await response.json()).commit?.sha !== sha)
    throw new Error(
      'The artifact no longer corresponds to current main; preserve the existing deployment.',
    );
}

export async function checkDeployment(transport = fetch) {
  const report = [],
    assets = new Set();
  for (const route of [
    '',
    'proyectos/',
    'blog/',
    'sobre-mi/',
    'contacto/',
    'admin/login/',
    'admin/reset-password/',
    '__c2_missing_route__/',
  ]) {
    const url = new URL(route, siteUrl);
    const response = await transport(url, {
      headers: { DNT: '1', 'Sec-GPC': '1', 'User-Agent': 'portfolio-c2-health' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    const expected = route === '__c2_missing_route__/' ? 404 : 200;
    if (response.status !== expected) {
      await response.body?.cancel();
      throw new Error('Unexpected HTTP status for ' + route);
    }
    const html = await response.text();
    if (!html.includes('<h1') || (route.startsWith('admin/') && !html.includes('noindex')))
      throw new Error('Missing page structure or Admin robots policy.');
    for (const match of html.matchAll(
      /(?:src|href)="([^"]+\.(?:css|js|woff2|svg|png|webp|avif|pdf))"/g,
    )) {
      const asset = new URL(match[1], url);
      if (asset.origin !== url.origin || !asset.pathname.startsWith('/portfolio-alonso/'))
        throw new Error('Public asset escaped the static Pages artifact.');
      assets.add(asset.href);
    }
    report.push({ path: url.pathname, status: response.status });
  }
  if (![...assets].some((value) => value.endsWith('.css')))
    throw new Error('Critical CSS missing.');
  for (const url of assets) {
    const response = await transport(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    await response.body?.cancel();
    if (response.status !== 200) throw new Error('Static asset unavailable.');
  }
  return { routes: report, assets: assets.size };
}
