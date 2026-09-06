import { validateContact, type ContactDraft } from '../lib/contact/validation.ts';
import { submitContact } from '../lib/contact/adapter.ts';
document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach((form) => {
  form.addEventListener('submit', (event) => event.preventDefault());
  const fields = ['name', 'email', 'subject', 'message', 'website'] as const;
  const input = (name: keyof ContactDraft) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const review = form.querySelector<HTMLButtonElement>('[data-review-message]');
  if (!review || form.querySelector('fieldset')?.disabled) return;
  review.disabled = false;
  input('message').addEventListener('input', () => {
    const count = form.querySelector('[data-message-count]');
    if (count) count.textContent = `${input('message').value.length} / 5000`;
  });
  review.addEventListener('click', async () => {
    const draft = {
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
    const status = form.querySelector('[data-form-status]');
    const invalid = fields.find((field) => errors[field]);
    if (invalid) {
      if (status) status.textContent = 'Revisa los campos indicados. El mensaje no se ha enviado.';
      if (invalid !== 'website') input(invalid).focus();
      return;
    }
    const result = await submitContact(draft);
    if (status) status.textContent = result.message;
    // The draft stays in the fields; it is never persisted, sent or cleared here.
  });
});
