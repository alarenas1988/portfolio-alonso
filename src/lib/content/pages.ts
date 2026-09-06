import type { HomePost, PublicModel } from './home.ts';
import { createUrlHelpers } from '../utils/urls.ts';
import { excerptText, safeExternalUrl } from './presentation.ts';

export const projectStatuses: Record<string, string> = {
  concept: 'Concepto',
  development: 'En desarrollo',
  production: 'En producción',
  completed: 'Completado',
};
export function publicPaths<T extends { row: { slug: string } }>(rows: readonly T[]) {
  const slugs = new Set<string>();
  return rows.map((item) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.row.slug) || slugs.has(item.row.slug))
      throw new Error('Public route slugs must be unique lowercase ASCII.');
    slugs.add(item.row.slug);
    return { params: { slug: item.row.slug }, props: { item } };
  });
}
export function nextProject(content: PublicModel, id: string) {
  if (content.projects.length < 2) return null;
  const index = content.projects.findIndex((project) => project.row.id === id);
  return index < 0 ? null : content.projects[(index + 1) % content.projects.length]!;
}
export function relatedPosts(content: PublicModel, post: HomePost): HomePost[] {
  const categories = new Set(post.categories.map((row) => row.id));
  const tags = new Set(
    content.snapshot.post_tags
      .filter((join) => join.post_id === post.row.id)
      .map((join) => join.tag_id),
  );
  const score = (other: HomePost) => [
    other.categories.filter((row) => categories.has(row.id)).length,
    content.snapshot.post_tags.filter(
      (join) => join.post_id === other.row.id && tags.has(join.tag_id),
    ).length,
  ];
  return content.posts
    .filter((other) => other.row.id !== post.row.id)
    .sort((a, b) => {
      const sa = score(a),
        sb = score(b);
      return (
        sb[0]! - sa[0]! ||
        sb[1]! - sa[1]! ||
        Date.parse(b.row.published_at!) - Date.parse(a.row.published_at!) ||
        a.row.id.localeCompare(b.row.id)
      );
    })
    .slice(0, 3);
}
export function projectFilters(content: PublicModel) {
  return content.stack
    .flatMap((group) => group.technologies)
    .filter((technology) =>
      content.projects.some((project) =>
        project.technologies.some((row) => row.id === technology.id),
      ),
    );
}
export function blogCategories(content: PublicModel) {
  return content.snapshot.categories
    .filter(
      (category) =>
        category.visible &&
        content.posts.some((post) => post.categories.some((row) => row.id === category.id)),
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}
export function pageSeo(
  content: PublicModel,
  path: string,
  title: string,
  description: string,
  overrides?: {
    seo_title: string | null;
    seo_description: string | null;
    canonical_url: string | null;
    robots_policy: string | null;
    og_image_asset_id: string | null;
    featured_image_asset_id?: string | null;
    cover_image_asset_id?: string | null;
  },
) {
  const { absoluteUrl } = createUrlHelpers(
    safeExternalUrl(content.settings.canonical_base) ?? content.siteUrl,
  );
  const imageId =
    overrides?.og_image_asset_id ??
    overrides?.featured_image_asset_id ??
    overrides?.cover_image_asset_id;
  const image = imageId ? content.assets.assets[imageId] : null;
  if (imageId && !image?.variants.length)
    throw new Error('Required public OG image is unavailable.');
  const deploymentBase = new URL(content.siteUrl).pathname.replace(/\/$/, '');
  const editorialPath =
    deploymentBase && path.startsWith(`${deploymentBase}/`)
      ? path.slice(deploymentBase.length)
      : path;
  return {
    title: overrides?.seo_title?.trim() || `${title} — ${content.settings.site_name}`,
    description:
      overrides?.seo_description?.trim() || excerptText(description) || content.seo.description,
    canonical: safeExternalUrl(overrides?.canonical_url ?? null) ?? absoluteUrl(editorialPath),
    robots: overrides?.robots_policy ?? content.seo.robots,
    image: image ? absoluteUrl(image.src) : content.seo.image,
  };
}
