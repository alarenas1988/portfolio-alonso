import type { TablesUpdate } from '../../types/database.ts';
export type ResourceName =
  | 'projects'
  | 'posts'
  | 'experiences'
  | 'technologies'
  | 'specialties'
  | 'work_principles'
  | 'impact_metrics'
  | 'post_categories'
  | 'tags'
  | 'social_links'
  | 'site_settings'
  | 'contact_settings'
  | 'documents';
export interface Field {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'markdown'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'checkbox'
    | 'select'
    | 'url'
    | 'email'
    | 'media';
  required?: boolean;
  options?: readonly string[];
  group?: string;
  min?: number;
  max?: number;
  help?: string;
}
function define<T extends ResourceName>(
  table: T,
  label: string,
  singular: string,
  fields: (Field & { key: Extract<keyof TablesUpdate<T>, string> })[],
  singleton = false,
) {
  return { table, label, singular, fields, singleton };
}
const title = { key: 'title', label: 'Título', required: true, max: 200 } as const;
const name = { key: 'name', label: 'Nombre', required: true, max: 120 } as const;
const slug = {
  key: 'slug',
  label: 'Slug',
  required: true,
  max: 120,
  help: 'Minúsculas, números y guiones. Cambiar un slug publicado cambia su enlace.',
} as const;
const visible = { key: 'visible', label: 'Visible en contenido', type: 'checkbox' } as const;
const order = { key: 'sort_order', label: 'Orden editorial', type: 'number', min: 0 } as const;
const description = { key: 'description', label: 'Descripción', type: 'textarea' } as const;
const icon = {
  key: 'icon',
  label: 'Icono versionado',
  help: 'Nombre del icono del sistema; no HTML ni SVG arbitrario.',
} as const;
const featured = { key: 'featured', label: 'Destacado', type: 'checkbox' } as const;
const seo = [
  { key: 'seo_title', label: 'Título SEO', group: 'SEO' },
  { key: 'seo_description', label: 'Descripción SEO', type: 'textarea', group: 'SEO' },
  { key: 'canonical_url', label: 'Canonical', type: 'url', group: 'SEO' },
  {
    key: 'robots_policy',
    label: 'Robots',
    type: 'select',
    options: ['index,follow', 'noindex,follow', 'noindex,nofollow', 'index,nofollow'],
    group: 'SEO',
  },
  { key: 'og_image_asset_id', label: 'Imagen Open Graph', type: 'media', group: 'SEO' },
] as const;
export const resources = {
  projects: define('projects', 'Proyectos', 'proyecto', [
    title,
    slug,
    { key: 'subtitle', label: 'Subtítulo' },
    { key: 'summary', label: 'Resumen ejecutivo', type: 'textarea' },
    { key: 'role', label: 'Rol en el proyecto' },
    { key: 'year', label: 'Año', type: 'number', min: 1900, max: 2200 },
    {
      key: 'status',
      label: 'Estado del proyecto',
      type: 'select',
      required: true,
      options: ['concept', 'development', 'production', 'completed', 'archived'],
    },
    featured,
    {
      key: 'published',
      label: 'Publicado en datos',
      type: 'checkbox',
      help: 'La web estática se actualiza con un build. Guardar contenido público puede ser recogido por el siguiente build.',
    },
    { key: 'published_at', label: 'Fecha de publicación', type: 'datetime-local' },
    order,
    { key: 'featured_image_asset_id', label: 'Imagen principal', type: 'media' },
    { key: 'cover_image_asset_id', label: 'Portada', type: 'media' },
    { key: 'github_url', label: 'Repositorio GitHub', type: 'url' },
    { key: 'demo_url', label: 'Demo', type: 'url' },
    { key: 'documentation_url', label: 'Documentación', type: 'url' },
    ...(
      [
        'problem',
        'objective',
        'solution',
        'architecture',
        'challenges',
        'learnings',
        'before_markdown',
        'after_markdown',
      ] as const
    ).map((key, i) => ({
      key,
      label: [
        'Problema',
        'Objetivo',
        'Solución',
        'Arquitectura / flujo',
        'Desafíos generales',
        'Aprendizajes',
        'Antes',
        'Después',
      ][i]!,
      type: 'markdown' as const,
      group: 'Contenido',
    })),
    ...seo,
  ]),
  posts: define('posts', 'Blog', 'artículo', [
    title,
    slug,
    { key: 'excerpt', label: 'Extracto', type: 'textarea' },
    {
      key: 'status',
      label: 'Estado editorial',
      type: 'select',
      required: true,
      options: ['draft', 'published', 'archived'],
    },
    featured,
    { key: 'published_at', label: 'Fecha de publicación', type: 'datetime-local' },
    {
      key: 'reading_time',
      label: 'Minutos de lectura',
      type: 'number',
      min: 1,
      help: 'Vacío: se calcula desde el contenido.',
    },
    { key: 'featured_image_asset_id', label: 'Imagen principal', type: 'media' },
    {
      key: 'content_markdown',
      label: 'Artículo en Markdown',
      type: 'markdown',
      group: 'Contenido',
    },
    ...seo,
  ]),
  experiences: define('experiences', 'Experiencia', 'experiencia', [
    { key: 'position', label: 'Cargo', required: true, max: 200 },
    { key: 'organization', label: 'Organización', required: true, max: 200 },
    { key: 'organization_url', label: 'Sitio de la organización', type: 'url' },
    { key: 'start_date', label: 'Fecha de inicio', type: 'date', required: true },
    { key: 'end_date', label: 'Fecha de término', type: 'date' },
    { key: 'current', label: 'Cargo actual', type: 'checkbox' },
    { key: 'summary', label: 'Resumen', type: 'textarea' },
    { key: 'description_markdown', label: 'Descripción completa', type: 'markdown' },
    visible,
    order,
  ]),
  technologies: define('technologies', 'Tecnologías', 'tecnología', [
    name,
    slug,
    { key: 'category', label: 'Categoría', required: true, max: 80 },
    description,
    icon,
    { key: 'icon_asset_id', label: 'Icono multimedia', type: 'media' },
    { key: 'official_url', label: 'URL oficial', type: 'url' },
    featured,
    visible,
    order,
  ]),
  specialties: define('specialties', 'Especialidades', 'especialidad', [
    title,
    slug,
    description,
    icon,
    visible,
    order,
  ]),
  work_principles: define('work_principles', 'Principios', 'principio', [
    { key: 'number', label: 'Número', type: 'number', required: true, min: 1 },
    title,
    description,
    visible,
    order,
  ]),
  impact_metrics: define('impact_metrics', 'Impacto', 'métrica', [
    {
      key: 'value',
      label: 'Valor',
      required: true,
      max: 50,
      help: 'Valor textual real, por ejemplo 24/7.',
    },
    { key: 'label', label: 'Etiqueta', required: true, max: 120 },
    description,
    visible,
    order,
  ]),
  post_categories: define('post_categories', 'Categorías', 'categoría', [
    name,
    slug,
    description,
    visible,
    order,
  ]),
  tags: define('tags', 'Tags', 'tag', [name, slug]),
  social_links: define('social_links', 'Redes sociales', 'red social', [
    { key: 'platform', label: 'Plataforma', required: true, max: 50 },
    { key: 'label', label: 'Etiqueta', required: true, max: 120 },
    { key: 'url', label: 'URL HTTPS', type: 'url', required: true },
    icon,
    visible,
    order,
  ]),
  site_settings: define(
    'site_settings',
    'Configuración',
    'configuración',
    [
      { key: 'site_name', label: 'Nombre del sitio', required: true, max: 200 },
      { key: 'brand_short', label: 'Marca breve', required: true, max: 20 },
      { key: 'professional_title', label: 'Dirección profesional' },
      { key: 'hero_title', label: 'Título Hero' },
      { key: 'hero_subtitle', label: 'Subtítulo Hero' },
      { key: 'hero_description', label: 'Descripción Hero', type: 'textarea' },
      { key: 'availability_enabled', label: 'Mostrar disponibilidad', type: 'checkbox' },
      { key: 'availability_text', label: 'Texto de disponibilidad' },
      { key: 'location_public', label: 'Ubicación pública' },
      {
        key: 'timezone',
        label: 'Zona horaria IANA',
        required: true,
        help: 'America/Santiago respeta los cambios de horario.',
      },
      { key: 'about_summary_markdown', label: 'Sobre mí · resumen', type: 'markdown' },
      { key: 'about_profile_markdown', label: 'Perfil completo', type: 'markdown' },
      { key: 'working_method_markdown', label: 'Cómo trabajo', type: 'markdown' },
      { key: 'about_image_asset_id', label: 'Imagen de perfil', type: 'media' },
      { key: 'default_seo_title', label: 'Título SEO global', group: 'SEO' },
      {
        key: 'default_seo_description',
        label: 'Descripción SEO global',
        type: 'textarea',
        group: 'SEO',
      },
      {
        key: 'canonical_base',
        label: 'Base canonical',
        type: 'url',
        group: 'SEO',
        help: 'Debe coincidir con la URL del sitio y su subruta.',
      },
      {
        key: 'default_og_image_asset_id',
        label: 'Open Graph predeterminado',
        type: 'media',
        group: 'SEO',
      },
      {
        key: 'robots_policy',
        label: 'Robots público',
        type: 'select',
        options: ['index,follow', 'noindex,follow', 'noindex,nofollow', 'index,nofollow'],
        group: 'SEO',
      },
    ],
    true,
  ),
  contact_settings: define(
    'contact_settings',
    'Contacto',
    'contacto',
    [
      { key: 'email', label: 'Email público', type: 'email' },
      { key: 'email_visible', label: 'Mostrar email', type: 'checkbox' },
      {
        key: 'whatsapp_number',
        label: 'WhatsApp internacional',
        help: 'Formato +56912345678; no se muestra si el canal está oculto.',
      },
      { key: 'whatsapp_visible', label: 'Mostrar WhatsApp', type: 'checkbox' },
      { key: 'whatsapp_default_message', label: 'Mensaje WhatsApp', type: 'textarea' },
      { key: 'whatsapp_cta_label', label: 'Etiqueta WhatsApp' },
      { key: 'cta_title', label: 'Título de contacto' },
      { key: 'cta_description', label: 'Descripción de contacto', type: 'textarea' },
      { key: 'form_enabled', label: 'Formulario habilitado', type: 'checkbox' },
      { key: 'cv_enabled', label: 'Mostrar CV activo', type: 'checkbox' },
    ],
    true,
  ),
  documents: define('documents', 'Documentos / CV', 'documento', [
    title,
    { key: 'type', label: 'Tipo', type: 'select', options: ['cv', 'document'], required: true },
    { key: 'asset_id', label: 'PDF', type: 'media', required: true },
  ]),
} satisfies Record<
  ResourceName,
  { table: ResourceName; label: string; singular: string; fields: Field[]; singleton: boolean }
>;
export type ResourceSpec = {
  table: ResourceName;
  label: string;
  singular: string;
  fields: readonly Field[];
  singleton: boolean;
};
export const routeResources: Record<string, ResourceName> = {
  projects: 'projects',
  posts: 'posts',
  experience: 'experiences',
  technologies: 'technologies',
  specialties: 'specialties',
  principles: 'work_principles',
  impact: 'impact_metrics',
  categories: 'post_categories',
  tags: 'tags',
  social: 'social_links',
  settings: 'site_settings',
  seo: 'site_settings',
  contact: 'contact_settings',
  documents: 'documents',
};
export function resourceRoute(table: ResourceName) {
  return Object.keys(routeResources).find((key) => routeResources[key] === table)!;
}
