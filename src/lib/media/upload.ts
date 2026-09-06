import { requireOwner } from '../auth/owner.ts';
import { validateBrowserFile } from './validation.ts';
import { mediaPath } from './paths.ts';
import type {
  CleanupIssue,
  EditorialMetadata,
  FileValidator,
  MediaAsset,
  MediaBucket,
  MediaClient,
  UploadProgress,
  UploadResult,
} from './types.ts';

export class MediaOperationError extends Error {
  readonly cleanup: readonly CleanupIssue[];
  constructor(message: string, cleanup: readonly CleanupIssue[] = []) {
    super(message);
    this.name = 'MediaOperationError';
    this.cleanup = cleanup;
  }
}
export interface UploadOptions {
  validate?: FileValidator;
  onProgress?: (progress: UploadProgress) => void;
}
async function storeFile(
  client: MediaClient,
  file: File,
  metadata: EditorialMetadata,
  bucket: MediaBucket,
  folder: string,
  options: UploadOptions,
): Promise<UploadResult> {
  const notify = (state: UploadProgress['state'], percent: number | null) =>
    options.onProgress?.({ state, percent });
  notify('waiting', 0);
  try {
    const owner = await requireOwner(client);
    notify('processing', null);
    const valid = await (options.validate ?? validateBrowserFile)(file, metadata);
    const path = mediaPath(bucket, folder, valid.extension);
    notify('uploading', null);
    const uploaded = await client.storage.from(bucket).upload(path, valid.bytes, {
      contentType: valid.mime,
      upsert: false,
      cacheControl: '31536000',
    });
    if (uploaded.error)
      throw new MediaOperationError('No se pudo subir el archivo. Puedes reintentar.', [
        { bucket, path, reason: 'Comprueba si el upload llegó a persistirse antes de reintentar.' },
      ]);
    notify('processing', null);
    const row = {
      storage_bucket: bucket,
      storage_path: path,
      public_url:
        bucket === 'private' ? null : client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
      filename: valid.filename,
      mime_type: valid.mime,
      file_size: valid.size,
      width: valid.width,
      height: valid.height,
      alt_text: metadata.altText,
      decorative: metadata.decorative,
      caption: metadata.caption,
      category: metadata.category,
      visibility: bucket === 'private' ? 'private' : 'public',
      created_by: owner.id,
    };
    const registered = await client.from('media_assets').insert(row).select().single();
    if (registered.error) {
      // A lost response may follow a committed insert. Reconcile before compensation.
      const persisted = await client
        .from('media_assets')
        .select('*')
        .eq('storage_bucket', bucket)
        .eq('storage_path', path)
        .maybeSingle();
      if (persisted.data) {
        notify('complete', 100);
        return { asset: persisted.data, cleanup: [] };
      }
      if (persisted.error)
        throw new MediaOperationError(
          'No se pudo confirmar el registro. Revisa los archivos pendientes.',
          [{ bucket, path, reason: 'Resultado de registro desconocido.' }],
        );
      const cleanup = await client.storage.from(bucket).remove([path]);
      throw new MediaOperationError(
        'No se pudo registrar el archivo. Tus datos siguen disponibles para reintentar.',
        cleanup.error
          ? [{ bucket, path, reason: 'Falló la compensación; objeto sin metadata.' }]
          : [],
      );
    }
    notify('complete', 100);
    return { asset: registered.data, cleanup: [] };
  } catch (error) {
    notify('failed', null);
    throw error;
  }
}
/** Every ordinary upload starts private. Publishing requires a separate explicit call. */
export async function uploadPrivate(
  client: MediaClient,
  file: File,
  metadata: EditorialMetadata,
  options: UploadOptions = {},
): Promise<UploadResult> {
  return storeFile(client, file, metadata, 'private', 'temporary', options);
}
export async function publishMedia(
  client: MediaClient,
  asset: MediaAsset,
  target: { bucket: Exclude<MediaBucket, 'private'>; folder: string },
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (asset.storage_bucket !== 'private' || asset.visibility !== 'private')
    throw new Error('Publica una copia validada del archivo privado.');
  await requireOwner(client);
  const { data, error } = await client.storage.from('private').download(asset.storage_path);
  if (error) throw new Error('No se pudo leer el archivo privado.');
  return storeFile(
    client,
    new File([data], asset.filename, { type: asset.mime_type }),
    {
      altText: asset.alt_text ?? '',
      decorative: asset.decorative,
      caption: asset.caption ?? '',
      category: asset.category as EditorialMetadata['category'],
    },
    target.bucket,
    target.folder,
    options,
  );
}
