import type { EditorialMetadata, MediaAsset, MediaClient, MediaCategory } from './types.ts';
export async function listMedia(
  client: MediaClient,
  options: { search?: string; category?: MediaCategory; offset?: number } = {},
): Promise<MediaAsset[]> {
  let query = client
    .from('media_assets')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id')
    .range(options.offset ?? 0, (options.offset ?? 0) + 49);
  if (options.category) query = query.eq('category', options.category);
  if (options.search)
    query = query.ilike('filename', '%' + options.search.replace(/[\\%_]/g, '') + '%');
  const { data, error } = await query;
  if (error) throw new Error('No se pudo cargar la biblioteca.');
  return data;
}
export async function getMedia(client: MediaClient, id: string): Promise<MediaAsset> {
  const { data, error } = await client.from('media_assets').select('*').eq('id', id).single();
  if (error) throw new Error('El archivo no existe o no tienes acceso.');
  return data;
}
export async function updateMetadata(
  client: MediaClient,
  asset: MediaAsset,
  metadata: EditorialMetadata,
): Promise<MediaAsset> {
  const { validateEditorial } = await import('./validation.ts');
  validateEditorial(metadata, asset.mime_type.startsWith('image/'));
  const { data, error } = await client
    .from('media_assets')
    .update({
      alt_text: metadata.altText,
      decorative: metadata.decorative,
      caption: metadata.caption,
      category: metadata.category,
    })
    .eq('id', asset.id)
    .eq('updated_at', asset.updated_at)
    .select()
    .single();
  if (error)
    throw new Error('No se guardaron los cambios. Recarga para comprobar la revisión del archivo.');
  return data;
}
