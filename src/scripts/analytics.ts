import {
  createAnalyticsClient,
  externalInteraction,
  privacyExcluded,
} from '../lib/analytics/client.ts';
const marker = Symbol.for('al.analytics.initialized');
type AnalyticsWindow = Window & { [marker]?: boolean };
export function initializeAnalytics(win: Window = window): void {
  const state = win as AnalyticsWindow;
  if (state[marker]) return;
  state[marker] = true;
  const data = win.document.body.dataset;
  if (
    data.analyticsEnabled !== 'true' ||
    !data.analyticsEndpoint ||
    !data.analyticsKey ||
    !data.analyticsSite
  )
    return;
  const client = createAnalyticsClient({
    enabled: true,
    endpoint: data.analyticsEndpoint,
    publishableKey: data.analyticsKey,
    siteUrl: data.analyticsSite,
    href: () => win.location.href,
    referrer: win.document.referrer,
    context: {
      ...(data.analyticsProject ? { projectId: data.analyticsProject } : {}),
      ...(data.analyticsPost ? { postId: data.analyticsPost } : {}),
    },
    excluded: () => privacyExcluded(win.navigator),
    storage: () => win.sessionStorage,
    random: () => win.crypto.randomUUID(),
    fetch: win.fetch.bind(win),
  });
  win.document.addEventListener('click', (event) => {
    const link =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.hasAttribute('data-share-linkedin')) return; // existing confirmed interaction hook
    const name = externalInteraction(
      link.href,
      link.dataset.analyticsEvent || link.dataset.interaction,
    );
    if (name) client.emit(name, event);
  });
  win.addEventListener('portfolio:interaction', (event) => {
    if (!(event instanceof CustomEvent)) return;
    const name: unknown = event.detail?.name;
    if (name === 'email_copy') client.emit('email_copy', event);
    if (name === 'share_copy' || name === 'share_linkedin') client.emit('article_share', event);
  });
  // One view per Document, including BFCache restores. Real reload creates a new Document.
  if (win.document.visibilityState === 'hidden') {
    const visible = () => {
      if (win.document.visibilityState !== 'hidden') {
        client.start();
        win.document.removeEventListener('visibilitychange', visible);
      }
    };
    win.document.addEventListener('visibilitychange', visible);
  } else client.start();
}
initializeAnalytics();
