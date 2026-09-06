import { createUrlHelpers } from '../utils/urls.ts';
export const adminSections = [
  {
    label: 'Overview',
    items: [
      ['', 'Dashboard'],
      ['analytics', 'Analytics'],
    ],
  },
  {
    label: 'Contenido',
    items: [
      ['projects', 'Proyectos'],
      ['posts', 'Blog'],
      ['experience', 'Experiencia'],
      ['technologies', 'Tecnologías'],
      ['specialties', 'Especialidades'],
      ['principles', 'Principios'],
      ['impact', 'Impacto'],
    ],
  },
  {
    label: 'Recursos',
    items: [
      ['media', 'Multimedia'],
      ['documents', 'Documentos / CV'],
    ],
  },
  {
    label: 'Comunicación',
    items: [
      ['contact', 'Contacto'],
      ['social', 'Redes sociales'],
      ['messages', 'Mensajes'],
    ],
  },
  {
    label: 'Sistema',
    items: [
      ['seo', 'SEO'],
      ['settings', 'Configuración'],
      ['builds', 'Publicación'],
    ],
  },
] as const;
export const adminRoutes = [
  ...adminSections.flatMap((s) => s.items.map(([path]) => path)),
  'login',
  'reset-password',
  'projects/new',
  'projects/edit',
  'posts/new',
  'posts/edit',
  'categories',
  'tags',
] as const;
export type AdminRoute = (typeof adminRoutes)[number];
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readEditorId(search: string): string | null {
  const params = new URLSearchParams(search);
  const id = params.get('id');
  if (params.getAll('id').length !== 1 || !id || !uuidPattern.test(id)) return null;
  return id.toLowerCase();
}
/** Return only physical admin pages, retaining a single valid editorial UUID. */
export function safeAdminReturn(value: string | null, siteUrl: string): string {
  const { withBase } = createUrlHelpers(siteUrl);
  const fallback = withBase('/admin/');
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n%]/.test(value))
    return fallback;
  const url = new URL(value, new URL(siteUrl).origin);
  const route = adminRoutes.find((r) => withBase('/admin/' + r) === url.pathname);
  if (route === undefined || route === 'login' || route === 'reset-password') return fallback;
  return (
    url.pathname +
    (route.endsWith('/edit') && readEditorId(url.search) ? '?id=' + readEditorId(url.search) : '')
  );
}
