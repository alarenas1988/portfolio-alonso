import type { AdminClient } from '../../lib/admin/repository.ts';
import { createMediaLibrary } from '../../lib/media/library.ts';
import { mountMediaLibrary } from '../../lib/media/library-controller.ts';
import { confirmAction } from '../../lib/admin/dom.ts';
export async function mountMedia(root: HTMLElement, client: AdminClient) {
  const library = createMediaLibrary(client);
  const api = {
    ...library,
    remove: async (asset: Parameters<typeof library.remove>[0]) => {
      if (
        !(await confirmAction(
          '¿Eliminar archivo?',
          'Se retirarán metadata y bytes únicamente si no existen referencias.',
          'Eliminar archivo',
        ))
      )
        throw new Error('Eliminación cancelada.');
      return library.remove(asset);
    },
  };
  const component = root.querySelector<HTMLElement>('.media-library')!;
  await mountMediaLibrary(component, api).ready;
}
