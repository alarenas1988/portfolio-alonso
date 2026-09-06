import { renderMarkdown } from '../markdown/render.ts';
import { markdownAssetIds } from '../media/usage.ts';
import { getMedia } from '../media/repository.ts';
import type { AssetMap } from '../media/build-assets.ts';
import type { AdminClient } from './repository.ts';
import { createUrlHelpers } from '../utils/urls.ts';
/** The exact F4 parser, sanitizer, headings and code renderer. Preview bytes are ephemeral. */
export async function renderAdminPreview(client: AdminClient, source: string, siteUrl: string) {
  const { withBase } = createUrlHelpers(siteUrl),
    assets: AssetMap = { version: 1, assets: {} },
    urls = new Map<string, string>();
  const dispose = () => {
    for (const url of urls.values()) URL.revokeObjectURL(url);
  };
  try {
    const ids = markdownAssetIds(source);
    if (ids.length > 40) throw new Error('Preview supports at most 40 images.');
    for (const id of ids) {
      const asset = await getMedia(client, id);
      if (!asset.width || !asset.height || !asset.mime_type.startsWith('image/'))
        throw new Error('Invalid preview image');
      const { data, error } = await client.storage
        .from(asset.storage_bucket)
        .download(asset.storage_path);
      if (error) throw error;
      const src = withBase('/assets/media/preview-' + id + '.png');
      urls.set(src, URL.createObjectURL(data));
      assets.assets[id] = {
        src,
        width: asset.width,
        height: asset.height,
        alt: asset.alt_text ?? '',
        variants: [{ src, width: asset.width, height: asset.height, format: 'png' }],
      };
    }
    const result = await renderMarkdown(source, { siteUrl, assets, prefix: 'preview' });
    const template = document.createElement('template');
    template.innerHTML = result.html;
    for (const img of template.content.querySelectorAll('img')) {
      const blob = urls.get(img.getAttribute('src') ?? '');
      if (!blob) throw new Error('Unresolved preview media');
      img.src = blob;
      img
        .closest('picture')
        ?.querySelectorAll('source')
        .forEach((n) => n.remove());
    }
    return {
      fragment: template.content,
      toc: result.toc,
      readingTime: result.readingTime,
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
