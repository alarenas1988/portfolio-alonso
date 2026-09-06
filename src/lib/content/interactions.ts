export type PublicInteraction = {
  name:
    | 'whatsapp_click'
    | 'email_click'
    | 'email_copy'
    | 'cv_download'
    | 'social_click'
    | 'code_copy'
    | 'share_copy'
    | 'share_linkedin';
  source: 'home' | 'article' | 'contact' | 'about';
};
/** Local semantic hook; only the enabled Analytics subscriber selects allowed events. */
export function recordPublicInteraction(event: PublicInteraction): void {
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent('portfolio:interaction', { detail: { name: event.name } }),
    );
}
