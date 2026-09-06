import type { ContactDraft } from './validation.ts';
export type ContactResult = { status: 'unavailable'; message: string };
/** F9 will supply the server-validated transport. This adapter cannot send or claim delivery. */
export async function submitContact(draft: ContactDraft): Promise<ContactResult> {
  void draft;
  return {
    status: 'unavailable',
    message:
      'Tu texto está listo. El envío aún no está disponible; utiliza los canales de contacto publicados.',
  };
}
