import { recordPublicInteraction } from '../lib/content/interactions.ts';
document.querySelectorAll<HTMLElement>('.code-block').forEach((figure) => {
  const code = figure.querySelector('code'),
    caption = figure.querySelector('figcaption');
  if (!code || !caption || !navigator.clipboard) return;
  const button = document.createElement('button'),
    status = document.createElement('span');
  button.type = 'button';
  button.textContent = 'Copiar código';
  status.setAttribute('role', 'status');
  status.className = 'sr-only';
  caption.append(button, status);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      status.textContent = 'Código copiado';
      recordPublicInteraction({ name: 'code_copy', source: 'article' });
    } catch {
      status.textContent = 'No se pudo copiar. Selecciona el código para copiarlo.';
    }
  });
});
