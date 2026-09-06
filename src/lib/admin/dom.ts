/** All editorial/private strings become text nodes. Only shared sanitized Markdown uses HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  className = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
export function button(label: string, action: () => void, className = '') {
  const node = el('button', label, className);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
export function link(label: string, href: string, className = '') {
  const node = el('a', label, className);
  node.href = href;
  return node;
}
export function feedback(root: HTMLElement, message: string, kind = 'info') {
  root.textContent = message;
  root.dataset.kind = kind;
  root.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}
export function confirmAction(
  title: string,
  description: string,
  actionLabel = 'Confirmar',
): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const dialog = el('dialog', '', 'cms-dialog');
    const heading = el('h2', title);
    heading.id = 'cms-confirm-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    const cancel = button('Cancelar', () => dialog.close('cancel'));
    const accept = button(actionLabel, () => dialog.close('accept'), 'cms-danger');
    dialog.append(heading, el('p', description), cancel, accept);
    document.body.append(dialog);
    const beforeOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          dialog.close('cancel');
      }
    });
    dialog.addEventListener(
      'close',
      () => {
        const result = dialog.returnValue === 'accept';
        dialog.remove();
        document.body.style.overflow = beforeOverflow;
        if (previous instanceof HTMLElement) previous.focus();
        resolve(result);
      },
      { once: true },
    );
    dialog.showModal();
    cancel.focus();
  });
}
