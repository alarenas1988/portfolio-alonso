# F3 — Home pública

## Base y alcance

Fecha: 2026-09-06. Base sincronizada: `ac2045a85e9d8d10ffc9675b3dc82c8a300a9ccf` (origin/main, incluye F1/F2/F5/F6/F8, baseline 019 y despliegue inicial remoto). Desarrollo aislado en `feat/f3-public-home`, worktree `.worktrees/f3-public-home`. No se reutilizan worktrees de backend.

Se consultaron el plan, el maestro y los contratos aprobados de F2/F5/F6/F8. La skill subagent-driven-development no estaba disponible; implementación secuencial con frontend-design respetando los tokens existentes. No se añaden dependencias.

## Presentación y contenido

Orden: Navbar → Hero → Proyectos destacados → Sobre mí → Especialidades → Stack → Experiencia → Impacto → Blog/Insights → Contacto → Footer. Impacto se omite cuando no hay métricas visibles. Las colecciones vacías de proyectos, stack, experiencia y blog conservan una indicación editorial discreta. Especialidades y principios se omiten si no existen.

`src/components/public/` separa Navbar, MobileNavigation, Hero/HeroVisual, ProjectCard, TechnologyBadge, ExperienceTimeline, BlogCard, ContactCard, Footer y las secciones. `index.astro` solo carga y compone. Se reutilizan BrandMark, Button, Icon, MediaImage, PublicLayout y los tokens/fuentes/fondo/motion de F2.

`createHomeModel()` transforma el DTO validado en props. Filtra publicación, fechas, visibilidad y relaciones, limita destacados a seis, experiencia a cuatro y posts recientes a tres. Las categorías del stack vienen de tecnologías visibles. No usa porcentajes ni inventa datos. About muestra un extracto de texto seguro; el renderer completo Markdown queda para F4. Astro escapa el texto: no hay set:html para contenido editorial.

Hero muestra la identidad y texto real configurado. El terminal es conceptual, con profile.initialize y cuatro dominios ready; ONLINE no representa monitorización. No hay reloj, health checks, typing infinito, WebGL ni canvas. Las entradas escalonadas solo trasladan 12px y mantienen el contenido visible/interactivo. El máximo delay es 700ms y la duración 400ms. La navbar se compacta con scroll y blur selectivo. Los proyectos elevan 5px y escalan la imagen 1.025 solo con puntero fino y sin reduced motion.

Contacto respeta email_visible/whatsapp_visible, social_links.visible y cv_enabled. wa.me se construye desde número y mensaje configurados; email ofrece mailto y copia con feedback aria-live, sin alert. El CV requiere documento activo y PDF público presente en el asset map. No se usan legacy CV URLs ni signed URLs. Los hooks de interacción son un no-op tipado para F10, sin red ni almacenamiento.

Metadata básica: title, description, canonical, robots y Open Graph desde settings; imagen OG solo mediante asset map. No se implementa sitemap, Schema ni auditoría SEO final.

## Lectura y assets

Flujo real: Astro → publishable key → RLS → get_public_snapshot → parser F5 → pipeline F8 → modelo Home → HTML estático. Sin JWT owner, secret key o service role. El runtime del navegador no necesita Supabase.

Los archivos referenciados se descargan únicamente desde el origen configurado y buckets aprobados por F8, con timeout, límite, validación de bytes y sin redirects. Se generan variantes AVIF/WebP/PNG y copia PDF bajo assets/media con hash. MediaImage proporciona dimensiones, srcset, sizes, alt y lazy loading. La Home no conoce rutas de Storage. Una referencia requerida privada, rota o inválida detiene el build; una colección vacía no es un error de lectura.

Lectura remota F3: identidad AL/Alonso Larenas, claim y disciplinas, resumen profesional, seis especialidades y cuatro principios. No existen proyectos, posts, experiencias, tecnologías, métricas públicas ni assets reales publicados. Contacto, redes y CV no están configurados/visibles. La Home respeta ese estado sin sembrar contenido. No hubo escrituras de backend.

## Navegación y límite con F4

Los helpers de URL existentes generan toda navegación interna respetando `/portfolio-alonso/`. F4 todavía no proporciona `/proyectos/`, `/blog/`, `/sobre-mi/` ni artículos. Durante F3 los enlaces principales apuntan a secciones de Home; About enlaza a los principios. Las tarjetas de proyecto ofrecen enlaces externos reales cuando existen. La preview de blog no inventa enlaces a artículos inexistentes.

Desviación explícita de la solicitud: el enlace a la página Sobre mí y el CTA «Ver todos los insights» quedan pendientes de las rutas F4. Se consultó esta preferencia durante implementación; se adoptaron anclas funcionales mientras no hubiera respuesta. No se crearon páginas F4 ni se relajó el validador de enlaces estáticos para aceptar 404.

## Pruebas reproducibles

`npm test` usa DTOs sintéticos tipados en tests/fixtures, nunca seed ni contenido remoto. Cubre mapping, límites, estados, relaciones, visibilidad, URLs, fechas de Santiago, períodos editoriales, WhatsApp, email, CV y assets requeridos.

`npm run test:home:build` levanta un servidor HTTP loopback temporal con la RPC y bytes PNG/PDF sintéticos. Prueba builds completos y vacíos y exige fallo de producción ante 503, contrato incompatible y asset requerido ausente. Verifica tres assets, formatos, ausencia de endpoint/API key en HTML y ausencia de rutas de fixture en un build normal.

`npm run test:e2e` usa el mismo servidor, compila en `.tools/home-e2e-dist` y apaga la API antes del preview. Eso prueba que imágenes y CV son autocontenidos. Solo en este artefacto se inyectan fixtures de Design System, media y Home vacía. Unit tests y E2E no dependen de Docker ni de disponibilidad remota.

`node scripts/test-home-dev.mjs` comprueba la misma cadena en Astro dev con un outDir aislado. Verifica snapshot y tres archivos reales PNG/PDF. El middleware contempla que Vite retire el base antes de ejecutar las integraciones. La prueba usa un puerto loopback temporal y detiene su propio proceso; no reutiliza ni sustituye servidores del usuario.

Para reproducir capturas: `node scripts/capture-home.mjs dist remote` o `node scripts/capture-home.mjs .tools/home-e2e-dist fixture` después del build correspondiente. El script sirve únicamente el artefacto local y comprueba una H1, imágenes válidas, ausencia de overflow y cero recursos externos.

Playwright: 320, 360, 390, 640, 768, 1024, 1280, 1440 y 1920px. Incluye teclado, Escape, retorno y ciclo de foco, scroll lock, click exterior, navegación desktop, links, dimensiones, ausencia de requests remotos, clipboard, contenido vacío/completo, reduced motion, no-JS y axe WCAG A/AA. El fallback nativo details/summary conserva navegación sin scripts.

La evidencia visual local vive en directorios ignorados: `test-results/` y `.tools/f3-visual/`. No se versionan capturas de entorno ni configuración. Los resultados finales y commits se registran en PHASE_LOG.md.

## Resultado de validación

| Control                         | Resultado                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| npm ci / npm ls --depth=0       | Instalación limpia, versiones fijadas, sin dependencias nuevas                            |
| npm audit --audit-level=high    | 0 vulnerabilidades                                                                        |
| format:check / lint / typecheck | Correctos; 89 archivos examinados, 0 errores/warnings/hints de tipos                      |
| npm test                        | 104/104; incluye 17 pruebas nuevas de presentación Home                                   |
| npm run test:e2e                | 114 aprobadas, 21 omitidas por dispositivo/matriz; 0 fallos                               |
| test:home:build                 | Cinco escenarios con resultado esperado; dos builds correctos y tres fallos exigidos      |
| test-home-dev.mjs               | Snapshot y tres assets F8 servidos correctamente bajo la base                             |
| npm run build                   | RPC pública remota real; dos páginas estáticas (Home y 404)                               |
| check:static / check:secrets    | Correctos; enlaces bajo la base, nueve archivos del artefacto sin secretos                |
| Capturas                        | Inspección de Hero, composición y secciones en 360/390/768/1024/1440/1920; real y fixture |
| git diff --check                | Correcto                                                                                  |

Se comprobó axe WCAG A/AA con Home completa/vacía y menú abierto, objetivos de interacción de 44px, teclado, foco, Escape, touch, reduced motion y no-JS. Las 21 omisiones son pruebas de menú móvil en desktop, menú desktop en móvil, tilt touch en desktop y el caso no-JS completo que se ejecuta una vez; las nueve variantes conservan además la prueba no-JS de bootstrap.

La revisión visual detectó y corrigió la separación de palabras del Hero y una superposición del terminal en tablet. Su altura ahora depende del contenido; los nodos quedan fuera del terminal. Se revisaron también tarjetas con/sin imagen, timeline, contraste, espacios, contacto y footer. Al ampliar la regresión F8 a 320px apareció un file input con ancho intrínseco excesivo: se limita al ancho disponible, sin cambiar servicios ni backend.

El HTML real mide 35.901 bytes e incorpora tres scripts pequeños: 4.141 bytes combinados (1.689 gzip como referencia). El CSS del artefacto suma 53.442 bytes (10.362 gzip como referencia). No se detectaron URL/key de Supabase ni contenido de fixtures en la Home real. Estas cifras describen el artefacto local; no equivalen a una auditoría de Core Web Vitals.

## Pendientes delimitados

La publicación de contenido real y canales de contacto sigue siendo editorial; F3 no modifica el backend para llenar la página. La disponibilidad de Supabase durante compilación es necesaria deliberadamente. El artefacto ya generado se sirve sin esa dependencia.

Los objetivos LCP <2.5s, CLS <0.1 e INP <200ms se mantienen como objetivos, no como métricas de campo demostradas. Se utiliza HTML estático, fuentes locales/preloads controlados, imágenes dimensionadas y poco JS; F13 hará la auditoría final. F4/F7/F9/F10/F11/F12/F13/F14 no se implementan aquí. No hay PR ni merge automático de F3.
