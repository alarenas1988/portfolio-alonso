import type { AdminClient } from '../../lib/admin/repository.ts';
import { registerDocument, activateCv } from '../../lib/media/lifecycle.ts';
import { getMedia } from '../../lib/media/repository.ts';
import { createMediaLibrary } from '../../lib/media/library.ts';
import { publishMedia } from '../../lib/media/upload.ts';
import { pickMedia } from '../../lib/admin/media-picker.ts';
import { el, button, link, feedback, confirmAction } from '../../lib/admin/dom.ts';
export async function mountDocuments(root: HTMLElement, client: AdminClient) {
  const status = el('p', '', 'cms-notice'),
    form = el('form', '', 'cms-panel'),
    titleLabel = el('label', 'Título del documento'),
    title = el('input'),
    typeLabel = el('label', 'Tipo'),
    type = el('select');
  title.required = true;
  title.maxLength = 200;
  titleLabel.append(title);
  for (const value of ['cv', 'document']) {
    const opt = el('option', value === 'cv' ? 'Currículum vitae' : 'Documento público');
    opt.value = value;
    type.append(opt);
  }
  typeLabel.append(type);
  let assetId: string | null = null;
  const selection = el('p', 'Ningún PDF seleccionado', 'cms-help'),
    pick = button('Seleccionar / subir PDF', () => {
      void (async () => {
        const asset = await pickMedia(client, true);
        if (asset) {
          assetId = asset.id;
          selection.textContent = asset.filename + ' · ' + asset.visibility;
        }
      })();
    }),
    submit = el('button', 'Registrar documento', 'cms-primary');
  submit.type = 'submit';
  form.append(el('h2', 'Añadir un documento'), titleLabel, typeLabel, pick, selection, submit);
  const list = el('section', '', 'cms-panel');
  root.replaceChildren(form, status, list);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void (async () => {
      if (submit.disabled) return;
      if (!assetId) {
        feedback(status, 'Selecciona un PDF.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        const asset = await getMedia(client, assetId);
        await registerDocument(
          client,
          asset,
          title.value.trim(),
          type.value === 'cv' ? 'cv' : 'document',
        );
        feedback(status, 'Documento registrado. Publica el archivo antes de activarlo.');
        form.reset();
        assetId = null;
        selection.textContent = 'Ningún PDF seleccionado';
        await load();
      } catch {
        feedback(status, 'No se pudo registrar el documento. Tus datos se conservan.', 'error');
      } finally {
        submit.disabled = false;
      }
    })();
  });
  async function load() {
    const { data, error } = await client
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      feedback(status, 'No se pudieron cargar los documentos.', 'error');
      return;
    }
    list.replaceChildren(el('h2', 'Documentos y CV'));
    if (!data.length) list.append(el('p', 'Todavía no hay documentos.', 'cms-empty'));
    for (const doc of data) {
      const item = el('article', '', 'cms-list-row'),
        info = el('div');
      info.append(
        el('h3', doc.title),
        el('span', doc.type + ' · ' + (doc.active ? 'Activo' : 'Inactivo'), 'cms-badge'),
      );
      const actions = el('div', '', 'cms-actions');
      actions.append(
        button('Editar título', () => {
          const edit = el('form', '', 'cms-toolbar'),
            label = el('label', 'Nuevo título'),
            input = el('input'),
            save = el('button', 'Guardar título');
          input.required = true;
          input.maxLength = 200;
          input.value = doc.title;
          label.append(input);
          save.type = 'submit';
          edit.append(
            label,
            save,
            button('Cancelar', () => edit.remove()),
          );
          info.append(edit);
          input.focus();
          edit.addEventListener('submit', (event) => {
            event.preventDefault();
            void (async () => {
              save.disabled = true;
              const result = await client
                .from('documents')
                .update({ title: input.value.trim() })
                .eq('id', doc.id)
                .eq('updated_at', doc.updated_at)
                .select('id')
                .single();
              save.disabled = false;
              if (result.error)
                feedback(
                  status,
                  'No se pudo guardar. Recarga la revisión; el texto se conserva.',
                  'error',
                );
              else {
                feedback(status, 'Título guardado.');
                await load();
              }
            })();
          });
        }),
        button('Publicar PDF', () => {
          void (async () => {
            if (
              !(await confirmAction(
                '¿Publicar una copia del PDF?',
                'Los bytes serán públicos. El documento se vinculará a una ruta nueva y conservarás el archivo privado original.',
                'Publicar PDF',
              ))
            )
              return;
            try {
              const previous = await getMedia(client, doc.asset_id);
              if (previous.visibility === 'public') {
                feedback(status, 'Este PDF ya es público.');
                return;
              }
              const result = await publishMedia(client, previous, {
                bucket: 'documents',
                folder: doc.type === 'cv' ? 'cv' : 'general',
              });
              const saved = await client
                .from('documents')
                .update({ asset_id: result.asset.id })
                .eq('id', doc.id)
                .eq('updated_at', doc.updated_at)
                .select('id')
                .single();
              if (saved.error) {
                feedback(
                  status,
                  'La copia está en Multimedia, pero no se cambió el documento: recarga su revisión. El original se conserva.',
                  'error',
                );
                return;
              }
              feedback(
                status,
                'Copia pública vinculada. Puedes activar el documento; el sitio requiere un rebuild.',
              );
              await load();
            } catch {
              feedback(
                status,
                'No se pudo publicar el PDF. El documento original se conserva.',
                'error',
              );
            }
          })();
        }),
        button('Verificar PDF', () => {
          void (async () => {
            try {
              const asset = await getMedia(client, doc.asset_id),
                url = await createMediaLibrary(client).preview(asset);
              const preview = link('Abrir PDF ↗', url, 'cms-button');
              preview.target = '_blank';
              preview.rel = 'noopener noreferrer';
              preview.referrerPolicy = 'no-referrer';
              actions.append(preview);
            } catch {
              feedback(status, 'No se pudo abrir la vista previa.', 'error');
            }
          })();
        }),
        button(doc.active ? 'Desactivar' : 'Activar', () => {
          void (async () => {
            try {
              if (doc.active) {
                const result = await client
                  .from('documents')
                  .update({ active: false })
                  .eq('id', doc.id)
                  .eq('updated_at', doc.updated_at)
                  .select('id')
                  .single();
                if (result.error) throw result.error;
              } else if (doc.type === 'cv') await activateCv(client, doc.id);
              else {
                const asset = await getMedia(client, doc.asset_id);
                if (asset.visibility !== 'public') throw new Error('Private document');
                const result = await client
                  .from('documents')
                  .update({ active: true })
                  .eq('id', doc.id)
                  .eq('updated_at', doc.updated_at)
                  .select('id')
                  .single();
                if (result.error) throw result.error;
              }
              feedback(
                status,
                'Documento actualizado. El CV anterior se desactiva de forma atómica.',
              );
              await load();
            } catch {
              feedback(
                status,
                'No se pudo activar. Comprueba que el PDF sea público y recarga su revisión.',
                'error',
              );
            }
          })();
        }),
        button('Eliminar registro', () => {
          void (async () => {
            if (
              await confirmAction(
                '¿Eliminar documento?',
                'El archivo multimedia se conservará.',
                'Eliminar registro',
              )
            ) {
              const result = await client
                .from('documents')
                .delete()
                .eq('id', doc.id)
                .eq('updated_at', doc.updated_at)
                .select('id')
                .single();
              feedback(
                status,
                result.error ? 'No se pudo eliminar; recarga la revisión.' : 'Registro eliminado.',
              );
              await load();
            }
          })();
        }),
      );
      item.append(info, actions);
      list.append(item);
    }
  }
  await load();
}
