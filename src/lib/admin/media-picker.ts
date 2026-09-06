import type { AdminClient } from './repository.ts';
import type { MediaAsset } from '../media/types.ts';
import { listMedia, getMedia } from '../media/repository.ts';
import { uploadPrivate } from '../media/upload.ts';
import { createMediaLibrary } from '../media/library.ts';
import { el, button, feedback } from './dom.ts';
/** F8 services supply every file operation. This dialog only selects an editorial asset ID. */
export function pickMedia(client: AdminClient, pdf = false): Promise<MediaAsset | null> {
  return new Promise((resolve) => {
    const previous = document.activeElement,
      dialog = el('dialog', '', 'cms-dialog');
    const previousOverflow = document.body.style.overflow;
    dialog.setAttribute('aria-label', 'Seleccionar archivo');
    const heading = el('h2', 'Seleccionar archivo'),
      status = el('p', '', 'cms-notice'),
      grid = el('div', '', 'cms-pick-grid');
    const search = el('input');
    search.type = 'search';
    search.setAttribute('aria-label', 'Buscar archivo');
    const form = el('form');
    form.append(
      search,
      button('Buscar', () => {
        void load();
      }),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void load();
    });
    const upload = el('details');
    upload.append(el('summary', 'Cargar un archivo privado'));
    const fileLabel = el('label', 'Archivo'),
      file = el('input');
    file.type = 'file';
    file.accept = pdf ? '.pdf' : '.jpg,.jpeg,.png,.webp,.avif';
    fileLabel.append(file);
    const altLabel = el('label', 'Texto alternativo'),
      alt = el('input');
    altLabel.append(alt);
    const decorativeLabel = el('label', 'Imagen decorativa', 'cms-check'),
      decorative = el('input');
    decorative.type = 'checkbox';
    decorativeLabel.prepend(decorative);
    let selected: MediaAsset | null = null,
      offset = 0;
    const submit = button('Subir archivo', () => {
      void (async () => {
        if (!file.files?.[0]) {
          feedback(status, 'Selecciona un archivo.', 'error');
          return;
        }
        submit.disabled = true;
        try {
          const result = await uploadPrivate(client, file.files[0], {
            altText: decorative.checked ? '' : alt.value,
            decorative: decorative.checked,
            caption: '',
            category: pdf ? 'document' : 'general',
          });
          selected = result.asset;
          dialog.close();
        } catch (e) {
          feedback(
            status,
            e instanceof Error ? e.message : 'No se pudo subir el archivo.',
            'error',
          );
        } finally {
          submit.disabled = false;
        }
      })();
    });
    upload.append(fileLabel);
    if (!pdf) upload.append(altLabel, decorativeLabel);
    upload.append(submit);
    const more = button('Más archivos', () => {
      offset += 50;
      void load(true);
    });
    more.hidden = true;
    async function load(append = false) {
      try {
        const rows = await listMedia(client, { search: search.value, offset });
        if (!append) grid.replaceChildren();
        for (const asset of rows.filter((a) =>
          pdf ? a.mime_type === 'application/pdf' : a.mime_type.startsWith('image/'),
        )) {
          const choice = button(
            asset.filename + ' · ' + (asset.visibility === 'public' ? 'Público' : 'Privado'),
            () => {
              selected = asset;
              dialog.close();
            },
          );
          const details = el(
            'span',
            asset.decorative ? 'Decorativa' : asset.alt_text || 'Sin texto alternativo',
            'cms-help',
          );
          choice.append(details);
          if (!pdf) {
            const image = el('img');
            image.alt = '';
            image.width = 160;
            image.height = 90;
            image.loading = 'lazy';
            image.style.objectFit = 'contain';
            void createMediaLibrary(client)
              .preview(asset)
              .then((url) => {
                if (dialog.open) {
                  image.src = url;
                  choice.prepend(image);
                }
              })
              .catch(() => {});
          }
          grid.append(choice);
        }
        more.hidden = rows.length < 50;
        feedback(
          status,
          grid.childElementCount
            ? 'Selecciona un archivo existente.'
            : 'No hay archivos compatibles. Puedes cargar uno.',
        );
      } catch {
        feedback(status, 'No se pudo cargar la biblioteca. Reintenta la búsqueda.', 'error');
      }
    }
    search.addEventListener('input', () => {
      offset = 0;
    });
    dialog.append(
      heading,
      form,
      grid,
      more,
      upload,
      status,
      button('Cancelar', () => dialog.close()),
    );
    document.body.append(dialog);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    });
    search.focus();
    void load();
    dialog.addEventListener(
      'close',
      () => {
        dialog.remove();
        document.body.style.overflow = previousOverflow;
        if (previous instanceof HTMLElement) previous.focus();
        resolve(selected);
      },
      { once: true },
    );
  });
}
export async function describeMedia(client: AdminClient, id: string) {
  try {
    return (await getMedia(client, id)).filename;
  } catch {
    return 'Archivo no disponible';
  }
}
