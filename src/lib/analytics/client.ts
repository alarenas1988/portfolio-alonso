import {
  isBrowserEvent,
  type BrowserAnalyticsEvent,
} from '../../../supabase/functions/_shared/events.ts';
import { referrer as referrerCategory } from '../../../supabase/functions/_shared/referrer.ts';
export type PageContext = { projectId?: string; postId?: string };
export type AnalyticsPayload = {
  event_id: string;
  session_id: string;
  event_type: BrowserAnalyticsEvent;
  pathname: string;
  project_id?: string;
  post_id?: string;
  referrer_domain?: string;
};
export type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const sessionKey = 'al.analytics.session';
export function anonymousSession(
  store: () => SessionStore | undefined,
  random: () => string,
  now: () => Date,
) {
  let memory: { day: string; id: string } | undefined;
  return () => {
    const day = now().toISOString().slice(0, 10);
    if (memory?.day === day) return memory.id;
    try {
      const value: unknown = JSON.parse(store()?.getItem(sessionKey) || 'null');
      if (
        value &&
        typeof value === 'object' &&
        'day' in value &&
        value.day === day &&
        'id' in value &&
        typeof value.id === 'string' &&
        uuid.test(value.id)
      ) {
        memory = { day, id: value.id };
        return memory.id;
      }
    } catch {
      /* A blocked store must not affect the site. */
    }
    memory = { day, id: random() };
    try {
      store()?.setItem(sessionKey, JSON.stringify(memory));
    } catch {
      /* memory only */
    }
    return memory.id;
  };
}
export function privacyExcluded(signals: {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  webdriver?: boolean;
}) {
  return (
    signals.doNotTrack === '1' ||
    signals.doNotTrack === 'yes' ||
    signals.globalPrivacyControl === true ||
    signals.webdriver === true
  );
}
export function normalizedPath(href: string, base: string): string | null {
  try {
    const path = new URL(href).pathname.replace(/\/+$/, '') + '/';
    if (!path.startsWith(base) || path.length > 200) return null;
    const relative = path.slice(base.length);
    return /^(?:(?:proyectos|blog)\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?|sobre-mi\/|contacto\/)?$/.test(
      relative,
    )
      ? path
      : null;
  } catch {
    return null;
  }
}
export function minimalReferrer(value: string, origin: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return undefined;
    return url.origin === origin ? 'same-site' : referrerCategory(url.hostname)!;
  } catch {
    return undefined;
  }
}
export function payloadFor(
  event: unknown,
  href: string,
  base: string,
  context: PageContext,
  session: string,
  id: string,
  referrer?: string,
): AnalyticsPayload | null {
  if (!isBrowserEvent(event) || !uuid.test(session) || !uuid.test(id)) return null;
  const pathname = normalizedPath(href, base);
  const project = context.projectId,
    post = context.postId;
  if (
    !pathname ||
    (project && !uuid.test(project)) ||
    (post && !uuid.test(post)) ||
    (project && post)
  )
    return null;
  if ((event === 'project_view' || event === 'demo_click') && !project) return null;
  if ((event === 'post_view' || event === 'article_share') && !post) return null;
  const detail = pathname.slice(base.length).split('/').filter(Boolean);
  if (detail.length === 2 && !(detail[0] === 'proyectos' ? project : post)) return null;
  return {
    event_id: id,
    session_id: session,
    event_type: event,
    pathname,
    ...(project ? { project_id: project } : {}),
    ...(post ? { post_id: post } : {}),
    ...(referrer ? { referrer_domain: referrer } : {}),
  };
}
export interface AnalyticsOptions {
  enabled: boolean;
  endpoint: string;
  publishableKey: string;
  siteUrl: string;
  href: () => string;
  referrer: string;
  context: PageContext;
  excluded: () => boolean;
  storage: () => SessionStore | undefined;
  random: () => string;
  now?: () => Date;
  fetch: typeof fetch;
}
export function createAnalyticsClient(options: AnalyticsOptions) {
  const session = anonymousSession(
    options.storage,
    options.random,
    options.now ?? (() => new Date()),
  );
  let initialized = false;
  const seen = new WeakSet<object>();
  function emit(event: unknown, occurrence?: object): void {
    try {
      if (!isBrowserEvent(event)) return;
      const site = new URL(options.siteUrl),
        endpoint = new URL(options.endpoint);
      if (!options.enabled || options.excluded() || new URL(options.href()).origin !== site.origin)
        return;
      if (
        endpoint.pathname !== '/functions/v1/track-event' ||
        !/^sb_publishable_[\w-]+$/.test(options.publishableKey) ||
        !(
          endpoint.protocol === 'https:' ||
          (endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))
        )
      )
        return;
      if (occurrence && seen.has(occurrence)) return;
      const payload = payloadFor(
        event,
        options.href(),
        site.pathname,
        options.context,
        session(),
        options.random(),
        minimalReferrer(options.referrer, site.origin),
      );
      if (!payload) return;
      if (occurrence) seen.add(occurrence);
      void options
        .fetch(endpoint.href, {
          method: 'POST',
          headers: { apikey: options.publishableKey, 'Content-Type': 'application/json' },
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          keepalive: true,
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify(payload),
        })
        .catch(() => {});
    } catch {
      /* Analytics is optional and never blocks an action or logs PII. */
    }
  }
  return {
    emit,
    start() {
      if (initialized) return;
      initialized = true;
      emit('page_view');
      if (options.context.projectId) emit('project_view');
      if (options.context.postId) emit('post_view');
    },
  };
}
export function externalInteraction(
  href: string,
  explicit?: string,
): BrowserAnalyticsEvent | undefined {
  if (isBrowserEvent(explicit)) return explicit;
  try {
    const url = new URL(href);
    if (url.protocol === 'mailto:') return 'email_click';
    if (url.protocol !== 'https:') return undefined;
    if (url.hostname === 'wa.me') return 'whatsapp_click';
    if (['github.com', 'www.github.com'].includes(url.hostname)) return 'github_click';
    if (['linkedin.com', 'www.linkedin.com'].includes(url.hostname)) return 'linkedin_click';
  } catch {
    /* not a configured channel */
  }
  return undefined;
}
