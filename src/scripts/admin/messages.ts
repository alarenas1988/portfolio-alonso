import type { AdminClient } from '../../lib/admin/repository.ts';
import type { Tables } from '../../types/database.ts';
import { el, button, link, feedback, confirmAction } from '../../lib/admin/dom.ts';
import { dateLabel } from './overview.ts';
import { databaseError, errorMessage } from '../../lib/admin/errors.ts';
import { editorialLabel } from '../../lib/admin/labels.ts';
export async function mountMessages(root: HTMLElement, client: AdminClient) {
  const filterLabel = el('label', 'Estado del mensaje'),
    filter = el('select');
  for (const value of ['', 'new', 'read', 'replied', 'archived']) {
    const opt = el('option', editorialLabel(value) || 'Todos');
    opt.value = value;
    filter.append(opt);
  }
  filterLabel.append(filter);
  const toolbar = el('div', '', 'cms-toolbar'),
    status = el('p', '', 'cms-notice'),
    list = el('section', '', 'cms-panel'),
    detail = el('section', '', 'cms-panel'),
    columns = el('div', '', 'cms-columns'),
    pager = el('div', '', 'cms-pagination');
  toolbar.append(
    filterLabel,
    button('Actualizar', () => {
      void load();
    }),
  );
  columns.append(list, detail);
  root.replaceChildren(toolbar, status, columns, pager);
  detail.append(el('p', 'Selecciona un mensaje para leerlo.', 'cms-muted'));
  let page = 0;
  async function open(message: Tables<'contact_messages'>) {
    detail.replaceChildren(
      el('h2', message.subject),
      el('p', message.name + ' · ' + message.email, 'cms-muted'),
      el('p', dateLabel(message.created_at), 'cms-help'),
      el('p', message.message, 'cms-message-body'),
    );
    const actions = el('div', '', 'cms-toolbar');
    const email =
      'mailto:' +
      encodeURIComponent(message.email) +
      '?subject=' +
      encodeURIComponent('Re: ' + message.subject);
    actions.append(
      link('Responder en mi correo ↗', email, 'cms-button'),
      button('Copiar correo', () => {
        void navigator.clipboard.writeText(message.email).then(
          () => feedback(status, 'Correo copiado.'),
          () => feedback(status, 'No se pudo copiar el correo.', 'error'),
        );
      }),
    );
    for (const [next, label] of [
      ['read', 'Marcar leído'],
      ['replied', 'Marcar respondido'],
      ['archived', 'Archivar'],
    ])
      actions.append(
        button(label!, () => {
          void (async () => {
            if (
              next === 'archived' &&
              !(await confirmAction(
                '¿Archivar mensaje?',
                'El mensaje se conservará en el archivo.',
                'Archivar',
              ))
            )
              return;
            const { data, error } = await client
              .from('contact_messages')
              .update({ status: next! })
              .eq('id', message.id)
              .eq('updated_at', message.updated_at)
              .select('*')
              .single();
            if (error) {
              feedback(status, errorMessage(databaseError(error)), 'error');
              return;
            }
            feedback(
              status,
              'Estado actualizado. Las respuestas por correo se gestionan en tu cliente de email.',
            );
            await open(data);
            await load();
          })();
        }),
      );
    detail.append(actions, el('p', 'Marcar respondido no envía un correo.', 'cms-help'));
  }
  async function load() {
    try {
      let query = client
        .from('contact_messages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id')
        .range(page * 20, page * 20 + 19);
      if (filter.value) query = query.eq('status', filter.value);
      const { data, error, count } = await query;
      if (error) throw error;
      list.replaceChildren(el('h2', 'Bandeja de entrada'));
      if (!data.length) list.append(el('p', 'No hay mensajes en este estado.', 'cms-empty'));
      for (const m of data) {
        const item = el('article', '', 'cms-list-row'),
          info = el('div');
        info.append(
          el('h3', m.subject),
          el('p', m.name + ' · ' + dateLabel(m.created_at)),
          el('span', editorialLabel(m.status), 'cms-badge'),
        );
        item.append(
          info,
          button('Leer mensaje', () => {
            void open(m);
          }),
        );
        list.append(item);
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
      next.disabled = (page + 1) * 20 >= (count ?? 0);
      pager.replaceChildren(
        prev,
        el('span', (count ?? 0) + (count === 1 ? ' mensaje' : ' mensajes')),
        next,
      );
    } catch {
      feedback(status, 'No se pudo cargar la bandeja. Reintenta.', 'error');
    }
  }
  filter.addEventListener('change', () => {
    page = 0;
    void load();
  });
  await load();
}
