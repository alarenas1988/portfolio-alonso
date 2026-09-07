import type { AdminClient } from '../../lib/admin/repository.ts';
import { getRecord, loadRelations, saveRecord, removeRecord } from '../../lib/admin/repository.ts';
import {
  resources,
  type ResourceName,
  type Field,
  resourceRoute,
} from '../../lib/admin/resources.ts';
import { fieldControl, readControl } from '../../lib/admin/fields.ts';
import { validateFields, suggestSlug, type Patch } from '../../lib/admin/validation.ts';
import { Autosave } from '../../lib/admin/autosave.ts';
import { AdminError, errorMessage } from '../../lib/admin/errors.ts';
import { el, button, feedback, confirmAction, link } from '../../lib/admin/dom.ts';
import { mountRelations } from '../../lib/admin/relations.ts';
import { getPublicConfig } from '../../lib/config/public.ts';
import { createUrlHelpers } from '../../lib/utils/urls.ts';
import { publicationController } from './publication.ts';
export async function mountEditor(
  root: HTMLElement,
  client: AdminClient,
  table: ResourceName,
  id?: string,
  seoOnly = false,
) {
  const spec = resources[table],
    config = getPublicConfig(),
    { withBase } = createUrlHelpers(config.siteUrl);
  let row = id || spec.singleton ? await getRecord(client, table, id) : null;
  if (id && !row) {
    root.replaceChildren(el('div', 'El registro no existe o no está disponible.', 'cms-empty'));
    return;
  }
  const initial = row ?? {
    id: crypto.randomUUID(),
    updated_at: '',
    status: table === 'posts' ? 'draft' : 'concept',
    sort_order: 0,
    number: 1,
    type: 'cv',
    timezone: 'America/Santiago',
    robots_policy: 'index,follow',
    content_markdown: '',
  };
  const fields: readonly Field[] = spec.fields.filter((f) =>
    seoOnly
      ? 'group' in f && f.group === 'SEO'
      : table === 'site_settings'
        ? !('group' in f && f.group === 'SEO')
        : true,
  );
  const form = el('form');
  form.noValidate = true;
  const status = el('p', '', 'cms-notice');
  status.setAttribute('aria-live', 'polite');
  const panels = el('div'),
    tabs = el('div', '', 'cms-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Secciones del editor');
  const controls = new Map<string, ReturnType<typeof fieldControl>>(),
    groupPanels = new Map<string, HTMLElement>();
  function group(name: string) {
    let p = groupPanels.get(name);
    if (!p) {
      p = el('section', '', 'cms-panel');
      p.id = 'editor-' + name.replace(/\W/g, '');
      p.setAttribute('role', 'tabpanel');
      p.append(el('h2', name));
      groupPanels.set(name, p);
      panels.append(p);
    }
    return p;
  }
  for (const field of fields) {
    const panel = group(field.group ?? 'General');
    let grid = panel.querySelector<HTMLElement>('.cms-fields');
    if (!grid) {
      grid = el('div', '', 'cms-fields');
      panel.append(grid);
    }
    const control = fieldControl(field, initial[field.key as keyof typeof initial], client);
    controls.set(field.key, control);
    grid.append(control.wrap);
  }
  const related = await loadRelations(client, table, row?.id ?? initial.id);
  const relationsRoot = group('Relaciones');
  const readRelations = mountRelations(relationsRoot, client, table, related, () =>
    autosave.change(),
  );
  if (!['projects', 'posts', 'experiences'].includes(table)) {
    relationsRoot.remove();
    groupPanels.delete('Relaciones');
  }
  const selectTab = (name: string) => {
    for (const [key, p] of groupPanels) {
      p.hidden = key !== name;
    }
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const selected = b.textContent === name;
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
  };
  for (const [name, panel] of groupPanels) {
    const tab = button(name, () => selectTab(name));
    tab.setAttribute('role', 'tab');
    tab.id = panel.id + '-tab';
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', tab.id);
    tabs.append(tab);
  }
  tabs.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const nodes = [...tabs.querySelectorAll('button')];
    let i = nodes.indexOf(document.activeElement as HTMLButtonElement);
    i =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? nodes.length - 1
          : (i + (e.key === 'ArrowRight' ? 1 : -1) + nodes.length) % nodes.length;
    nodes[i]!.click();
    nodes[i]!.focus();
  });
  selectTab(groupPanels.keys().next().value!);
  const state = el('span', 'Sin cambios');
  state.dataset.saveState = 'clean';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  const actions = el('div', '', 'cms-editor-actions');
  const save = el('button', 'Guardar', 'cms-primary');
  save.type = 'submit';
  const read = (): Patch =>
    Object.fromEntries(fields.map((f) => [f.key, readControl(f, controls.get(f.key)!.input)]));
  let disposePreview = () => {};
  let disposePublication = () => {};
  async function persist() {
    const patch = read(),
      errors = validateFields(patch, fields, config.siteUrl);
    for (const field of fields) {
      const c = controls.get(field.key)!;
      c.error.textContent = errors[field.key] ?? '';
      c.input.setAttribute('aria-invalid', String(Boolean(errors[field.key])));
    }
    if (Object.keys(errors).length) {
      feedback(status, 'Revisa los campos indicados. Los cambios aún no están guardados.', 'error');
      throw new AdminError('validation', 'Invalid fields');
    }
    try {
      row = await saveRecord(
        client,
        table,
        initial.id,
        row?.updated_at ?? null,
        patch,
        readRelations(),
      );
      if (!id && !spec.singleton && ['projects', 'posts'].includes(table))
        history.replaceState(
          null,
          '',
          withBase('/admin/' + resourceRoute(table) + '/edit/') + '?id=' + row.id,
        );
      feedback(
        status,
        'Guardado en Supabase. Los cambios públicos se incorporarán en el próximo build.',
      );
    } catch (error) {
      feedback(status, errorMessage(error), 'error');
      throw error;
    }
  }
  const autosave = new Autosave(persist, (s) => {
    const labels = {
      clean: 'Sin cambios',
      dirty: 'Cambios pendientes',
      saving: 'Guardando…',
      saved: 'Guardado',
      error: 'Error al guardar',
      conflict: 'Conflicto de revisión',
    };
    state.textContent = labels[s];
    state.dataset.saveState = s;
    root.dataset.dirty = String(autosave.dirty);
    save.disabled = s === 'saving';
  });
  form.addEventListener('input', (event) => {
    if (
      event.target === controls.get('title')?.input ||
      event.target === controls.get('name')?.input
    ) {
      const s = controls.get('slug')?.input;
      if (s && !row && !s.dataset.edited) {
        s.value = suggestSlug((event.target as HTMLInputElement).value);
      }
    }
    if (event.target === controls.get('slug')?.input)
      (event.target as HTMLInputElement).dataset.edited = 'true';
    autosave.change();
  });
  form.addEventListener('change', () => autosave.change());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!row && !autosave.dirty) autosave.change();
    void autosave.flush();
  });
  actions.append(
    state,
    save,
    button('Recargar registro', () => {
      void (async () => {
        if (
          !autosave.dirty ||
          (await confirmAction(
            '¿Descartar los cambios locales?',
            'Se cargará la última revisión guardada.',
            'Recargar',
          ))
        ) {
          autosave.dispose();
          disposePreview();
          disposePublication();
          await mountEditor(root, client, table, row?.id, seoOnly);
        }
      })();
    }),
  );
  if (['projects', 'posts'].includes(table)) {
    const publicationStatus = el(
      'p',
      'El sitio se actualiza después de confirmar la publicación.',
      'cms-notice',
    );
    publicationStatus.setAttribute('role', 'status');
    publicationStatus.setAttribute('aria-label', 'Estado de publicación');
    actions.append(publicationStatus);
    const publication = publicationController(client, publicationStatus);
    disposePublication = publication.dispose;
    actions.append(
      button('Publicar contenido', () => {
        void (async () => {
          if (
            !(await confirmAction(
              '¿Publicar este contenido?',
              'El contenido será público en Supabase. El sitio estático requiere un rebuild independiente.',
              'Publicar contenido',
            ))
          )
            return;
          if (table === 'projects')
            (controls.get('published')!.input as HTMLInputElement).checked = true;
          else controls.get('status')!.input.value = 'published';
          const published = controls.get('published_at')!.input;
          if (!published.value) {
            const now = new Date();
            published.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
          }
          autosave.change();
          if (await autosave.flush()) {
            await publication.submit(undefined, JSON.stringify([read(), readRelations()]));
          }
        })();
      }),
      button('Archivar', () => {
        void (async () => {
          if (
            await confirmAction(
              '¿Archivar el contenido?',
              'Dejará de aparecer en la siguiente construcción pública.',
              'Archivar',
            )
          ) {
            controls.get('status')!.input.value = 'archived';
            if (table === 'projects')
              (controls.get('published')!.input as HTMLInputElement).checked = false;
            autosave.change();
            await autosave.flush();
          }
        })();
      }),
    );
  }
  if (!spec.singleton)
    actions.append(
      button(
        'Eliminar definitivamente',
        () => {
          void (async () => {
            if (!row) return;
            if (
              await confirmAction(
                '¿Eliminar ' + spec.singular + '?',
                'Esta acción elimina el registro y sus relaciones editoriales. Las referencias externas pueden bloquearla.',
                'Eliminar',
              )
            ) {
              try {
                await removeRecord(client, table, row);
                autosave.dispose();
                location.assign(withBase('/admin/' + resourceRoute(table) + '/'));
              } catch (e) {
                feedback(status, errorMessage(e), 'error');
              }
            }
          })();
        },
        'cms-danger',
      ),
    );
  form.append(tabs, panels, status, actions);
  root.replaceChildren(form);
  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (autosave.dirty) {
      e.preventDefault();
    }
  };
  window.addEventListener('beforeunload', beforeUnload);
  const dispose = () => {
    autosave.dispose();
    disposePreview();
    window.removeEventListener('beforeunload', beforeUnload);
    delete root.dataset.dirty;
  };
  window.addEventListener('admin-dispose', dispose, { once: true });
  for (const field of fields.filter((f) => f.type === 'markdown')) {
    const control = controls.get(field.key)!,
      textarea = control.input as HTMLTextAreaElement,
      tools = el('div', '', 'cms-markdown-tools'),
      preview = el('div', '', 'cms-preview editorial');
    preview.hidden = true;
    const insert = (value: string) => {
      textarea.setRangeText(value, textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    };
    for (const [label, value] of [
      ['H2', '\n## Encabezado\n'],
      ['H3', '\n### Subtítulo\n'],
      ['Negrita', '**texto**'],
      ['Enlace', '[texto](https://)'],
      ['Código', '\n```text\ncódigo\n```\n'],
      ['Cita', '\n> Cita\n'],
    ])
      tools.append(button(label!, () => insert(value!)));
    tools.append(
      button('Imagen', () => {
        void (async () => {
          const { pickMedia } = await import('../../lib/admin/media-picker.ts');
          const asset = await pickMedia(client);
          if (asset)
            insert(
              '![' +
                (asset.alt_text ?? '').replaceAll('[', '').replaceAll(']', '') +
                '](media:' +
                asset.id +
                ')',
            );
        })();
      }),
    );
    const previewButton = button('Vista previa', () => {
      void (async () => {
        previewButton.disabled = true;
        try {
          const { renderAdminPreview } = await import('../../lib/admin/markdown-preview.ts');
          const result = await renderAdminPreview(client, textarea.value, config.siteUrl);
          disposePreview();
          disposePreview = result.dispose;
          preview.replaceChildren(el('p', result.readingTime + ' min de lectura', 'cms-help'));
          if (result.toc.length) {
            const toc = el('nav');
            toc.setAttribute('aria-label', 'Contenido de la vista previa');
            for (const entry of result.toc) toc.append(link(entry.text, '#' + entry.id));
            preview.append(toc);
          }
          preview.append(result.fragment);
          preview.hidden = false;
        } catch {
          preview.hidden = false;
          preview.replaceChildren(
            el('p', 'No se pudo generar la vista previa. Revisa las referencias de imágenes.'),
          );
        } finally {
          previewButton.disabled = false;
        }
      })();
    });
    tools.append(
      previewButton,
      button('Solo editor', () => {
        preview.hidden = true;
      }),
    );
    control.wrap.append(tools, preview);
  }
}
