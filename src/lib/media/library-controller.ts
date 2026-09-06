import type { MediaLibrary } from './library.ts';
import { MediaOperationError } from './upload.ts';
import type { EditorialMetadata, MediaAsset, MediaCategory } from './types.ts';
/** Isolated module: the future CMS supplies its authenticated adapter; no global session or routing. */
export function mountMediaLibrary(root: HTMLElement, api: MediaLibrary) {
  const element = <T extends Element>(selector: string) => {
    const result = root.querySelector<T>(selector);
    if (!result) throw new Error('Media component is incomplete.');
    return result;
  };
  const status = element<HTMLElement>('[data-status]'),
    grid = element<HTMLElement>('[data-grid]'),
    form = element<HTMLFormElement>('[data-editor]'),
    progress = element<HTMLProgressElement>('progress');
  const alt = element<HTMLInputElement>('[name=alt]'),
    caption = element<HTMLTextAreaElement>('[name=caption]'),
    decorative = element<HTMLInputElement>('[name=decorative]'),
    category = element<HTMLSelectElement>('[name=category]');
  const search = element<HTMLInputElement>('[name=search]'),
    filter = element<HTMLSelectElement>('[name=filter]'),
    upload = element<HTMLInputElement>('[name=file]'),
    selectedLabel = element<HTMLElement>('[data-selected]');
  const preview = element<HTMLAnchorElement>('[data-preview]');
  let selected: MediaAsset | undefined,
    previous: MediaAsset | undefined,
    offset = 0,
    busy = false;
  const metadata = (): EditorialMetadata => ({
    altText: alt.value,
    caption: caption.value,
    decorative: decorative.checked,
    category: category.value as MediaCategory,
  });
  const report = (message: string) => {
    status.textContent = message;
  };
  function selection(asset: MediaAsset) {
    selected = asset;
    selectedLabel.textContent = asset.filename;
    alt.value = asset.alt_text ?? '';
    caption.value = asset.caption ?? '';
    decorative.checked = asset.decorative;
    category.value = asset.category;
    alt.disabled = asset.decorative;
    preview.hidden = true;
    preview.removeAttribute('href');
    root.querySelectorAll<HTMLButtonElement>('[data-needs-selection]').forEach((button) => {
      button.disabled = false;
    });
    root.dispatchEvent(new CustomEvent('media-select', { detail: { assetId: asset.id } }));
  }
  async function load(append = false) {
    const rows = await api.list({
      search: search.value,
      ...(filter.value ? { category: filter.value as MediaCategory } : {}),
      offset,
    });
    if (!append) grid.replaceChildren();
    for (const asset of rows) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'media-card';
      const kind = document.createElement('span');
      kind.className = 'media-kind';
      kind.textContent = asset.mime_type === 'application/pdf' ? 'PDF' : 'IMG';
      const name = document.createElement('strong');
      name.textContent = asset.filename;
      const detail = document.createElement('span');
      detail.textContent =
        (asset.visibility === 'private' ? 'Privado' : 'Público') +
        ' · ' +
        Math.ceil(asset.file_size / 1024) +
        ' KiB';
      card.append(kind, name, detail);
      card.addEventListener('click', () => selection(asset));
      grid.append(card);
    }
    element<HTMLButtonElement>('[data-more]').hidden = rows.length < 50;
    report(
      grid.childElementCount
        ? grid.childElementCount + ' archivos en la biblioteca.'
        : 'Todavía no hay archivos.',
    );
  }
  async function action(operation: () => Promise<void>) {
    if (busy) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = true;
    });
    try {
      await operation();
    } catch (error) {
      report(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la operación. Puedes reintentar.',
      );
      if (error instanceof MediaOperationError && error.cleanup.length)
        report(
          status.textContent +
            ' Hay ' +
            error.cleanup.length +
            ' objeto(s) pendientes de revisión en el reporte de huérfanos.',
        );
    } finally {
      busy = false;
      root.removeAttribute('aria-busy');
      root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.disabled = button.hasAttribute('data-needs-selection') && !selected;
      });
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void action(async () => {
      const file = upload.files?.[0];
      if (file) {
        const asset = await api.upload(file, metadata(), (event) => {
          const labels = {
            waiting: 'En espera',
            uploading: 'Subiendo',
            processing: 'Procesando',
            complete: 'Completo',
            failed: 'Falló la carga',
          };
          root.dataset.uploadState = event.state;
          report(labels[event.state]);
          progress.hidden = false;
          if (event.percent === null) progress.removeAttribute('value');
          else progress.value = event.percent;
        });
        upload.value = '';
        await load();
        selection(asset);
        report('Archivo privado guardado. Puedes publicarlo cuando esté listo.');
      } else if (selected) {
        selected = await api.update(selected, metadata());
        await load();
        report('Metadata guardada.');
      } else report('Selecciona un archivo para subir.');
    });
  });
  decorative.addEventListener('change', () => {
    alt.disabled = decorative.checked;
    if (decorative.checked) alt.value = '';
  });
  element<HTMLFormElement>('[data-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    offset = 0;
    void action(() => load());
  });
  element<HTMLButtonElement>('[data-more]').addEventListener('click', () => {
    offset += 50;
    void action(() => load(true));
  });
  element<HTMLButtonElement>('[data-new]').addEventListener('click', () => {
    selected = undefined;
    form.reset();
    alt.disabled = false;
    selectedLabel.textContent = 'Nuevo archivo';
    preview.hidden = true;
    root.querySelectorAll<HTMLButtonElement>('[data-needs-selection]').forEach((button) => {
      button.disabled = true;
    });
  });
  element<HTMLButtonElement>('[data-publish]').addEventListener('click', () => {
    void action(async () => {
      if (!selected) return;
      const asset = await api.publish(selected);
      await load();
      selection(asset);
      report('Copia pública creada. El archivo privado se conserva.');
    });
  });
  element<HTMLButtonElement>('[data-usage]').addEventListener('click', () => {
    void action(async () => {
      if (selected) {
        const usage = await api.usage(selected);
        report(
          usage.length
            ? 'Usado en: ' + usage.join('; ')
            : 'Este archivo no tiene usos registrados.',
        );
      }
    });
  });
  element<HTMLButtonElement>('[data-delete]').addEventListener('click', () => {
    void action(async () => {
      if (!selected) return;
      const usage = await api.usage(selected);
      if (usage.length) {
        report('No se puede eliminar. Usado en: ' + usage.join('; '));
        return;
      }
      const cleanup = await api.remove(selected);
      selected = undefined;
      selectedLabel.textContent = 'Nuevo archivo';
      form.reset();
      alt.disabled = false;
      preview.hidden = true;
      await load();
      report(
        cleanup.length
          ? 'Retirado de la biblioteca. Limpieza pendiente: ' + cleanup.join('; ')
          : 'Archivo eliminado.',
      );
    });
  });
  element<HTMLButtonElement>('[data-replace]').addEventListener('click', () => {
    void action(async () => {
      if (!selected) return;
      if (!previous) {
        previous = selected;
        report('Selecciona el archivo nuevo y pulsa Confirmar reemplazo.');
        element<HTMLButtonElement>('[data-replace]').textContent = 'Confirmar reemplazo';
        return;
      }
      await api.replace(previous, selected);
      previous = undefined;
      element<HTMLButtonElement>('[data-replace]').textContent = 'Reemplazar usos';
      await load();
      report('Referencias actualizadas. El archivo anterior se conserva hasta que lo retires.');
    });
  });
  element<HTMLButtonElement>('[data-show-preview]').addEventListener('click', () => {
    void action(async () => {
      if (selected) {
        preview.href = await api.preview(selected);
        preview.hidden = false;
        report(
          selected.visibility === 'private'
            ? 'Vista previa disponible durante 60 segundos.'
            : 'Vista previa pública disponible.',
        );
      }
    });
  });
  element<HTMLButtonElement>('[data-copy]').addEventListener('click', () => {
    void action(async () => {
      if (!selected) return;
      if (selected.visibility !== 'public' || !selected.public_url) {
        report('Un archivo privado no tiene URL pública.');
        return;
      }
      await navigator.clipboard.writeText(selected.public_url);
      report('URL pública copiada.');
    });
  });
  return { ready: action(() => load()) };
}
