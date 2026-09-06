# F4 — Páginas públicas internas

Fecha: 2026-09-06. Base: `1f4780a1e87a418c0cee9e8ad12df7f7c38dcb50`, origin/main sincronizado y limpio, con F1/F2/F5/F6/F8/F3 y los checkpoints Supabase integrados. Rama `feat/f4-public-pages`; worktree `.worktrees/f4-public-pages`. F3 ya estaba integrada mediante PR #9; no se repite su integración.

## Rutas y lectura

| Ruta lógica          | Contenido y condiciones                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/proyectos/`        | Introducción editorial, selección destacada, todos los casos, filtro de tecnologías con uso público y CTA.                                                                                                                    |
| `/proyectos/[slug]/` | Solo proyectos publicados, no archivados y con fecha de publicación cumplida. Narrativa, antes/después, funcionalidades, tecnologías, galería, resultados, desafíos/aprendizajes, enlaces y siguiente caso son condicionales. |
| `/blog/`             | Destacado editorial, categorías con artículos públicos, listado por recencia y ranking únicamente cuando `popular_rank` existe.                                                                                               |
| `/blog/[slug]/`      | Solo estado published con published_at no futura. Markdown, TOC, código, tags, compartir y hasta tres relacionados.                                                                                                           |
| `/sobre-mi/`         | Perfil y método desde settings, especialidades, principios, experiencia completa, stack, proyectos relacionados, CV y contacto según visibilidad.                                                                             |
| `/contacto/`         | Canales reales visibles y UI de formulario con envío no disponible.                                                                                                                                                           |
| `/404.html`          | Recuperación estática coherente con la navegación; noindex, sin fallback SPA.                                                                                                                                                 |

Todos los enlaces se resuelven con `createUrlHelpers()`. El artefacto utiliza `/portfolio-alonso/`, directorios con index.html y barra final. Navbar, MobileNavigation, Footer, ProjectCard, BlogCard, ExperienceTimeline y MediaImage siguen siendo los componentes de F3/F8. Navbar marca la sección actual y empieza compacta en páginas internas. Home ahora enlaza a índices y detalles válidos.

`loadPublicPages()` conserva una promesa por build: `loadPublicSnapshot()` → parser del contrato F5 → `buildSnapshotAssets()` F8 → `createPublicModel()`. Los getStaticPaths y todas las páginas comparten esa lectura. `homeFromPublic()` limita únicamente las colecciones de Home. Se verifican slugs ASCII lowercase y colisiones antes de generar rutas. No hay SSR ni consultas de componentes al backend.

La clave publicable se usa como API key, sin JWT owner, secret key ni service_role. Un error de lectura, contrato o asset requerido falla el build; no se sustituye por contenido vacío o un snapshot anterior. En desarrollo se vuelve a leer para mostrar cambios editoriales. Los fixtures y clientes explícitos no comparten la caché productiva.

## Markdown y seguridad

`renderMarkdown(source, options): Promise<RenderedMarkdown>` es el contrato compartido para build y futura preview. Devuelve HTML sanitizado, TOC tipado y tiempo de lectura. No se crea una preview CMS en F4.

Flujo: remark-parse + remark-gfm → AST Markdown → remark-rehype → transformaciones propias tipadas → rehype-sanitize con allowlist → rehype-stringify. HTML del autor se descarta; no se habilitan rehype-raw, MDX, componentes, scripts, iframes, SVG, eventos ni estilos arbitrarios. Se rechazan imágenes externas y assets que no estén en el mapa público. Los enlaces inseguros pierden su destino. Los enlaces externos HTTPS válidos usan noopener/noreferrer; las rutas internas permanecen bajo el base.

Los H1 editoriales pasan a H2 para mantener un único H1 de página. Los IDs tienen namespace, contador y prefijo `content-`, evitando colisiones y DOM clobbering. TOC solo aparece con al menos tres H2/H3. El tiempo de lectura usa palabras del AST a 220 palabras/minuto, mínimo uno; excluye frontmatter y HTML descartado. Se respeta reading_time cuando está definido en DB.

Shiki, ya usado por Astro y ahora dependencia directa fijada, tokeniza durante renderizado. Sus tokens se convierten a spans con clases permitidas y colores existentes de F2; no se aceptan estilos del autor. Lenguajes desconocidos se muestran como texto. Se admite `filename="archivo.ts"` y `lines` en el fence. El código conserva espacios, saltos y caracteres escapados; números visuales de línea no entran al portapapeles. Copiar código se carga en artículos/casos, no en Home o índices. Tablas y pre tienen scroll local y acceso por teclado.

Decisión de dependencias: [remark](https://github.com/remarkjs/remark) permite trabajar con el mismo AST en servidor y cliente; [remark-gfm](https://github.com/remarkjs/remark-gfm) aporta tablas y listas; [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) elimina nodos/atributos ajenos a la allowlist. Las versiones exactas y su grafo quedan en package-lock.json. El navegador público recibe el resultado estático, no estos parsers ni Shiki.

## Media, metadata y orden

No hay un segundo pipeline de imágenes. La sintaxis editorial es `![Descripción](media:UUID)`: el renderer utiliza el asset map de F8 para picture AVIF/WebP/PNG, dimensiones y alt editorial. Imágenes ausentes, privadas, documentos usados como imagen o URLs ajenas al artefacto fallan. También se comprueban imágenes/enlaces dentro de tablas.

Galerías y portadas usan MediaImage. El CV requiere settings cv_enabled, documento cv activo, metadata pública PDF y archivo local presente; nunca signed URL. No se descargan archivos en el navegador desde Supabase.

El siguiente proyecto sigue sort_order entre casos públicos y se oculta con un único caso. Relacionados: cantidad de categorías compartidas, después tags compartidos, recencia y UUID como desempate estable; se excluye el artículo actual. No hay recomendador ni tracking. Los eventos de compartir y copiar usan el no-op tipado existente.

Metadata básica por ruta: title, description, canonical, robots y Open Graph. Detalles respetan overrides y usan OG/portada del mapa cuando existe. Canonical evita duplicar el base y contempla el futuro cambio de dominio. No se implementan feeds, sitemap avanzado, Schema ni auditoría SEO F12.

## Formulario y dependencia de F9

La UI incluye nombre, email, asunto, mensaje, honeypot, labels, ayudas, errores asociados, contador, autocomplete y feedback accesible. Los límites cliente son 2–100, 3–254, 3–160 y 20–5000 caracteres respectivamente. Son validación de UX; F9 debe validar nuevamente del lado servidor.

El envío está siempre deshabilitado en F4. Con form_enabled=false se deshabilita también el fieldset. Con form_enabled=true puede revisarse el texto localmente; el adapter devuelve únicamente unavailable y conserva los campos. No existe mensaje de entrega exitosa, petición HTTP, insert a DB, mailto sustitutivo ni endpoint ficticio. `method="dialog"` fuera de un dialog evita navegación/envío nativo sin JavaScript; con JS también se cancela submit. Los datos no se persisten en localStorage.

F9 deberá suministrar el transporte contact-submit, estados reales y controles server-side antes de habilitar Enviar. No se implementó esa fase.

## Fixtures y verificación reproducible

`tests/fixtures/public-pages-snapshot.ts` amplía el servidor loopback: tres proyectos públicos (completo, parcial y mínimo), cuatro artículos públicos (largo/cortos), drafts/archivado/futuro con canarios, galería de dos imágenes sintéticas, CV de prueba, categorías/tags, experiencia y contacto. Estos datos nunca entran al seed ni al Supabase remoto.

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:home:build
node scripts/test-empty-public-pages.mjs .tools/home-build-empty
npm.cmd run test:e2e
node scripts/capture-public-pages.mjs .tools/home-e2e-dist fixture
npm.cmd run build
npm.cmd run check:static
npm.cmd run check:secrets
node scripts/test-empty-public-pages.mjs dist
node scripts/capture-public-pages.mjs dist remote
```

`test:home:build` ahora verifica también rutas internas y HTML físico: tres casos/cuatro artículos en el fixture completo, cero detalles en el vacío, una RPC por build y fallo explícito ante indisponibilidad, contrato incompatible o asset faltante. `test-empty-public-pages` es específico para un artefacto sin proyectos/posts; el comando contra dist se usa en esta entrega porque el snapshot real todavía tiene esas colecciones vacías.

El servidor fixture se cierra antes de E2E. El navegador solo ve el artefacto estático. Las pruebas abarcan nueve anchos 320/360/390/640/768/1024/1280/1440/1920, axe, teclado, Escape/retorno de foco, filtros, copy, formulario, no-JS, reduced motion, enlaces, 404 y recursos locales. La revisión visual usa capturas en `.tools/f4-visual/`, ignoradas por Git: proyectos 390/768/1440; caso, blog, artículo, perfil y contacto 390/1440; además estados reales vacíos. Se inspeccionan las imágenes, no solo métricas automáticas.

## Resultado de validación

| Control                         | Resultado                                                     |
| ------------------------------- | ------------------------------------------------------------- |
| npm ci / npm ls --depth=0       | Instalación reproducible y dependencias válidas               |
| npm audit --audit-level=high    | 0 vulnerabilidades                                            |
| format:check / lint / typecheck | Correctos; 120 archivos, 0 errores/warnings/hints             |
| npm test                        | 133 aprobadas, 0 fallos                                       |
| npm run test:e2e                | 176 aprobadas, 58 omitidas según dispositivo/matriz, 0 fallos |
| Builds aislados                 | 5 escenarios con resultados esperados; 1 RPC por build        |
| Estados vacíos offline / reales | 16 comprobaciones cada uno, con/sin JS                        |
| Astro dev                       | Snapshot anónimo y tres assets F8 bajo el base                |
| Build remoto público            | 6 HTML, sin detalles ficticios                                |
| check:static / check:secrets    | Correctos; 6 HTML / 21 artefactos                             |
| Revisión visual                 | 13 capturas completas fixture y 9 reales, inspeccionadas      |
| git diff --check                | Correcto                                                      |

Se conservaron los controles de F1/F2/F3/F8. La matriz detectó dos regresiones potenciales en componentes compartidos: IDs SVG duplicados entre navbar/footer y un enlace BlogCard menor a 44px durante transform a 768px. Se corrigieron con ID por instancia y área mínima de 48px; la suite completa se repitió sin reducir sus exigencias. La revisión visual también ajustó la composición destacada de proyectos, jerarquía del blog y marcadores de listas.

No se midió la auditoría final LCP/CLS/INP de F13. Axe y la revisión manual respaldan las páginas/estados probados; el contenido que se publique posteriormente debe conservar sus requisitos de alt, estructura y visibilidad.

## Dependencias e inventario

Dependencias de renderizado fijadas: unified 11.0.5, remark-parse 11.0.0, remark-gfm 4.0.1, remark-rehype 11.1.2, rehype-sanitize 6.0.0, rehype-stringify 10.0.1, unist-util-visit 5.1.0 y Shiki 4.4.3. Tipos de desarrollo: @types/hast 3.0.5 y @types/mdast 4.0.4. Shiki ya era transitiva de Astro y ahora se declara directamente. No se agregó framework de UI ni otra infraestructura de media.

**62 archivos creados/modificados** respecto de la base. Inventario agrupado:

- Configuración/documentación: README.md; eslint.config.mjs; package.json; package-lock.json; docs/ARCHITECTURE.md; docs/CONTENT.md; docs/PHASE_LOG.md; docs/PUBLIC_PAGES.md.
- Scripts: scripts/capture-public-pages.mjs; scripts/static-preview.mjs; scripts/test-empty-public-pages.mjs; scripts/test-home-build.mjs.
- Componentes públicos: src/components/public/AboutSection.astro; BlogCard.astro; BlogSection.astro; Breadcrumbs.astro; ContactForm.astro; ContactSection.astro; ContentFilters.astro; EditorialEmpty.astro; ExperienceTimeline.astro; MarkdownContent.astro; MobileNavigation.astro; Navbar.astro; PageHero.astro; ProjectCard.astro; ProjectCaseStudy.astro; ShareActions.astro.
- Compartidos/layout: src/components/shared/BrandMark.astro; src/layouts/InternalLayout.astro.
- Contratos de contacto: src/lib/contact/adapter.ts; src/lib/contact/validation.ts.
- Presentación/lectura: src/lib/content/home.ts; home-build.ts; interactions.ts; pages.ts; public-build.ts.
- Markdown: src/lib/markdown/code.ts; reading-time.ts; render.ts; sanitize.ts; toc.ts.
- Rutas: src/pages/404.astro; src/pages/blog/[slug].astro; src/pages/blog/index.astro; src/pages/contacto.astro; src/pages/proyectos/[slug].astro; src/pages/proyectos/index.astro; src/pages/sobre-mi.astro.
- Navegador/estilos: src/scripts/code-copy.ts; contact-form.ts; content-filters.ts; navigation.ts; src/styles/editorial.css.
- E2E: tests/e2e/home.spec.ts; tests/e2e/public-pages.spec.ts.
- Fixtures: tests/fixtures/home-server.ts; home-snapshot.ts; public-pages-snapshot.ts.
- Unitarias: tests/unit/home.test.ts; tests/unit/markdown.test.ts; tests/unit/public-pages.test.ts.

Los componentes nuevos son Breadcrumbs, ContactForm, ContentFilters, EditorialEmpty, MarkdownContent, PageHero, ProjectCaseStudy y ShareActions, más InternalLayout. El resto reutiliza y extiende F3 sin crear navegación o pipeline paralelo.

## Estado real y límites

El build público real genera seis HTML: Home, proyectos, blog, sobre-mi, contacto y 404. No genera detalles ficticios. Muestra identidad/claim/resumen, seis especialidades y cuatro principios reales. No hay proyectos, posts, experiencia, tecnologías, métricas o media publicados; los canales de contacto/CV permanecen ocultos y form_enabled está deshabilitado.

No se modificaron Supabase remoto, migraciones, RLS, Auth, Storage, buckets, owner ni seed. No se inició F7/F9/F10/F11/F12/F13/F14. El trabajo queda en commits locales para revisión, sin PR ni merge automático. La carga de contenido real, el envío de contacto y las auditorías finales continúan en sus fases autorizadas.
