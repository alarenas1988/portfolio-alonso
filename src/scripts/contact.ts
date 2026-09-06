import { recordPublicInteraction, type PublicInteraction } from '../lib/content/interactions.ts';
const names: readonly PublicInteraction['name'][] = [
  'whatsapp_click',
  'email_click',
  'email_copy',
  'cv_download',
  'social_click',
];
document.querySelectorAll<HTMLAnchorElement>('a[data-interaction]').forEach((link) => {
  link.addEventListener('click', () => {
    const name = link.dataset.interaction;
    if (names.includes(name as PublicInteraction['name']))
      recordPublicInteraction({ name: name as PublicInteraction['name'], source: 'home' });
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-copy-email]').forEach((button) => {
  if (!window.navigator.clipboard?.writeText) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const email = button.dataset.copyEmail;
    const status = document.getElementById(button.getAttribute('aria-describedby') ?? '');
    if (!email || !status) return;
    try {
      await window.navigator.clipboard.writeText(email);
      status.textContent = '✓ Correo copiado';
      recordPublicInteraction({ name: 'email_copy', source: 'home' });
    } catch {
      status.textContent =
        'No se pudo copiar. Puedes seleccionar el correo o abrir tu cliente de correo.';
    }
  });
});
