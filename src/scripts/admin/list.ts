import type { AdminClient } from '../../lib/admin/repository.ts';
import { listRecords } from '../../lib/admin/repository.ts';
import { resources, resourceRoute, type ResourceName } from '../../lib/admin/resources.ts';
import { el, button, link, confirmAction } from '../../lib/admin/dom.ts';
import { getPublicConfig } from '../../lib/config/public.ts';
import { createUrlHelpers } from '../../lib/utils/urls.ts';
import { moduleFailure } from './modules.ts';
import { editorialLabel } from '../../lib/admin/labels.ts';
export async function mountList(root: HTMLElement, client: AdminClient, table: ResourceName) {
  const spec = resources[table],
    { withBase } = createUrlHelpers(getPublicConfig().siteUrl),
    base = '/admin/' + resourceRoute(table) + '/';
  const toolbar = el('form', '', 'cms-toolbar'),
    searchLabel = el('label', 'Buscar'),
    search = el('input');
  search.type = 'search';
  search.placeholder = 'Buscar ' + spec.label.toLowerCase();
  searchLabel.append(search);
  const filterLabel = el('label', 'Estado'),
    filter = el('select');
  filter.setAttribute('aria-label', 'Estado');
  for (const [value, label] of [
    ['', 'Todos'],
    ['published', 'Publicados'],
    ['draft', 'Borradores'],
    ['featured', 'Destacados'],
    ['archived', 'Archivados'],
  ]) {
    const opt = el('option', label);
    opt.value = value!;
    filter.append(opt);
  }
  filterLabel.append(filter);
  const orderLabel = el('label', 'Orden'),
    order = el('select');
  order.setAttribute('aria-label', 'Orden');
  for (const [value, label] of [
    ['desc', 'Más recientes'],
    ['asc', 'Más antiguos'],
  ]) {
    const opt = el('option', label);
    opt.value = value!;
    order.append(opt);
  }
  orderLabel.append(order);
  let page = 0;
  const listing = el('section', '', 'cms-panel'),
    pager = el('div', '', 'cms-pagination'),
    status = el('p', '', 'cms-help');
  status.setAttribute('role', 'status');
  const actions = el('div', '', 'cms-toolbar-actions');
  const newEditor = async (id?: string) => {
    const { mountEditor } = await import('./editor.ts');
    await mountEditor(root, client, table, id);
    root.prepend(
      button('← Volver al listado', () => {
        void (async () => {
          if (
            root.dataset.dirty === 'true' &&
            !(await confirmAction(
              '¿Descartar los cambios locales?',
              'Hay cambios que todavía no se han guardado.',
              'Volver al listado',
            ))
          )
            return;
          window.dispatchEvent(new Event('admin-dispose'));
          void mountList(root, client, table);
        })();
      }),
    );
  };
  actions.append(
    ['projects', 'posts'].includes(table)
      ? link('+ Nuevo ' + spec.singular, withBase(base + 'new/'), 'cms-button cms-primary')
      : button(
          '+ Crear ' + spec.singular,
          () => {
            void newEditor();
          },
          'cms-primary',
        ),
  );
  if (table === 'posts') {
    actions.append(
      link('Categorías', withBase('/admin/categories/'), 'cms-button'),
      link('Tags', withBase('/admin/tags/'), 'cms-button'),
    );
  }
  toolbar.append(searchLabel);
  if (['projects', 'posts'].includes(table)) toolbar.append(filterLabel);
  toolbar.append(
    orderLabel,
    button('Buscar', () => {
      page = 0;
      void load();
    }),
    actions,
  );
  toolbar.addEventListener('submit', (e) => {
    e.preventDefault();
    page = 0;
    void load();
  });
  root.replaceChildren(toolbar, status, listing, pager);
  async function load() {
    listing.setAttribute('aria-busy', 'true');
    try {
      const data = await listRecords(client, table, {
        page,
        search: search.value,
        filter: filter.value,
        ascending: order.value === 'asc',
      });
      status.textContent = data.count + (data.count === 1 ? ' registro' : ' registros');
      listing.replaceChildren();
      if (!data.rows.length) {
        const empty = el('div', '', 'cms-empty');
        empty.append(
          el('h2', 'Tu contenido empieza aquí'),
          el('p', 'Crea un ' + spec.singular + ' cuando tengas información lista para compartir.'),
        );
        listing.append(empty);
      } else
        for (const row of data.rows) {
          const item = el('article', '', 'cms-list-row'),
            text = el('div');
          text.append(
            el('h3', String(row.title ?? row.name ?? row.position ?? row.label ?? 'Registro')),
            el(
              'p',
              String(
                row.summary ?? row.excerpt ?? row.description ?? row.organization ?? row.slug ?? '',
              ).slice(0, 160),
            ),
          );
          const buttons = el('div', '', 'cms-actions');
          buttons.append(
            el(
              'span',
              row.status
                ? editorialLabel(String(row.status))
                : row.published || row.visible
                  ? 'Visible'
                  : 'Borrador / oculto',
              'cms-badge',
            ),
            ['projects', 'posts'].includes(table)
              ? link('Editar', withBase(base + 'edit/') + '?id=' + row.id, 'cms-button')
              : button('Editar', () => {
                  void newEditor(row.id);
                }),
          );
          item.append(text, buttons);
          listing.append(item);
        }
      const prev = button('← Anterior', () => {
          page--;
          void load();
        }),
        next = button('Siguiente →', () => {
          page++;
          void load();
        });
      prev.disabled = page === 0;
      next.disabled = (page + 1) * 20 >= data.count;
      pager.replaceChildren(
        prev,
        el('span', 'Página ' + (page + 1) + ' de ' + Math.max(1, Math.ceil(data.count / 20))),
        next,
      );
    } catch {
      moduleFailure(listing, () => {
        void load();
      });
    } finally {
      listing.removeAttribute('aria-busy');
    }
  }
  filter.addEventListener('change', () => {
    page = 0;
    void load();
  });
  order.addEventListener('change', () => {
    page = 0;
    void load();
  });
  await load();
}
