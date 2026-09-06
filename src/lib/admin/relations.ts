import type { ResourceName, Field } from './resources.ts';
import type { AdminClient, Relations, RelationRow } from './repository.ts';
import { choices } from './repository.ts';
import { el, button, feedback } from './dom.ts';
import { fieldControl, readControl } from './fields.ts';
type Definition = {
  key: string;
  label: string;
  fields?: Field[];
  choice?: 'technologies' | 'projects' | 'post_categories' | 'tags';
  fk?: string;
};
const title = { key: 'title', label: 'Título', required: true } as const,
  description = { key: 'description', label: 'Descripción', type: 'textarea' } as const;
const definitions: Partial<Record<ResourceName, Definition[]>> = {
  projects: [
    {
      key: 'features',
      label: 'Funcionalidades',
      fields: [title, description, { key: 'icon', label: 'Icono' }],
    },
    { key: 'technologies', label: 'Tecnologías', choice: 'technologies', fk: 'technology_id' },
    {
      key: 'images',
      label: 'Galería',
      fields: [
        { key: 'asset_id', label: 'Imagen', type: 'media', required: true },
        { key: 'alt_text', label: 'Texto alternativo', required: true },
        { key: 'caption', label: 'Descripción', type: 'textarea' },
        { key: 'featured', label: 'Imagen destacada de la galería', type: 'checkbox' },
      ],
    },
    {
      key: 'metrics',
      label: 'Métricas del proyecto',
      fields: [
        { key: 'value', label: 'Valor', required: true },
        { key: 'label', label: 'Etiqueta', required: true },
        description,
        { key: 'visible', label: 'Visible', type: 'checkbox' },
      ],
    },
    {
      key: 'challenges',
      label: 'Desafíos',
      fields: [
        title,
        { key: 'problem', label: 'Problema', type: 'textarea' },
        { key: 'solution', label: 'Solución', type: 'textarea' },
      ],
    },
  ],
  posts: [
    { key: 'categories', label: 'Categorías', choice: 'post_categories', fk: 'category_id' },
    { key: 'tags', label: 'Tags', choice: 'tags', fk: 'tag_id' },
  ],
  experiences: [
    { key: 'highlights', label: 'Hitos', fields: [title, description] },
    { key: 'projects', label: 'Proyectos relacionados', choice: 'projects', fk: 'project_id' },
    { key: 'technologies', label: 'Tecnologías', choice: 'technologies', fk: 'technology_id' },
  ],
};
export function mountRelations(
  root: HTMLElement,
  client: AdminClient,
  table: ResourceName,
  initial: Relations,
  onChange: () => void,
) {
  const readers: Record<string, () => RelationRow[]> = {};
  for (const def of definitions[table] ?? []) {
    const section = el('section', '', 'cms-panel');
    section.append(el('h2', def.label));
    const list = el('div', '', 'cms-repeat');
    section.append(list);
    root.append(section);
    let rows: RelationRow[] = (initial[def.key] ?? []).map((r) => ({ ...r }));
    if (def.choice && def.fk) {
      const chosen = el('div', '', 'cms-toolbar'),
        search = el('input');
      search.type = 'search';
      search.setAttribute('aria-label', 'Buscar ' + def.label.toLowerCase());
      const results = el('div', '', 'cms-pick-grid'),
        status = el('p', '', 'cms-help');
      const renderSelected = () => {
        chosen.replaceChildren();
        for (const row of rows) {
          const id = String(row[def.fk!]);
          const b = button('Quitar ' + (labels.get(id) ?? 'relación seleccionada'), () => {
            rows = rows.filter((r) => r !== row);
            renderSelected();
            onChange();
          });
          chosen.append(b);
        }
      };
      const labels = new Map<string, string>();
      async function load() {
        try {
          const available = await choices(client, def.choice!, search.value);
          results.replaceChildren();
          for (const option of available) {
            labels.set(option.id, option.label);
            results.append(
              button('Añadir ' + option.label, () => {
                if (!rows.some((r) => r[def.fk!] === option.id)) {
                  rows.push({
                    [def.fk!]: option.id,
                    ...(table === 'projects' ? { sort_order: rows.length } : {}),
                  });
                  renderSelected();
                  onChange();
                }
              }),
            );
          }
          renderSelected();
          status.textContent = 'Hasta 100 resultados. Usa la búsqueda para acotar.';
        } catch {
          feedback(status, 'No se pudieron cargar las opciones. Reintenta.', 'error');
        }
      }
      const disclosure = el('details');
      disclosure.append(
        el('summary', 'Buscar y añadir relaciones'),
        search,
        button('Buscar', () => {
          void load();
        }),
        results,
        status,
      );
      list.append(chosen, disclosure);
      readers[def.key] = () =>
        rows.map((row, i) => ({ ...row, ...(table === 'projects' ? { sort_order: i } : {}) }));
      void load();
    } else {
      const controls = new Map<RelationRow, ReturnType<typeof fieldControl>[]>();
      function capture() {
        rows = rows.map((row) => {
          for (const [i, control] of (controls.get(row) ?? []).entries())
            row[def.fields![i]!.key] = readControl(def.fields![i]!, control.input);
          return row;
        });
      }
      function render() {
        list.replaceChildren();
        controls.clear();
        rows.forEach((row, index) => {
          const block = el('div', '', 'cms-repeat-row'),
            fields = el('div', '', 'cms-fields');
          const inputs = def.fields!.map((field) =>
            fieldControl(field, row[field.key], client, def.key + '-' + row.id),
          );
          controls.set(row, inputs);
          for (const c of inputs) fields.append(c.wrap);
          fields.addEventListener('input', onChange);
          const actions = el('div', '', 'cms-toolbar');
          actions.append(
            button('Subir', () => {
              capture();
              if (index > 0) {
                [rows[index - 1], rows[index]] = [rows[index]!, rows[index - 1]!];
                render();
                onChange();
              }
            }),
            button('Bajar', () => {
              capture();
              if (index < rows.length - 1) {
                [rows[index + 1], rows[index]] = [rows[index]!, rows[index + 1]!];
                render();
                onChange();
              }
            }),
            button('Quitar bloque', () => {
              capture();
              rows = rows.filter((r) => r !== row);
              render();
              onChange();
            }),
          );
          block.append(fields, actions);
          list.append(block);
        });
      }
      section.append(
        button('Añadir ' + def.label.toLowerCase(), () => {
          capture();
          rows.push({ id: crypto.randomUUID(), sort_order: rows.length });
          render();
          onChange();
        }),
      );
      readers[def.key] = () => {
        capture();
        return rows.map((r, i) => ({ ...r, sort_order: i }));
      };
      render();
    }
  }
  return () => Object.fromEntries(Object.entries(readers).map(([key, read]) => [key, read()]));
}
