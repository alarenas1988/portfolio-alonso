import type { Field } from './resources.ts';
import type { Patch } from './validation.ts';
import type { AdminClient } from './repository.ts';
import { el, button } from './dom.ts';
import { editorialLabel } from './labels.ts';
export type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export function fieldControl(
  field: Field,
  value: Patch[string] | undefined,
  client: AdminClient,
  prefix = 'field',
) {
  const wrap = el(
    'div',
    '',
    'cms-field' +
      (['textarea', 'markdown', 'media'].includes(field.type ?? '') ? ' cms-field-wide' : ''),
  );
  const label = el('label', field.label);
  const id = prefix + '-' + field.key;
  label.htmlFor = id;
  let input: Control;
  if (field.type === 'textarea' || field.type === 'markdown') {
    input = el('textarea');
    input.rows = field.type === 'markdown' ? 16 : 4;
    if (field.type === 'markdown') input.className = 'cms-markdown';
  } else if (field.type === 'select') {
    input = el('select');
    if (!field.required) {
      const opt = el('option', 'Heredar / sin valor');
      opt.value = '';
      input.append(opt);
    }
    for (const value of field.options ?? []) {
      const opt = el('option', editorialLabel(value));
      opt.value = value;
      input.append(opt);
    }
  } else {
    input = el('input');
    input.type = field.type === 'media' ? 'text' : (field.type ?? 'text');
    if (field.type === 'number') {
      input.step = '1';
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
    }
    if (field.type === 'media') input.readOnly = true;
  }
  input.id = id;
  input.name = field.key;
  input.required = field.required ?? false;
  if (field.type === 'checkbox' && input instanceof HTMLInputElement)
    input.checked = value === true;
  else
    input.value =
      value === null || value === undefined
        ? ''
        : field.type === 'datetime-local' && typeof value === 'string'
          ? toLocalDateTime(value)
          : String(value);
  if (field.max && input instanceof HTMLInputElement && field.type !== 'number')
    input.maxLength = field.max;
  const error = el('span', '', 'cms-field-error');
  error.id = id + '-error';
  error.setAttribute('aria-live', 'polite');
  const help = el('span', field.help ?? '', 'cms-help');
  help.id = id + '-help';
  input.setAttribute('aria-describedby', help.id + ' ' + error.id);
  if (field.type === 'checkbox') {
    label.className = 'cms-check';
    label.prepend(input);
    wrap.append(label);
  } else wrap.append(label, input);
  if (field.type === 'media') {
    input.hidden = true;
    input.required = false;
    const filename = el('span', value ? 'Archivo seleccionado' : 'Sin archivo', 'cms-help');
    const actions = el('div', '', 'cms-actions');
    wrap.append(filename, actions);
    actions.append(
      button('Seleccionar ' + field.label.toLowerCase(), () => {
        void (async () => {
          const { pickMedia } = await import('./media-picker.ts');
          const asset = await pickMedia(client, field.label === 'PDF');
          if (asset) {
            input.value = asset.id;
            filename.textContent = asset.filename + ' · ' + asset.visibility;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })();
      }),
      button('Desvincular', () => {
        input.value = '';
        filename.textContent = 'Sin archivo';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }),
    );
    if (value)
      void import('./media-picker.ts').then(async ({ describeMedia }) => {
        filename.textContent = await describeMedia(client, String(value));
      });
  }
  wrap.append(help, error);
  return { wrap, input, error };
}
export function readControl(field: Field, input: Control): Patch[string] {
  if (field.type === 'checkbox' && input instanceof HTMLInputElement) return input.checked;
  if (!input.value.trim()) return field.type === 'markdown' ? '' : null;
  if (field.type === 'number') return Number(input.value);
  if (field.type === 'datetime-local') {
    const date = new Date(input.value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : input.value;
  }
  return field.type === 'markdown' || field.type === 'textarea' ? input.value : input.value.trim();
}
export function toLocalDateTime(instant: string) {
  const d = new Date(instant);
  return Number.isFinite(d.getTime())
    ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
}
