import { requireOwner } from '../auth/owner.ts';
import type { MediaBucket, MediaClient } from './types.ts';
export interface OrphanReport {
  complete: boolean;
  objectsWithoutMetadata: { bucket: MediaBucket; path: string }[];
  metadataWithoutObjects: { id: string; bucket: string; path: string }[];
  unavailableObjects: { id: string; bucket: string; path: string; reason: string }[];
  identityMismatches: {
    id: string;
    bucket: string;
    path: string;
    expectedObjectId: string;
    actualObjectId: string;
  }[];
}
export async function reportMediaOrphans(client: MediaClient): Promise<OrphanReport> {
  await requireOwner(client);
  const objects = new Map<string, { bucket: MediaBucket; path: string; objectId: string }>();
  for (const bucket of ['portfolio-public', 'blog', 'documents', 'private'] as const) {
    const folders = [''];
    while (folders.length) {
      const folder = folders.shift()!;
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.storage
          .from(bucket)
          .list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw new Error('No se pudo completar el inventario de Storage.');
        for (const item of data) {
          const path = (folder ? folder + '/' : '') + item.name;
          if (item.id) objects.set(bucket + '/' + path, { bucket, path, objectId: item.id });
          else {
            if (path.split('/').length > 8) throw new Error('Inventario demasiado profundo.');
            folders.push(path);
          }
          if (objects.size + folders.length > 10000)
            throw new Error('Inventario demasiado grande; requiere revisión por lotes.');
        }
        if (data.length < 100) break;
      }
    }
  }
  const assets: {
    id: string;
    storage_object_id: string;
    storage_bucket: string;
    storage_path: string;
  }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from('media_assets')
      .select('id,storage_object_id,storage_bucket,storage_path')
      .order('id')
      .range(offset, offset + 499);
    if (error) throw new Error('No se pudo completar el inventario de metadata.');
    assets.push(...data);
    if (data.length < 500) break;
    if (assets.length > 10000)
      throw new Error('Inventario demasiado grande; requiere revisión por lotes.');
  }
  const tracked = new Set(
    assets.map((a) => a.storage_object_id + '/' + a.storage_bucket + '/' + a.storage_path),
  );
  const missing: OrphanReport['metadataWithoutObjects'] = [];
  const unavailable: OrphanReport['unavailableObjects'] = [];
  const mismatches: OrphanReport['identityMismatches'] = [];
  for (const asset of assets) {
    const key = asset.storage_bucket + '/' + asset.storage_path;
    const object = objects.get(key);
    if (object && object.objectId !== asset.storage_object_id) {
      mismatches.push({
        id: asset.id,
        bucket: asset.storage_bucket,
        path: asset.storage_path,
        expectedObjectId: asset.storage_object_id,
        actualObjectId: object.objectId,
      });
      continue;
    }
    const result = objects.has(key)
      ? await client.storage.from(asset.storage_bucket).download(asset.storage_path)
      : { data: false, error: null };
    if (
      result.error &&
      ![400, 404].includes(Number('status' in result.error ? result.error.status : 0))
    ) {
      unavailable.push({
        id: asset.id,
        bucket: asset.storage_bucket,
        path: asset.storage_path,
        reason:
          'Los bytes no se pudieron verificar. Revisar el backend; no eliminar automáticamente.',
      });
      continue;
    }
    if (!result.data)
      missing.push({ id: asset.id, bucket: asset.storage_bucket, path: asset.storage_path });
  }
  return {
    complete: unavailable.length === 0 && mismatches.length === 0,
    identityMismatches: mismatches,
    unavailableObjects: unavailable,
    objectsWithoutMetadata: [...objects.entries()]
      .filter(([key, value]) => !tracked.has(value.objectId + '/' + key))
      .map(([, value]) => ({ bucket: value.bucket, path: value.path })),
    metadataWithoutObjects: missing,
  };
}
