import type { PublicSnapshot, PublicSnapshotRows } from '../../src/types/content.ts';
import type { AssetMap } from '../../src/lib/media/build-assets.ts';
import { snapshotRowRules } from '../../src/lib/content/snapshot-contract.ts';
import { parsePublicSnapshot } from '../../src/lib/content/parse-snapshot.ts';

export const fixtureId = (number: number) =>
  '10000000-0000-4000-8000-' + String(number).padStart(12, '0');
export const ids = {
  project: fixtureId(10),
  post: fixtureId(20),
  experience: fixtureId(30),
  image: fixtureId(70),
  secondImage: fixtureId(71),
  pdf: fixtureId(72),
  technology: fixtureId(40),
  category: fixtureId(60),
};
export function row<K extends keyof PublicSnapshotRows>(
  table: K,
  values: Partial<PublicSnapshotRows[K]>,
): PublicSnapshotRows[K] {
  const defaults = Object.fromEntries(
    Object.entries(snapshotRowRules[table]).map(([key, rule]) => [
      key,
      rule.endsWith('?')
        ? null
        : rule === 'uuid'
          ? fixtureId(1)
          : rule === 'boolean'
            ? false
            : rule === 'integer'
              ? 0
              : rule === 'date'
                ? '2024-01-01'
                : '',
    ]),
  );
  // Values are checked against the full runtime DTO before leaving this fixture factory.
  return { ...defaults, ...values } as PublicSnapshotRows[K];
}

export function emptyHomeSnapshot(): PublicSnapshot {
  return parsePublicSnapshot({
    schema_version: 1,
    generated_at: '2026-09-06T12:00:00Z',
    settings: row('settings', {
      site_name: 'Alonso Larenas',
      brand_short: 'AL',
      professional_title: 'Automatización · Desarrollo · Transformación Digital',
      hero_title: 'Tecnología aplicada a problemas reales.',
      hero_subtitle: 'Automatización · Desarrollo · IA · Datos',
      about_summary_markdown: 'Construyo soluciones digitales para simplificar procesos complejos.',
      timezone: 'America/Santiago',
      robots_policy: 'index,follow',
    }),
    contact: row('contact', {}),
    social_links: [],
    projects: [],
    project_features: [],
    project_images: [],
    project_metrics: [],
    project_challenges: [],
    project_technologies: [],
    posts: [],
    categories: [],
    post_category_relations: [],
    tags: [],
    post_tags: [],
    experiences: [],
    experience_highlights: [],
    experience_projects: [],
    experience_technologies: [],
    technologies: [],
    specialties: [],
    principles: [],
    impact_metrics: [],
    media_assets: [],
    media_references: [],
    documents: [],
  });
}

/** Synthetic editorial data. This module is never imported by a production entrypoint. */
export function fullHomeSnapshot(storageOrigin = 'http://127.0.0.1:58431'): PublicSnapshot {
  const empty = emptyHomeSnapshot();
  const image = (id: string, bucket: string, path: string) =>
    row('media_assets', {
      id,
      filename: 'fixture.png',
      public_url: storageOrigin + '/storage/v1/object/public/' + bucket + '/' + path,
      mime_type: 'image/png',
      file_size: 100,
      width: 960,
      height: 600,
      alt_text: 'Diagrama de aplicación sintética para pruebas',
      category: 'general',
      visibility: 'public',
    });
  return parsePublicSnapshot({
    ...empty,
    settings: {
      ...empty.settings,
      hero_description:
        'Diseño sistemas que conectan procesos, convierten datos en decisiones y dan espacio a lo que importa.',
      availability_enabled: true,
      availability_text: 'Disponible para conversar',
      location_public: 'Chile',
      working_method_markdown: 'Primero entender. Después construir. Siempre mejorar.',
      default_seo_title: 'AL — Home de prueba',
      default_seo_description: 'Vista de prueba del portfolio, sin contenido profesional real.',
    },
    contact: row('contact', {
      email: 'contacto@example.test',
      email_visible: true,
      whatsapp_number: '+1 202 555 0142',
      whatsapp_visible: true,
      whatsapp_default_message: 'Hola, conversemos sobre una idea.',
      cta_title: '¿Construimos algo?',
      cta_description: 'Conversemos sobre automatización, desarrollo o transformación digital.',
      cv_enabled: true,
    }),
    social_links: [
      row('social_links', {
        id: fixtureId(80),
        platform: 'github',
        label: 'GitHub',
        url: 'https://example.com/github',
        visible: true,
      }),
      row('social_links', {
        id: fixtureId(81),
        platform: 'linkedin',
        label: 'LinkedIn',
        url: 'https://example.com/linkedin',
        visible: true,
        sort_order: 1,
      }),
    ],
    projects: [
      row('projects', {
        id: ids.project,
        title: 'Procesos que se conectan.',
        slug: 'fixture-automatizacion',
        summary:
          'Ejemplo de prueba: un flujo que conecta solicitudes, validaciones y decisiones en un solo lugar.',
        year: 2026,
        status: 'production',
        featured: true,
        published: true,
        published_at: '2026-08-01T12:00:00Z',
        featured_image_asset_id: ids.image,
        demo_url: 'https://example.com/demo',
      }),
      row('projects', {
        id: fixtureId(11),
        title: 'Una vista. Todos los datos.',
        slug: 'fixture-datos',
        summary:
          'Ejemplo de prueba: información dispersa convertida en una herramienta clara para el equipo.',
        year: 2025,
        status: 'completed',
        featured: true,
        published: true,
        published_at: '2025-12-01T12:00:00Z',
        featured_image_asset_id: ids.secondImage,
        github_url: 'https://example.com/code',
        sort_order: 1,
      }),
      row('projects', {
        id: fixtureId(12),
        title: 'Menos pasos, mejores decisiones.',
        slug: 'fixture-inteligencia',
        summary: 'Ejemplo de prueba: una interfaz para hacer más simple el trabajo cotidiano.',
        year: 2026,
        status: 'development',
        featured: true,
        published: true,
        published_at: '2026-07-01T12:00:00Z',
        sort_order: 2,
      }),
    ],
    project_technologies: [
      row('project_technologies', { project_id: ids.project, technology_id: ids.technology }),
      row('project_technologies', {
        project_id: ids.project,
        technology_id: fixtureId(41),
        sort_order: 1,
      }),
      row('project_technologies', { project_id: fixtureId(11), technology_id: fixtureId(42) }),
    ],
    project_metrics: [
      row('project_metrics', {
        id: fixtureId(50),
        project_id: ids.project,
        value: 'Un flujo',
        label: 'de principio a fin',
        visible: true,
      }),
    ],
    technologies: [
      row('technologies', {
        id: ids.technology,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'Desarrollo',
        visible: true,
      }),
      row('technologies', {
        id: fixtureId(41),
        name: 'Astro',
        slug: 'astro',
        category: 'Desarrollo',
        visible: true,
        sort_order: 1,
      }),
      row('technologies', {
        id: fixtureId(42),
        name: 'PostgreSQL',
        slug: 'postgresql',
        category: 'Datos',
        visible: true,
        sort_order: 2,
      }),
      row('technologies', {
        id: fixtureId(43),
        name: 'Python',
        slug: 'python',
        category: 'Automatización',
        visible: true,
        sort_order: 3,
      }),
      row('technologies', {
        id: fixtureId(44),
        name: 'Git',
        slug: 'git',
        category: 'Herramientas',
        visible: true,
        sort_order: 4,
      }),
    ],
    specialties: [
      'Automatización',
      'Desarrollo web',
      'Inteligencia Artificial aplicada',
      'Datos',
      'Digitalización',
      'Optimización de procesos',
    ].map((title, i) =>
      row('specialties', {
        id: fixtureId(100 + i),
        title,
        slug: 'fixture-especialidad-' + i,
        sort_order: i,
        visible: true,
      }),
    ),
    principles: [
      'Resolver primero el problema.',
      'Automatizar lo repetitivo.',
      'Diseñar para quien lo utiliza.',
      'Medir el resultado.',
    ].map((title, i) =>
      row('principles', {
        id: fixtureId(110 + i),
        title,
        number: i + 1,
        sort_order: i,
        visible: true,
      }),
    ),
    experiences: [
      row('experiences', {
        id: ids.experience,
        position: 'Desarrollo y automatización',
        organization: 'Organización de prueba',
        start_date: '2024-01-01',
        current: true,
        summary:
          'Experiencia sintética: conectar herramientas y simplificar el trabajo de los equipos.',
        visible: true,
      }),
      row('experiences', {
        id: fixtureId(31),
        position: 'Sistemas y análisis de datos',
        organization: 'Equipo de demostración',
        start_date: '2021-03-01',
        end_date: '2023-12-01',
        summary: 'Experiencia sintética para revisar la composición y los períodos del timeline.',
        visible: true,
        sort_order: 1,
      }),
    ],
    experience_technologies: [
      row('experience_technologies', {
        experience_id: ids.experience,
        technology_id: ids.technology,
      }),
    ],
    experience_projects: [
      row('experience_projects', { experience_id: ids.experience, project_id: ids.project }),
    ],
    impact_metrics: [
      row('impact_metrics', {
        id: fixtureId(120),
        value: '24/7',
        label: 'Métrica de prueba',
        description: 'Valor ilustrativo, exclusivo de este fixture.',
        visible: true,
      }),
      row('impact_metrics', {
        id: fixtureId(121),
        value: '−70%',
        label: 'Ejemplo de resultado',
        description: 'No representa un logro real.',
        visible: true,
        sort_order: 1,
      }),
    ],
    categories: [
      row('categories', {
        id: ids.category,
        name: 'Build Notes',
        slug: 'build-notes',
        visible: true,
      }),
    ],
    posts: [
      row('posts', {
        id: ids.post,
        title: 'Lo que un proceso nos dice antes de automatizarlo.',
        slug: 'fixture-procesos',
        excerpt: 'Artículo de prueba sobre observar el trabajo antes de elegir una herramienta.',
        status: 'published',
        published_at: '2026-09-01T12:00:00Z',
        reading_time: 5,
        featured_image_asset_id: ids.image,
      }),
      row('posts', {
        id: fixtureId(21),
        title: 'Diseñar herramientas que se entienden.',
        slug: 'fixture-herramientas',
        excerpt: 'Artículo sintético para comprobar una segunda tarjeta sin imagen.',
        status: 'published',
        published_at: '2026-08-15T12:00:00Z',
        reading_time: 4,
      }),
      row('posts', {
        id: fixtureId(22),
        title: 'Del dato a la próxima decisión.',
        slug: 'fixture-decisiones',
        status: 'published',
        published_at: '2026-08-05T12:00:00Z',
        reading_time: 3,
      }),
    ],
    post_category_relations: [
      row('post_category_relations', { post_id: ids.post, category_id: ids.category }),
    ],
    media_assets: [
      image(ids.image, 'portfolio-public', 'general/' + ids.image + '.png'),
      image(ids.secondImage, 'portfolio-public', 'general/' + ids.secondImage + '.png'),
      row('media_assets', {
        id: ids.pdf,
        public_url: storageOrigin + '/storage/v1/object/public/documents/cv/' + ids.pdf + '.pdf',
        filename: 'fixture.pdf',
        mime_type: 'application/pdf',
        file_size: 100,
        category: 'document',
        visibility: 'public',
      }),
    ],
    media_references: [
      row('media_references', {
        asset_id: ids.image,
        entity_type: 'project',
        entity_id: ids.project,
        field: 'featured_image_asset_id',
      }),
      row('media_references', {
        asset_id: ids.secondImage,
        entity_type: 'project',
        entity_id: fixtureId(11),
        field: 'featured_image_asset_id',
      }),
    ],
    documents: [
      row('documents', {
        id: fixtureId(130),
        type: 'cv',
        title: 'Documento de prueba',
        asset_id: ids.pdf,
        active: true,
      }),
    ],
  });
}

export function fixtureAssetMap(): AssetMap {
  return {
    version: 1,
    assets: Object.fromEntries(
      [ids.image, ids.secondImage, ids.pdf].map((id, i) => [
        id,
        {
          src:
            '/portfolio-alonso/assets/media/' +
            String(i + 1).repeat(64) +
            (id === ids.pdf ? '.pdf' : '.png'),
          width: id === ids.pdf ? null : 960,
          height: id === ids.pdf ? null : 600,
          alt: id === ids.pdf ? '' : 'Diagrama de prueba',
          variants:
            id === ids.pdf
              ? []
              : [
                  {
                    src: '/portfolio-alonso/assets/media/' + String(i + 1).repeat(64) + '.webp',
                    width: 960,
                    height: 600,
                    format: 'webp',
                  },
                ],
        },
      ]),
    ),
  };
}
