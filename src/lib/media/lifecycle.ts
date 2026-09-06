import { getMediaUsage } from './usage.ts';
import { getMedia } from './repository.ts';
import { requireOwner } from '../auth/owner.ts';
import { isMediaPath } from './paths.ts';
import type { CleanupIssue, MediaAsset, MediaClient } from './types.ts';
export class AssetInUseError extends Error {
  readonly references: Awaited<ReturnType<typeof getMediaUsage>>;
  constructor(references: Awaited<ReturnType<typeof getMediaUsage>>) {
    super('El archivo está en uso. Reemplázalo o desvincúlalo antes de eliminarlo.');
    this.references = references;
  }
}
export async function deleteMedia(
  client: MediaClient,
  asset: MediaAsset,
): Promise<{ cleanup: readonly CleanupIssue[] }> {
  await requireOwner(client);
  const references = await getMediaUsage(client, asset.id);
  if (references.length) throw new AssetInUseError(references);
  if (!isMediaPath(asset.storage_bucket, asset.storage_path))
    throw new Error('Ubicación no autorizada.');
  // FK constraints are the final authority, including references added concurrently.
  const deleted = await client
    .from('media_assets')
    .delete()
    .eq('id', asset.id)
    .eq('updated_at', asset.updated_at)
    .select('id')
    .single();
  if (deleted.error) throw new Error('No se eliminó el archivo: uso activo o revisión modificada.');
  const removed = await client.storage.from(asset.storage_bucket).remove([asset.storage_path]);
  return {
    cleanup: removed.error
      ? [
          {
            bucket: asset.storage_bucket,
            path: asset.storage_path,
            reason: 'Metadata retirada; bytes pendientes de limpieza explícita.',
          },
        ]
      : [],
  };
}
export async function replaceMedia(
  client: MediaClient,
  previous: MediaAsset,
  replacement: MediaAsset,
): Promise<void> {
  const { error } = await client.rpc('replace_media_asset', {
    previous_id: previous.id,
    replacement_id: replacement.id,
    expected_updated_at: previous.updated_at,
  });
  if (error)
    throw new Error(
      'Reemplazo no confirmado. El archivo anterior se conserva; revisa sus usos antes de reintentar.',
    );
  const remaining = await getMediaUsage(client, previous.id);
  if (remaining.length) throw new Error('El reemplazo requiere revisar referencias pendientes.');
  await getMedia(client, replacement.id);
}
export async function activateCv(client: MediaClient, documentId: string): Promise<void> {
  const { error } = await client.rpc('activate_cv', { document_id: documentId });
  if (error) throw new Error('No se pudo activar el CV. Se conserva la selección anterior.');
}
export async function registerDocument(
  client: MediaClient,
  asset: MediaAsset,
  title: string,
  type: 'cv' | 'document' = 'cv',
) {
  if (asset.mime_type !== 'application/pdf') throw new Error('El documento debe ser PDF.');
  const { data, error } = await client
    .from('documents')
    .insert({ asset_id: asset.id, title, type, active: false, storage_path: asset.storage_path })
    .select()
    .single();
  if (error) throw new Error('No se pudo registrar el documento.');
  return data;
}
export async function privatePreview(client: MediaClient, asset: MediaAsset): Promise<string> {
  await requireOwner(client);
  if (asset.visibility !== 'private' || asset.storage_bucket !== 'private')
    throw new Error('Se requiere un archivo privado.');
  const { data, error } = await client.storage
    .from('private')
    .createSignedUrl(asset.storage_path, 60);
  if (error) throw new Error('No se pudo crear la vista previa.');
  return data.signedUrl; // Ephemeral: never persisted or passed to the build.
}
