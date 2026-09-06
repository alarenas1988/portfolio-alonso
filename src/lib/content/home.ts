import type { PublicSnapshot, PublicSnapshotRows as Rows } from '../../types/content.ts';
import type { AssetMap } from '../media/build-assets.ts';
import { createUrlHelpers } from '../utils/urls.ts';
import { readingTime } from '../markdown/reading-time.ts';
import {
  emailActions,
  excerptText,
  formatEditorialDate,
  formatPeriod,
  safeExternalUrl,
  whatsappUrl,
} from './presentation.ts';

const byOrder = (a: { sort_order: number }, b: { sort_order: number }) =>
  a.sort_order - b.sort_order;
const visible = <T extends { visible: boolean; sort_order: number }>(rows: readonly T[]) =>
  rows.filter((row) => row.visible).sort(byOrder);

export interface HomeProject {
  href: string;
  row: Rows['projects'];
  technologies: readonly Rows['technologies'][];
  impact: Rows['project_metrics'] | null;
  imageId: string | null;
  action: { href: string; label: string } | null;
}
export interface HomePost {
  href: string;
  readingTime: number;
  row: Rows['posts'];
  categories: readonly Rows['categories'][];
  date: string;
  imageId: string | null;
}
export interface HomeExperience {
  row: Rows['experiences'];
  period: string | null;
  technologies: readonly Rows['technologies'][];
  projects: readonly HomeProject[];
}

export function createPublicModel(snapshot: PublicSnapshot, assets: AssetMap, siteUrl: string) {
  const settings = snapshot.settings;
  if (!settings?.site_name.trim() || !settings.brand_short.trim() || !settings.hero_title?.trim())
    throw new Error('Public Home requires site identity and a Hero title.');
  const { withBase, absoluteUrl } = createUrlHelpers(siteUrl);
  const now = Date.parse(snapshot.generated_at);
  const isPast = (date: string | null) => !date || Date.parse(date) <= now;
  const technologies = visible(snapshot.technologies);
  const technologyIds = new Map(technologies.map((row) => [row.id, row]));
  const imageId = (id: string | null) => {
    if (!id) return null;
    const media = snapshot.media_assets.find((row) => row.id === id && row.visibility === 'public');
    const asset = assets.assets[id];
    if (!media || !asset?.variants.length)
      throw new Error('Required public Home image is unavailable.');
    return id;
  };
  const joinedTechnologies = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const row = technologyIds.get(id);
      return row ? [row] : [];
    });
  const projects: HomeProject[] = snapshot.projects
    .filter((row) => row.published && row.status !== 'archived' && isPast(row.published_at))
    .sort(byOrder)
    .map((row) => {
      const demo = safeExternalUrl(row.demo_url),
        github = safeExternalUrl(row.github_url),
        documentation = safeExternalUrl(row.documentation_url);
      return {
        href: withBase(`/proyectos/${row.slug}/`),
        row,
        technologies: joinedTechnologies(
          snapshot.project_technologies
            .filter((join) => join.project_id === row.id)
            .sort(byOrder)
            .map((join) => join.technology_id),
        ),
        impact:
          snapshot.project_metrics
            .filter((metric) => metric.project_id === row.id && metric.visible)
            .sort(byOrder)[0] ?? null,
        imageId: imageId(row.featured_image_asset_id ?? row.cover_image_asset_id),
        action: demo
          ? { href: demo, label: 'Ver proyecto' }
          : github
            ? { href: github, label: 'Ver código' }
            : documentation
              ? { href: documentation, label: 'Documentación' }
              : null,
      };
    });
  const categories = visible(snapshot.categories);
  const posts: HomePost[] = snapshot.posts
    .filter((row) => row.status === 'published' && row.published_at && isPast(row.published_at))
    .sort(
      (a, b) =>
        Date.parse(b.published_at!) - Date.parse(a.published_at!) || a.id.localeCompare(b.id),
    )
    .map((row) => ({
      href: withBase(`/blog/${row.slug}/`),
      readingTime: row.reading_time ?? readingTime(row.content_markdown),
      row,
      categories: categories.filter((category) =>
        snapshot.post_category_relations.some(
          (join) => join.post_id === row.id && join.category_id === category.id,
        ),
      ),
      date: formatEditorialDate(row.published_at!, settings.timezone),
      imageId: imageId(row.featured_image_asset_id),
    }));
  const experiences: HomeExperience[] = visible(snapshot.experiences).map((row) => ({
    row,
    period: formatPeriod(row.start_date, row.end_date, row.current),
    technologies: joinedTechnologies(
      snapshot.experience_technologies
        .filter((join) => join.experience_id === row.id)
        .map((join) => join.technology_id),
    ),
    projects: projects.filter((project) =>
      snapshot.experience_projects.some(
        (join) => join.experience_id === row.id && join.project_id === project.row.id,
      ),
    ),
  }));
  const stack = [...new Set(technologies.map((row) => row.category))].map((category) => ({
    category,
    technologies: technologies.filter((row) => row.category === category),
  }));
  // Legacy remote URLs never bypass the F8 asset map.
  const activeCv = snapshot.contact?.cv_enabled
    ? snapshot.documents.find(
        (document) =>
          document.type === 'cv' &&
          document.active &&
          snapshot.media_assets.some(
            (media) =>
              media.id === document.asset_id &&
              media.visibility === 'public' &&
              media.mime_type === 'application/pdf',
          ),
      )
    : undefined;
  const cvAsset = activeCv ? assets.assets[activeCv.asset_id] : undefined;
  if (activeCv && (!cvAsset || cvAsset.variants.length || !cvAsset.src.endsWith('.pdf')))
    throw new Error('Active CV is missing from the public artifact.');
  const socialLinks = visible(snapshot.social_links).flatMap((row) => {
    const href = safeExternalUrl(row.url);
    return href ? [{ ...row, href }] : [];
  });
  const contact = snapshot.contact;
  const canonicalBase = safeExternalUrl(settings.canonical_base) ?? siteUrl;
  const canonical = createUrlHelpers(canonicalBase).absoluteUrl('/');
  const ogImageId = imageId(settings.default_og_image_asset_id);
  return {
    snapshot,
    siteUrl,
    settings,
    assets,
    links: {
      home: withBase('/'),
      projects: withBase('/proyectos/'),
      blog: withBase('/blog/'),
      about: withBase('/sobre-mi/'),
      contact: withBase('/contacto/'),
    },
    projects,
    posts,
    experiences,
    stack,
    socialLinks,
    specialties: visible(snapshot.specialties),
    principles: visible(snapshot.principles),
    metrics: visible(snapshot.impact_metrics),
    about: {
      summary: excerptText(settings.about_summary_markdown),
      method: excerptText(settings.working_method_markdown),
      imageId: imageId(settings.about_image_asset_id),
    },
    contact: {
      title: contact?.cta_title?.trim() || null,
      description: contact?.cta_description?.trim() || null,
      email: contact?.email_visible ? emailActions(contact.email) : null,
      whatsapp: contact?.whatsapp_visible
        ? whatsappUrl(contact.whatsapp_number, contact.whatsapp_default_message)
        : null,
      whatsappLabel: contact?.whatsapp_cta_label?.trim() || 'Escríbeme por WhatsApp',
      cv: activeCv && cvAsset ? { href: cvAsset.src, title: activeCv.title } : null,
    },
    seo: {
      title:
        settings.default_seo_title?.trim() ||
        [settings.site_name, settings.professional_title].filter(Boolean).join(' — '),
      description:
        settings.default_seo_description?.trim() ||
        settings.hero_description?.trim() ||
        [settings.hero_title, settings.hero_subtitle].filter(Boolean).join(' '),
      canonical,
      robots: settings.robots_policy,
      image: ogImageId ? absoluteUrl(assets.assets[ogImageId]!.src) : null,
    },
  };
}
export function createHomeModel(snapshot: PublicSnapshot, assets: AssetMap, siteUrl: string) {
  return homeFromPublic(createPublicModel(snapshot, assets, siteUrl));
}
export function homeFromPublic(content: PublicModel) {
  return {
    ...content,
    projects: content.projects.filter((project) => project.row.featured).slice(0, 6),
    posts: content.posts.slice(0, 3),
    experiences: content.experiences.slice(0, 4),
  };
}
export type PublicModel = ReturnType<typeof createPublicModel>;
export type HomeModel = ReturnType<typeof createHomeModel>;
