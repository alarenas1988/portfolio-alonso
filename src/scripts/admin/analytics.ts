import type { AdminClient } from '../../lib/admin/repository.ts';
import { loadAnalyticsReport, analyticsRange, validateRange } from '../../lib/analytics/queries.ts';
import { el, button, feedback } from '../../lib/admin/dom.ts';
import { stat } from './overview.ts';
export async function mountAnalytics(root: HTMLElement, client: AdminClient) {
  const form = el('form', '', 'cms-toolbar'),
    rangeLabel = el('label', 'Período'),
    range = el('select');
  for (const [value, label] of [
    ['7', 'Últimos 7 días'],
    ['30', 'Últimos 30 días'],
    ['90', 'Últimos 90 días'],
    ['366', 'Últimos 12 meses'],
    ['custom', 'Personalizado'],
  ]) {
    const opt = el('option', label);
    opt.value = value!;
    range.append(opt);
  }
  range.setAttribute('aria-label', 'Período');
  range.value = '30';
  rangeLabel.append(range);
  const fromLabel = el('label', 'Desde'),
    from = el('input'),
    toLabel = el('label', 'Hasta'),
    to = el('input');
  from.type = to.type = 'date';
  fromLabel.append(from);
  toLabel.append(to);
  const setRange = () => {
    if (range.value !== 'custom') {
      const dates = analyticsRange(Number(range.value) as 7 | 30 | 90 | 366);
      from.value = dates.from;
      to.value = dates.to;
    }
  };
  setRange();
  const status = el('p', '', 'cms-notice'),
    output = el('div');
  status.setAttribute('role', 'status');
  form.append(
    rangeLabel,
    fromLabel,
    toLabel,
    button('Actualizar', () => {
      void load();
    }),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void load();
  });
  range.addEventListener('change', () => {
    setRange();
    void load();
  });
  from.addEventListener('change', () => {
    range.value = 'custom';
  });
  to.addEventListener('change', () => {
    range.value = 'custom';
  });
  root.replaceChildren(
    form,
    el(
      'p',
      'Datos agregados privados. Las sesiones son aproximadas y rotan diariamente; no representan personas identificadas.',
      'cms-muted',
    ),
    status,
    output,
  );
  async function load() {
    output.setAttribute('aria-busy', 'true');
    try {
      validateRange(from.value, to.value);
      const report = await loadAnalyticsReport(client, from.value, to.value);
      feedback(status, 'America/Santiago · ' + report.from + ' → ' + report.to);
      const stats = el('section', '', 'cms-stats');
      stats.append(
        stat('Vistas de página', report.summary.page_views),
        stat('Sesiones aproximadas', report.summary.unique_sessions),
        stat('Conversiones de contacto', report.summary.contact_submits),
        stat('Descargas CV', report.summary.cv_downloads),
      );
      output.replaceChildren(stats);
      const trend = el('section', '', 'cms-panel');
      trend.append(el('h2', 'Vistas por día'));
      if (report.daily.length) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 800 150');
        svg.setAttribute('class', 'cms-spark');
        svg.setAttribute('role', 'img');
        svg.setAttribute(
          'aria-label',
          'Tendencia de vistas diarias; valores disponibles en la tabla',
        );
        const path = document.createElementNS(svg.namespaceURI, 'polyline');
        const max = Math.max(1, ...report.daily.map((d) => d.page_views));
        path.setAttribute(
          'points',
          report.daily
            .map(
              (d, i) =>
                `${(i * 800) / Math.max(1, report.daily.length - 1)},${140 - (d.page_views / max) * 130}`,
            )
            .join(' '),
        );
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        svg.append(path);
        trend.append(svg);
      } else trend.append(el('p', 'Todavía no hay eventos en este período.', 'cms-empty'));
      const daily = el('details');
      daily.append(
        el('summary', 'Ver valores diarios'),
        table(
          ['Fecha', 'Vistas', 'Sesiones'],
          report.daily.map((d) => [d.date, d.page_views, d.unique_sessions]),
        ),
      );
      trend.append(daily);
      output.append(trend);
      const cols = el('div', '', 'cms-columns');
      const pages = el('section', '', 'cms-panel');
      pages.append(
        el('h2', 'Páginas más vistas'),
        table(
          ['Ruta', 'Vistas'],
          report.topPages.map((p) => [p.pathname, p.views]),
        ),
      );
      const interactions = el('section', '', 'cms-panel');
      interactions.append(
        el('h2', 'Interacciones'),
        table(
          ['Acción', 'Cantidad'],
          [
            ['WhatsApp', report.summary.whatsapp_clicks],
            ['Email', report.summary.email_clicks],
            ['Copiar email', report.summary.email_copies],
            ['GitHub', report.summary.github_clicks],
            ['LinkedIn', report.summary.linkedin_clicks],
            ['Demo', report.summary.demo_clicks],
            ['Compartir', report.summary.article_shares],
          ],
        ),
      );
      cols.append(pages, interactions);
      output.append(cols);
      const ids = report.topContent.map((c) => c.content_id);
      const [projects, posts] = ids.length
        ? await Promise.all([
            client.from('projects').select('id,title').in('id', ids),
            client.from('posts').select('id,title').in('id', ids),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];
      const names = new Map(
        [...(projects.data ?? []), ...(posts.data ?? [])].map((c) => [c.id, c.title]),
      );
      for (const [type, label] of [
        ['project', 'Proyectos más vistos'],
        ['post', 'Artículos más leídos'],
      ]) {
        const panel = el('section', '', 'cms-panel');
        panel.append(
          el('h2', label),
          table(
            ['Contenido', 'Vistas', 'Interacciones'],
            report.topContent
              .filter((c) => c.content_type === type)
              .map((c) => [
                names.get(c.content_id) ?? 'Contenido retirado',
                c.views,
                c.interactions,
              ]),
          ),
        );
        output.append(panel);
      }
      const dimensions = el('section', '', 'cms-panel');
      dimensions.append(
        el('h2', 'Origen y contexto general'),
        table(
          ['Dimensión', 'Categoría', 'Vistas'],
          report.dimensions.map((d) => [d.dimension, d.value, d.views]),
        ),
      );
      output.append(dimensions);
    } catch {
      feedback(
        status,
        'No se pudo obtener el informe. Revisa las fechas (máximo 366 días) y reintenta.',
        'error',
      );
    } finally {
      output.removeAttribute('aria-busy');
    }
  }
  await load();
}
function table(headings: string[], rows: (string | number)[][]) {
  const wrap = el('div', '', 'cms-table-scroll');
  if (!rows.length) {
    wrap.append(el('p', 'Sin datos en este período.', 'cms-muted'));
    return wrap;
  }
  const table = el('table'),
    head = el('thead'),
    tr = el('tr');
  for (const h of headings) {
    const th = el('th', h);
    th.scope = 'col';
    tr.append(th);
  }
  head.append(tr);
  const body = el('tbody');
  for (const values of rows) {
    const row = el('tr');
    for (const value of values) row.append(el('td', String(value)));
    body.append(row);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}
