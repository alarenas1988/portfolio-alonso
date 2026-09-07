import type { AdminClient } from '../../lib/admin/repository.ts';
import { loadBuilds, buildLabels } from '../../lib/admin/builds.ts';
import { publicationController } from './publication.ts';
import { loadAnalyticsReport, analyticsRange } from '../../lib/analytics/queries.ts';
import { el, button, link, feedback } from '../../lib/admin/dom.ts';
import { getPublicConfig } from '../../lib/config/public.ts';
import { createUrlHelpers } from '../../lib/utils/urls.ts';
import { moduleFailure } from './modules.ts';
export function stat(label: string, value: number, note = '') {
  const item = el('div', '', 'cms-stat');
  item.append(el('span', label), el('strong', new Intl.NumberFormat('es-CL').format(value)));
  if (note) item.append(el('span', note));
  return item;
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(new Date(value));
}
export async function mountOverview(root: HTMLElement, client: AdminClient, onlyBuilds = false) {
  const { withBase } = createUrlHelpers(getPublicConfig().siteUrl);
  try {
    const builds = await loadBuilds(client),
      status = el(
        'p',
        'Supabase conectado. Guardar contenido y actualizar el sitio público son operaciones diferentes.',
        'cms-notice',
      );
    const toolbar = el('div', '', 'cms-toolbar');
    toolbar.append(
      link('+ Nuevo proyecto', withBase('/admin/projects/new/'), 'cms-button cms-primary'),
      link('+ Nuevo artículo', withBase('/admin/posts/new/'), 'cms-button'),
      link('Subir archivo', withBase('/admin/media/'), 'cms-button'),
    );
    root.replaceChildren(toolbar, status);
    status.setAttribute('role', 'status');
    if (!onlyBuilds) {
      const [projects, posts, messages] = await Promise.all([
        client.from('projects').select('id', { count: 'exact', head: true }),
        client.from('posts').select('id', { count: 'exact', head: true }),
        client
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new'),
      ]);
      if (projects.error || posts.error || messages.error) throw new Error('Dashboard unavailable');
      const stats = el('section', '', 'cms-stats');
      stats.setAttribute('aria-label', 'Resumen del contenido');
      stats.append(
        stat('Proyectos', projects.count ?? 0),
        stat('Artículos', posts.count ?? 0),
        stat('Mensajes nuevos', messages.count ?? 0),
        stat('Builds recientes', builds.length, 'Hasta 20 registros'),
      );
      root.append(stats);
      const columns = el('div', '', 'cms-columns'),
        content = el('section', '', 'cms-panel'),
        analytics = el('section', '', 'cms-panel');
      content.append(el('h2', 'Contenido editorial'));
      const [published, drafts, publicPosts, draftPosts] = await Promise.all([
        client
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('published', true)
          .neq('status', 'archived'),
        client.from('projects').select('id', { count: 'exact', head: true }).eq('published', false),
        client.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        client.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
      ]);
      if ([published, drafts, publicPosts, draftPosts].some((r) => r.error))
        throw new Error('Counts unavailable');
      for (const [label, count] of [
        ['Proyectos públicos', published.count],
        ['Proyectos en borrador', drafts.count],
        ['Artículos publicados', publicPosts.count],
        ['Artículos en borrador', draftPosts.count],
      ]) {
        const line = el('div', '', 'cms-list-row');
        line.append(el('span', String(label)), el('strong', String(count ?? 0)));
        content.append(line);
      }
      analytics.append(
        el('h2', 'Últimos 30 días'),
        el('p', 'Sesiones aproximadas · America/Santiago', 'cms-help'),
      );
      try {
        const range = analyticsRange(30),
          report = await loadAnalyticsReport(client, range.from, range.to);
        for (const [label, value] of [
          ['Vistas de página', report.summary.page_views],
          ['Sesiones aproximadas', report.summary.unique_sessions],
          ['Contactos', report.summary.contact_submits],
        ]) {
          const line = el('div', '', 'cms-list-row');
          line.append(el('span', String(label)), el('strong', String(value)));
          analytics.append(line);
        }
      } catch {
        analytics.append(el('p', 'Analytics no está disponible temporalmente.', 'cms-notice'));
      }
      analytics.append(
        link('Explorar Analytics →', withBase('/admin/analytics/'), 'cms-text-link'),
      );
      columns.append(content, analytics);
      root.append(columns);
    }
    const panel = el('section', '', 'cms-panel');
    panel.append(
      el('h2', 'Publicación del sitio'),
      el('p', 'Guardar en Supabase y desplegar el sitio son operaciones diferentes.', 'cms-muted'),
    );
    const history = el('div');
    async function refreshHistory() {
      try {
        renderHistory(await loadBuilds(client));
      } catch {
        feedback(status, 'No se pudo actualizar el historial. Reintenta la consulta.', 'error');
      }
    }
    const publication = publicationController(client, status, () => {
      void refreshHistory();
    });
    const rebuild = button('Solicitar publicación', () => {
      void (async () => {
        rebuild.disabled = true;
        await publication.submit();
        rebuild.disabled = false;
      })();
    });
    const publicationActions = el('div', '', 'cms-toolbar');
    publicationActions.append(
      rebuild,
      button('Actualizar estado', () => {
        void refreshHistory();
      }),
    );
    panel.append(publicationActions, history);
    function renderHistory(items: typeof builds) {
      history.replaceChildren();
      if (!items.length)
        history.append(el('div', 'Todavía no hay builds registrados.', 'cms-empty'));
      for (const build of items) {
        const item = el('article', '', 'cms-list-row'),
          info = el('div');
        info.append(
          el('h3', buildLabels[build.status as keyof typeof buildLabels] ?? build.status),
          el(
            'p',
            dateLabel(build.created_at) +
              (build.commit_sha ? ' · ' + build.commit_sha.slice(0, 8) : ''),
          ),
        );
        if (build.started_at && build.completed_at)
          info.append(
            el(
              'p',
              Math.round((Date.parse(build.completed_at) - Date.parse(build.started_at)) / 1000) +
                ' segundos',
            ),
          );
        if (build.failure_reason) info.append(el('p', build.failure_reason));
        item.append(info);
        const historyActions = el('div', '', 'cms-toolbar');
        if (build.status === 'failed')
          historyActions.append(
            button('Reintentar publicación', () => {
              void publication.submit(build.id);
            }),
          );
        if (build.status === 'success')
          historyActions.append(link('Ver sitio', getPublicConfig().siteUrl, 'cms-text-link'));
        if (
          build.github_run_url &&
          /^https:\/\/github\.com\/alarenas1988\/portfolio-alonso\/actions\/runs\/\d+$/.test(
            build.github_run_url,
          )
        )
          historyActions.append(link('Ver ejecución', build.github_run_url, 'cms-text-link'));
        if (historyActions.childElementCount) info.append(historyActions);
        history.append(item);
      }
    }
    renderHistory(builds);
    const activeBuild = builds.find((build) => ['queued', 'building'].includes(build.status));
    if (activeBuild) publication.observe(activeBuild.id);
    root.append(panel);
  } catch {
    moduleFailure(root, () => {
      void mountOverview(root, client, onlyBuilds);
    });
  }
}
