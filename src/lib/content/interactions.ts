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
/** F10 will supply transport. F3 records no analytics, identifiers, cookies or network traffic. */
export function recordPublicInteraction(event: PublicInteraction): void {
  void event;
}
