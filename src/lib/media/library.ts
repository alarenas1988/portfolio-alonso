import { listMedia, updateMetadata } from './repository.ts';
import { uploadPrivate, publishMedia } from './upload.ts';
import { getMediaUsage } from './usage.ts';
import { deleteMedia, replaceMedia, privatePreview } from './lifecycle.ts';
import type {
  EditorialMetadata,
  MediaAsset,
  MediaCategory,
  MediaClient,
  UploadProgress,
} from './types.ts';
export interface MediaLibrary {
  list: (query: {
    search: string;
    category?: MediaCategory;
    offset: number;
  }) => Promise<MediaAsset[]>;
  upload: (
    file: File,
    metadata: EditorialMetadata,
    onProgress: (progress: UploadProgress) => void,
  ) => Promise<MediaAsset>;
  update: (asset: MediaAsset, metadata: EditorialMetadata) => Promise<MediaAsset>;
  publish: (asset: MediaAsset) => Promise<MediaAsset>;
  usage: (asset: MediaAsset) => Promise<string[]>;
  remove: (asset: MediaAsset) => Promise<string[]>;
  replace: (previous: MediaAsset, replacement: MediaAsset) => Promise<void>;
  preview: (asset: MediaAsset) => Promise<string>;
}
export function createMediaLibrary(client: MediaClient): MediaLibrary {
  return {
    list: (query) => listMedia(client, query),
    upload: async (file, metadata, onProgress) =>
      (await uploadPrivate(client, file, metadata, { onProgress })).asset,
    update: (asset, metadata) => updateMetadata(client, asset, metadata),
    publish: async (asset) => {
      const target =
        asset.mime_type === 'application/pdf'
          ? { bucket: 'documents' as const, folder: 'general' }
          : asset.category === 'blog'
            ? { bucket: 'blog' as const, folder: 'posts' }
            : {
                bucket: 'portfolio-public' as const,
                folder:
                  asset.category === 'project'
                    ? 'projects'
                    : asset.category === 'profile'
                      ? 'profile'
                      : 'general',
              };
      return (await publishMedia(client, asset, target)).asset;
    },
    usage: async (asset) =>
      (await getMediaUsage(client, asset.id)).map(
        (ref) => ref.entity_type + ' / ' + ref.entity_id + ' / ' + ref.field,
      ),
    remove: async (asset) =>
      (await deleteMedia(client, asset)).cleanup.map(
        (issue) => issue.reason + ' ' + issue.bucket + '/' + issue.path,
      ),
    replace: (previous, replacement) => replaceMedia(client, previous, replacement),
    preview: async (asset) =>
      asset.visibility === 'private' ? privatePreview(client, asset) : asset.public_url!,
  };
}
