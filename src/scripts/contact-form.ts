import { validateContact, type ContactDraft } from '../lib/contact/validation.ts';
import { contactSession, type ContactState } from '../lib/contact/adapter.ts';
document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach((form) => {
  const fields = ['name', 'email', 'subject', 'message', 'website'] as const;
  const input = (name: keyof ContactDraft) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const button = form.querySelector<HTMLButtonElement>('[data-send-message]');
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const fieldset = form.querySelector('fieldset');
  form.addEventListener('submit', (event) => event.preventDefault());
  if (
    !button ||
    !status ||
    !fieldset ||
    fieldset.disabled ||
    !form.dataset.url ||
    !form.dataset.key
  )
    return;
  const session = contactSession({ url: form.dataset.url, publishableKey: form.dataset.key });
  let state: ContactState = 'idle';
  button.disabled = false;
  function setState(next: ContactState, message: string) {
    state = next;
    form.dataset.state = state;
    const busy = next === 'submitting';
    button!.disabled = busy;
    fieldset!.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
    button!.textContent = busy ? 'Enviando…' : 'Enviar mensaje';
    status!.textContent = message;
  }
  input('message').addEventListener('input', () => {
    const count = form.querySelector('[data-message-count]');
    if (count) count.textContent = `${input('message').value.length} / 5000`;
  });
  form.addEventListener('submit', async () => {
    if (state === 'submitting') return;
    setState('validating', '');
    const draft: ContactDraft = {
      name: input('name').value,
      email: input('email').value,
      subject: input('subject').value,
      message: input('message').value,
      website: input('website').value,
    };
    const errors = validateContact(draft);
    for (const field of fields) {
      input(field).setAttribute('aria-invalid', errors[field] ? 'true' : 'false');
      const error = form.querySelector(`[data-error="${field}"]`);
      if (error) error.textContent = errors[field] ?? '';
    }
    const invalid = fields.find((field) => errors[field]);
    if (invalid) {
      setState('error', 'Revisa los campos indicados. El mensaje no se ha enviado.');
      if (invalid !== 'website') input(invalid).focus();
      return;
    }
    setState('submitting', 'Estamos enviando tu mensaje.');
    const result = await session.send(draft);
    setState(result.status === 'unavailable' ? 'error' : result.status, result.message);
    if (result.status === 'success') {
      form.reset();
      const count = form.querySelector('[data-message-count]');
      if (count) count.textContent = '0 / 5000';
    }
    status.focus({ preventScroll: true });
  });
});
