import { fullHomeSnapshot, fixtureId, ids, row } from './home-snapshot.ts';
import { parsePublicSnapshot } from '../../src/lib/content/parse-snapshot.ts';
import type { PublicSnapshotRows } from '../../src/types/content.ts';

export const longArticle = [
  'Un artículo sintético para comprobar lectura, código y media. No describe un proyecto real.',
  '## Observar antes de automatizar',
  'La primera herramienta es una pregunta: **¿dónde se interrumpe el trabajo?** Una conversación con el equipo permite distinguir el problema de sus síntomas.',
  'Una solución útil empieza al reconocer las decisiones que ya se toman. Documentar entradas, responsables y excepciones ayuda a construir un lenguaje compartido antes de elegir herramientas.',
  '> Automatizar tiene sentido cuando entendemos qué queremos mejorar.',
  '## Dibujar el recorrido',
  '1. Identificar la entrada.\n2. Hacer visibles las decisiones.\n3. Acordar una salida verificable.',
  '### Las excepciones también cuentan',
  'No todos los casos siguen el mismo camino. En este ejemplo de prueba separamos la validación de la ejecución para que el código explique su intención.',
  '```typescript filename="process.ts" lines\nconst input = { ready: true };\n// Ejemplo exclusivo de pruebas\nexport function process(value: { ready: boolean }) {\n  return value.ready ? "continue" : "review";\n}\nconsole.log(process(input));\n```',
  '## Hacer visible el sistema',
  `![Diagrama autorizado](media:${ids.image})`,
  'La imagen forma parte del artefacto estático. El artículo no necesita consultar Storage cuando una persona lo lee.',
  '| Etapa | Entrada | Decisión | Resultado |\n| --- | --- | --- | --- |\n| Recepción | Solicitud | ¿Está completa? | Validación |\n| Revisión | Datos verificados | ¿Requiere contexto? | Una acción clara |',
  '## Evaluar y aprender',
  'El recorrido vuelve al equipo. Revisamos qué fue útil, qué resultó difícil de entender y qué conviene ajustar. La información del proceso guía la siguiente iteración.',
  '- Un criterio de aceptación compartido.\n- Una excepción documentada.\n- Un resultado verificable.',
  '### Evaluar y aprender',
  'El mismo título puede aparecer de nuevo sin repetir su identificador. [Volver a observar](#observar-antes-de-automatizar).',
  'Un recurso externo: [documentación de Astro](https://docs.astro.build/). Código literal: `<script>alert("texto")</script>`.',
].join('\n\n');

/** Full/minimal editorial fixtures. Imported only by the loopback test server and tests. */
export function publicPagesSnapshot(origin?: string) {
  const base = fullHomeSnapshot(origin);
  return parsePublicSnapshot({
    ...base,
    settings: {
      ...base.settings,
      about_profile_markdown:
        'En este perfil sintético exploramos cómo comunicar un trabajo técnico con claridad.\n\nEl objetivo del fixture es probar una biografía extensa sin agregar experiencia inventada al sitio real.',
      working_method_markdown:
        'Entender el contexto, **hacer visible el proceso** y construir una solución que se pueda mantener.\n\nCada paso del ejemplo deja una decisión documentada.',
    },
    contact: { ...base.contact, form_enabled: true },
    projects: base.projects
      .map((project, index) =>
        index === 0
          ? {
              ...project,
              subtitle: 'Un recorrido claro, desde la solicitud hasta la decisión.',
              role: 'Diseño y desarrollo — fixture',
              problem:
                'Las solicitudes del ejemplo llegan por canales distintos. El equipo necesita entender **qué sigue y quién decide**.',
              objective:
                'Crear un recorrido que permita comprobar el estado de cada solicitud, sin perder su contexto.',
              solution:
                'Una interfaz organiza el trabajo en tres pasos:\n\n1. Recibir.\n2. Validar.\n3. Resolver.',
              architecture: `El flujo del fixture separa las entradas, las reglas y sus resultados.\n\n![Flujo de prueba](media:${ids.image})`,
              before_markdown: 'El contexto permanece disperso entre distintas herramientas.',
              after_markdown: 'Un recorrido compartido conecta cada decisión con su información.',
              challenges: 'Resumen que no debe duplicarse cuando hay desafíos detallados.',
              learnings:
                'Una solución se vuelve más simple cuando el equipo comparte el mismo lenguaje.\n\nEste aprendizaje pertenece al relato sintético de pruebas.',
            }
          : index === 2
            ? { ...project, summary: null, year: null }
            : project,
      )
      .concat([
        row('projects', {
          id: fixtureId(19),
          slug: 'never-draft-project',
          title: 'PRIVATE_PROJECT_CANARY',
          published: false,
          status: 'development',
        }),
      ]),
    project_features: [
      row('project_features', {
        id: fixtureId(200),
        project_id: ids.project,
        title: 'Un recorrido compartido',
        description: 'Cada etapa tiene una entrada y un resultado.',
        sort_order: 0,
      }),
      row('project_features', {
        id: fixtureId(201),
        project_id: ids.project,
        title: 'Decisiones con contexto',
        description: 'La información acompaña el trabajo.',
        sort_order: 1,
      }),
    ],
    project_images: [
      row('project_images', {
        id: fixtureId(202),
        project_id: ids.project,
        asset_id: ids.image,
        alt_text: 'Diagrama de prueba',
        caption: 'Flujo conceptual — archivo sintético.',
      }),
      row('project_images', {
        id: fixtureId(203),
        project_id: ids.project,
        asset_id: ids.secondImage,
        alt_text: 'Panel de prueba',
        caption: 'Vista de datos — archivo sintético.',
        sort_order: 1,
      }),
    ],
    project_challenges: [
      row('project_challenges', {
        id: fixtureId(204),
        project_id: ids.project,
        title: 'Hacer comprensibles las excepciones',
        problem: 'El camino no siempre es lineal.',
        solution: 'Separamos la validación del procesamiento para conservar una salida explícita.',
      }),
    ],
    experiences: base.experiences.map((experience) => ({
      ...experience,
      description_markdown:
        'Una descripción extendida del rol de prueba.\n\n- Acordar criterios con el equipo.\n- Documentar las decisiones técnicas.',
    })),
    experience_highlights: [
      row('experience_highlights', {
        id: fixtureId(205),
        experience_id: ids.experience,
        title: 'El proceso explicado',
        description: 'Un hito sintético para comprobar la versión extendida de la trayectoria.',
      }),
    ],
    posts: base.posts
      .map((post, index): PublicSnapshotRows['posts'] => ({
        ...post,
        content_markdown:
          index === 0
            ? longArticle
            : 'Una nota breve de prueba.\n\n## Una idea concreta\n\nEl contenido corto también necesita espacio y una jerarquía clara.',
        featured: index === 0,
        reading_time: null,
      }))
      .concat([
        row('posts', {
          id: fixtureId(23),
          title: 'Documentar una decisión.',
          slug: 'fixture-documentar',
          status: 'published',
          published_at: '2026-07-01T12:00:00Z',
          content_markdown: 'Una publicación de prueba para comprobar tres artículos relacionados.',
        }),
        row('posts', {
          id: fixtureId(24),
          title: 'PRIVATE_POST_CANARY',
          slug: 'never-draft-post',
          status: 'draft',
          content_markdown: 'PRIVATE_BODY_CANARY',
        }),
        row('posts', {
          id: fixtureId(25),
          title: 'FUTURE_POST_CANARY',
          slug: 'never-future-post',
          status: 'published',
          published_at: '2099-01-01T12:00:00Z',
          content_markdown: 'FUTURE_BODY_CANARY',
        }),
        row('posts', {
          id: fixtureId(26),
          title: 'ARCHIVED_POST_CANARY',
          slug: 'never-archived-post',
          status: 'archived',
          published_at: '2026-08-01T12:00:00Z',
          content_markdown: 'ARCHIVED_BODY_CANARY',
        }),
      ]),
    categories: base.categories.concat([
      row('categories', {
        id: fixtureId(61),
        name: 'Desarrollo',
        slug: 'desarrollo',
        visible: true,
        sort_order: 1,
      }),
      row('categories', {
        id: fixtureId(62),
        name: 'Categoría sin publicaciones',
        slug: 'vacia',
        visible: true,
        sort_order: 2,
      }),
    ]),
    post_category_relations: base.post_category_relations.concat([
      { post_id: fixtureId(21), category_id: fixtureId(61) },
      { post_id: fixtureId(22), category_id: ids.category },
    ]),
    tags: [row('tags', { id: fixtureId(63), name: 'procesos', slug: 'procesos' })],
    post_tags: [
      { post_id: ids.post, tag_id: fixtureId(63) },
      { post_id: fixtureId(21), tag_id: fixtureId(63) },
    ],
  });
}
