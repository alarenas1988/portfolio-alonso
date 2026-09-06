export interface ContactDraft {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
}
export type ContactErrors = Partial<Record<keyof ContactDraft, string>>;
export const contactLimits = {
  name: [2, 100],
  email: [3, 254],
  subject: [3, 160],
  message: [20, 5000],
} as const;
export function validateContact(draft: ContactDraft): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of ['name', 'email', 'subject', 'message'] as const) {
    const value = draft[field].trim(),
      [min, max] = contactLimits[field];
    if (value.length < min || value.length > max)
      errors[field] = `Escribe entre ${min} y ${max} caracteres.`;
    if (
      [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 && ![9, 10, 13].includes(code);
      })
    )
      errors[field] = 'Revisa los caracteres del texto.';
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(draft.email.trim()) || /[\r\n]/.test(draft.email))
    errors.email = 'Escribe un correo válido, como nombre@ejemplo.com.';
  if (draft.website) errors.website = 'No se pudo validar el formulario.';
  return errors;
}
