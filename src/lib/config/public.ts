export interface SupabasePublicConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export interface PublicConfig {
  readonly siteUrl: string;
  readonly origin: string;
  readonly base: string;
  readonly supabase: SupabasePublicConfig | null;
}

export type PublicEnvironment = Readonly<Record<string, string | undefined>>;

/** Validate configuration without ever including its values in errors. */
function parseHttpUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL.`);
  }
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${label} requires HTTPS (HTTP only on loopback), without credentials, query or hash.`,
    );
  }
  return url;
}

export function readPublicConfig(env: PublicEnvironment): PublicConfig {
  const site = parseHttpUrl(
    env.PUBLIC_SITE_URL?.trim() || 'https://example.com/portfolio-alonso/',
    'PUBLIC_SITE_URL',
  );
  site.pathname = `${site.pathname.replace(/\/+$/, '')}/`;
  const url = env.PUBLIC_SUPABASE_URL?.trim() || '';
  const publishableKey = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  if (Boolean(url) !== Boolean(publishableKey)) {
    throw new Error(
      'Configure both PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY, or leave both empty for F1.',
    );
  }
  let supabase: SupabasePublicConfig | null = null;
  if (url && publishableKey) {
    const supabaseUrl = parseHttpUrl(url, 'PUBLIC_SUPABASE_URL');
    if (supabaseUrl.pathname !== '/' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
      throw new Error(
        'Supabase requires an origin URL and a publishable API key; secret keys and JWT API keys are not accepted here.',
      );
    }
    supabase = Object.freeze({ url: supabaseUrl.origin, publishableKey });
  }
  return Object.freeze({ siteUrl: site.href, origin: site.origin, base: site.pathname, supabase });
}

/** Explicit allowlist: never pass import.meta.env or process.env to UI props. */
export function getPublicConfig(): PublicConfig {
  return readPublicConfig({
    PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL,
    PUBLIC_SUPABASE_URL: import.meta.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
