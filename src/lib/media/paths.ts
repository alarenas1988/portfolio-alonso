import type { MediaBucket } from './types.ts';
const roots: Readonly<Record<MediaBucket, readonly string[]>> = {
  'portfolio-public': ['projects', 'technologies', 'profile', 'general'],
  blog: ['posts'],
  documents: ['cv', 'general'],
  private: ['temporary', 'drafts', 'processing'],
};
export function mediaPath(bucket: MediaBucket, folder: string, extension: string): string {
  if (
    !roots[bucket]?.includes(folder) ||
    !(
      bucket === 'documents'
        ? ['pdf']
        : bucket === 'private'
          ? ['jpg', 'png', 'webp', 'avif', 'pdf']
          : ['jpg', 'png', 'webp', 'avif']
    ).includes(extension)
  )
    throw new Error('Destino de archivo no autorizado.');
  return folder + '/' + crypto.randomUUID() + '.' + extension;
}
export function isMediaPath(bucket: string, path: string): bucket is MediaBucket {
  const parts = path.split('/');
  return (
    parts.length === 2 &&
    !!roots[bucket as MediaBucket]?.includes(parts[0] ?? '') &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|avif|pdf)$/.test(
      parts[1] ?? '',
    ) &&
    (bucket === 'documents'
      ? path.endsWith('.pdf')
      : bucket === 'private' || !path.endsWith('.pdf'))
  );
}
