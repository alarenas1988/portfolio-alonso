/** The F9 allowlist, shared verbatim by Edge and the browser. */
export const events = [
  'page_view',
  'project_view',
  'post_view',
  'whatsapp_click',
  'email_click',
  'email_copy',
  'github_click',
  'linkedin_click',
  'demo_click',
  'cv_download',
  'contact_submit',
  'article_share',
] as const;
export type AnalyticsEvent = (typeof events)[number];
export type BrowserAnalyticsEvent = Exclude<AnalyticsEvent, 'contact_submit'>;
export function isBrowserEvent(value: unknown): value is BrowserAnalyticsEvent {
  return (
    typeof value === 'string' &&
    value !== 'contact_submit' &&
    events.some((event) => event === value)
  );
}
