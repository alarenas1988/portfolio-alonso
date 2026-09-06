import type { MediaClient, MediaReference } from './types.ts';
export async function getMediaUsage(client: MediaClient, id: string): Promise<MediaReference[]> {
  const { data, error } = await client
    .from('media_references')
    .select('*')
    .eq('asset_id', id)
    .order('entity_type');
  if (error) throw new Error('No se pudo comprobar el uso del archivo.');
  return data;
}
export function markdownAssetIds(markdown: string): string[] {
  return [
    ...new Set(
      [
        ...markdown.matchAll(
          /media:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g,
        ),
      ].map((m) => m[1]!),
    ),
  ];
}
