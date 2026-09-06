const navbar = document.querySelector<HTMLElement>('[data-navbar]');
if (navbar) {
  navbar.dataset.enhanced = '';
  let scheduled = false;
  const update = () => {
    navbar.toggleAttribute(
      'data-scrolled',
      navbar.hasAttribute('data-internal') || window.scrollY > 40,
    );
    scheduled = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}
const disclosure = document.querySelector<HTMLDetailsElement>('[data-mobile-navigation]');
const summary = disclosure?.querySelector<HTMLElement>('summary');
const panel = disclosure?.querySelector<HTMLElement>('[data-mobile-panel]');
if (
  summary &&
  panel &&
  typeof window.HTMLDialogElement !== 'undefined' &&
  'showModal' in window.HTMLDialogElement.prototype
) {
  const dialog = document.createElement('dialog');
  dialog.className = 'mobile-dialog';
  dialog.setAttribute('aria-label', 'Menú principal');
  dialog.id = 'mobile-menu';
  dialog.append(panel);
  document.body.append(dialog);
  summary.setAttribute('aria-controls', dialog.id);
  summary.setAttribute('aria-expanded', 'false');
  const closeButton = panel.querySelector<HTMLButtonElement>('[data-close-menu]');
  if (closeButton) closeButton.hidden = false;
  let previousOverflow = '';
  summary.addEventListener('click', (event) => {
    event.preventDefault();
    if (dialog.open) return;
    previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    summary.setAttribute('aria-expanded', 'true');
    closeButton?.focus();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      panel.animate([{ transform: 'translateY(12px)' }, { transform: 'translateY(0)' }], {
        duration: 400,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
  });
  closeButton?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [
      ...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ].filter((element) => !element.hidden && element.getClientRects().length > 0);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  panel
    .querySelectorAll('a')
    .forEach((link) => link.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    summary.setAttribute('aria-expanded', 'false');
    summary.focus({ preventScroll: true });
  });
  window.matchMedia('(min-width: 48rem)').addEventListener('change', (event) => {
    if (event.matches && dialog.open) dialog.close();
  });
}
