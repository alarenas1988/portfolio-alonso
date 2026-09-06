import type { Field } from './resources.ts';
import { uuidPattern } from './routes.ts';
export type Row = { id: string; updated_at: string } & Record<
  string,
  string | number | boolean | null
>;
export type Patch = Record<string, string | number | boolean | null>;
export function suggestSlug(title: string) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
    .replace(/-$/, '');
}
export function safeHttps(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !/[\s\\]/.test(value);
  } catch {
    return false;
  }
}
export function validateFields(
  patch: Patch,
  fields: readonly Field[],
  siteUrl?: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = patch[field.key];
    if (field.required && (value === null || value === undefined || String(value).trim() === '')) {
      errors[field.key] = 'Completa este campo.';
      continue;
    }
    if (value === null || value === undefined || value === '') continue;
    if (field.key === 'slug' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(value)))
      errors[field.key] = 'Usa minúsculas ASCII, números y guiones.';
    if (field.type === 'url' && !safeHttps(String(value)))
      errors[field.key] = 'Usa una URL HTTPS sin credenciales.';
    if (field.type === 'media' && !uuidPattern.test(String(value)))
      errors[field.key] = 'Selecciona un archivo de la biblioteca.';
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
      errors[field.key] = 'Escribe un correo válido.';
    if (field.type === 'select' && !field.options?.includes(String(value)))
      errors[field.key] = 'Selecciona un estado válido.';
    if (
      field.type === 'number' &&
      (!Number.isInteger(value) ||
        (field.min !== undefined && Number(value) < field.min) ||
        (field.max !== undefined && Number(value) > field.max))
    )
      errors[field.key] = 'Revisa el rango del número.';
    if (
      typeof value === 'string' &&
      value.length > (field.type === 'markdown' ? 100000 : (field.max ?? 10000))
    )
      errors[field.key] = 'El contenido es demasiado largo.';
    if (field.key === 'canonical_base' && siteUrl && new URL(siteUrl).href !== value)
      errors[field.key] = 'La base canonical debe coincidir con la URL configurada del sitio.';
    if (field.key === 'timezone') {
      try {
        new Intl.DateTimeFormat('es', { timeZone: String(value) }).format();
      } catch {
        errors[field.key] = 'Usa una zona horaria IANA válida.';
      }
    }
    if (field.key === 'whatsapp_number' && !/^\+[1-9][0-9]{6,14}$/.test(String(value)))
      errors[field.key] = 'Usa + y el número internacional, sin espacios.';
  }
  if (patch.end_date && patch.start_date && patch.end_date < patch.start_date)
    errors.end_date = 'El término debe ser posterior al inicio.';
  if (patch.current && patch.end_date)
    errors.end_date = 'Un cargo actual no tiene fecha de término.';
  if (patch.email_visible && !patch.email) errors.email = 'Configura el email antes de mostrarlo.';
  if (patch.whatsapp_visible && !patch.whatsapp_number)
    errors.whatsapp_number = 'Configura WhatsApp antes de mostrarlo.';
  if ((patch.published || patch.status === 'published') && !patch.published_at)
    errors.published_at = 'Define la fecha de publicación.';
  return errors;
}
