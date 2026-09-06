import type { AdminClient } from '../../lib/admin/repository.ts';
import { routeResources, resources } from '../../lib/admin/resources.ts';
import { readEditorId } from '../../lib/admin/routes.ts';
import { el, button } from '../../lib/admin/dom.ts';
export async function mountModule(root: HTMLElement, route: string, client: AdminClient) {
  if (route === 'media') {
    const { mountMedia } = await import('./media.ts');
    await mountMedia(root, client);
    return;
  }
  if (route === 'messages') {
    const { mountMessages } = await import('./messages.ts');
    await mountMessages(root, client);
    return;
  }
  if (route === 'analytics') {
    const { mountAnalytics } = await import('./analytics.ts');
    await mountAnalytics(root, client);
    return;
  }
  if (route === '' || route === 'builds') {
    const { mountOverview } = await import('./overview.ts');
    await mountOverview(root, client, route === 'builds');
    return;
  }
  if (route === 'documents') {
    const { mountDocuments } = await import('./documents.ts');
    await mountDocuments(root, client);
    return;
  }
  const table = routeResources[route.split('/')[0]!];
  if (!table) {
    root.replaceChildren(el('p', 'Módulo no disponible.'));
    return;
  }
  if (route.endsWith('/edit') || route.endsWith('/new') || resources[table].singleton) {
    const id = route.endsWith('/edit') ? readEditorId(location.search) : null;
    if (route.endsWith('/edit') && !id) {
      root.replaceChildren(
        el('div', 'El identificador no es válido. Vuelve al listado.', 'cms-empty'),
      );
      return;
    }
    const { mountEditor } = await import('./editor.ts');
    await mountEditor(root, client, table, id ?? undefined, route === 'seo');
  } else {
    const { mountList } = await import('./list.ts');
    await mountList(root, client, table);
  }
}
export function moduleFailure(root: HTMLElement, retry: () => void) {
  root.replaceChildren(
    el('p', 'No se pudo cargar la información. Comprueba la conexión.', 'cms-notice'),
    button('Reintentar', retry),
  );
}
