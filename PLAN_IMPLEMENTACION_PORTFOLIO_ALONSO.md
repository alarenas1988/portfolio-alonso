# Plan de implementación — Portfolio Alonso Larenas

> **Estado: plan aprobado; únicamente F1 autorizada y en ejecución.**
> Para ejecutar: seguir `superpowers:executing-plans`, tarea por tarea, con las verificaciones de este documento. Detenerse al terminar F1 para revisión. F2 y fases posteriores requieren autorización adicional.

**Objetivo:** construir el portfolio premium **AL — Alonso Larenas**, su CMS privado y su publicación C2, respetando la especificación maestra.

**Arquitectura:** un repositorio y un proyecto Astro. Supabase/PostgreSQL es la fuente de verdad; Astro obtiene contenido público durante el build; GitHub Actions publica el artefacto estático en GitHub Pages. `/admin` son páginas estáticas con módulos TypeScript que usan Supabase Auth, JWT y RLS.

**Stack:** Astro, Tailwind CSS, TypeScript, Supabase JS, PostgreSQL, Supabase Auth/Storage/Edge Functions, GitHub Actions/Pages. CSS, Web Animations API e IntersectionObserver para movimiento; Lucide para iconografía.

**Especificación:** [PORTFOLIO_ALONSO_LARENAS_CODEX_MASTER.md](./PORTFOLIO_ALONSO_LARENAS_CODEX_MASTER.md), copia íntegra del original de Downloads: 2.594 líneas, 37 secciones y cierre. SHA-256: `F38CE3E6A0E3A6AE012D29949D5170BB89F02FD443DFA1A2B7D5BF11AA106CD8`.

**Fecha de inspección:** 2026-09-05. El maestro prevalece en producto; la solicitud del usuario define el método y exige aprobación antes de implementar. Las decisiones que completan vacíos del maestro se identifican como propuestas en este plan.

## 1. Resumen ejecutivo

El repositorio está vacío de aplicación: contiene únicamente `.git/` y un README inicial. No hay código, dependencias, migraciones ni configuración que migrar. Se conservarán el historial Git, el remoto y la identificación del proyecto.

Se proponen 14 fases verificables. Se mantienen los números solicitados para trazabilidad, pero se adelantan base de datos y seguridad, como recomienda el maestro: **1 → 2 → 5 → 6 → 8 → 3 → 4 → 9 → 10A → 7 → 10B → 11 → 12 → 13 → 14**. F10A entrega eventos y consultas para un dashboard útil; F10B completa agregaciones multidimensionales, retención y optimizaciones antes del cierre de analítica. Así el frontend y el CMS consumen contratos reales y la base de datos nace protegida. SEO, accesibilidad y rendimiento se incorporan desde los primeros componentes y tienen una fase posterior de cierre.

Cada fase define dependencias, tareas, archivos, entregables, pruebas, riesgos y aceptación. Los módulos grandes se entregan en varios commits; una fase no se considera terminada si depende de integraciones todavía simuladas.

Las decisiones principales son: conservar C2; usar Tailwind mediante su plugin Vite; elegir TypeScript 6.0.3 por compatibilidad declarada del comprobador de Astro; usar Node 24 LTS; denegar administración a cualquier usuario autenticado que no sea el owner; separar guardado y publicación; generar HTML y assets públicos autocontenidos; proteger los callbacks y reconciliar builds interrumpidos.

## 2. Fase 0 — Inspección completada

| Elemento              | Resultado comprobado                                                                                              | Consecuencia                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Directorio            | `C:\laragon\www\portfolio`                                                                                        | Será la raíz del único proyecto Astro.                                                                        |
| Repositorio           | `https://github.com/alarenas1988/portfolio-alonso.git`                                                            | Conservar `origin`.                                                                                           |
| Rama / historial      | `main`, seguimiento `origin/main`; `094ec0f Initial commit`                                                       | No reescribir historial.                                                                                      |
| Archivos versionados  | Solo `README.md`: nombre del repositorio y “portfolio projects”                                                   | Ampliarlo en F1; no hay aplicación que preservar.                                                             |
| Estado inicial        | Sin cambios pendientes                                                                                            | Esta tarea añade únicamente este documento.                                                                   |
| Instrucciones locales | No se encontraron `AGENTS.md` en la raíz del proyecto ni en sus directorios ascendentes inspeccionados            | Se aplican las instrucciones de la sesión y el maestro.                                                       |
| Documento maestro     | Está en Downloads, fuera del repositorio                                                                          | F1 incorporará una copia idéntica versionada en la raíz, sin alterar el original.                             |
| Node/npm en PATH      | No encontrados por sus comandos habituales                                                                        | Preparar una invocación reproducible antes del bootstrap.                                                     |
| Node/npm de Laragon   | `C:\laragon\bin\nodejs\node-v22`: Node `22.22.0`, npm `10.9.4`                                                    | Cumplen los mínimos consultados; alinear desarrollo y CI con Node 24 LTS.                                     |
| Git / GitHub CLI      | Git `2.54.0.windows.1`; `gh` disponible                                                                           | Git local utilizable.                                                                                         |
| Identidad GitHub CLI  | Cuenta activa `alarenas-slepac`; `viewerPermission: READ` en el repositorio solicitado                            | Esta credencial no autoriza push, configuración ni dispatch. No se ha cambiado de cuenta.                     |
| GitHub Pages          | Consulta de estado devuelve HTTP 404 con la credencial actual                                                     | No permite distinguir sitio inexistente de falta de acceso; verificar con una cuenta autorizada antes de F11. |
| Supabase / Docker     | CLI Supabase y Docker no encontrados en PATH; no hay configuración ni credenciales del proyecto en el repositorio | Preparar entorno local reproducible y confirmar proyecto remoto antes de integración.                         |

No se han instalado paquetes, creado tablas, modificado servicios externos ni generado código de aplicación. No se ha probado el permiso de escritura Git por otra credencial distinta de GitHub CLI.

### 2.1 Versiones estables y compatibilidad consultadas

Consulta directa de los metadatos publicados por los mantenedores en npm y del índice oficial de Node. Son versiones observadas en esta fecha, no una promesa de que seguirán siendo las últimas al ejecutar el plan.

| Tecnología          | Estable más reciente observada  | Selección propuesta                             | Restricción / evidencia                                                                                                                                                                  |
| ------------------- | ------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro               | `7.3.1`                         | `7.3.1`                                         | `engines.node >=22.12.0`, npm `>=9.6.5`; usa Vite `^8.0.13`. [Metadatos](https://registry.npmjs.org/astro/7.3.1).                                                                        |
| Tailwind CSS        | `4.3.3`                         | `4.3.3`                                         | Integración CSS-first mediante plugin Vite. [Metadatos](https://registry.npmjs.org/tailwindcss/4.3.3).                                                                                   |
| `@tailwindcss/vite` | `4.3.3`                         | `4.3.3`                                         | Su peer admite Vite 5, 6, 7 y 8. [Metadatos](https://registry.npmjs.org/@tailwindcss/vite/4.3.3).                                                                                        |
| TypeScript          | `7.0.2`                         | **`6.0.3`**                                     | Última estable de la rama 6 observada, compatible con el peer del comprobador. [TS 7](https://registry.npmjs.org/typescript/7.0.2), [TS 6](https://registry.npmjs.org/typescript/6.0.3). |
| `@astrojs/check`    | `0.9.10`                        | `0.9.10`                                        | Peer TypeScript `^5.0.0                                                                                                                                                                  |     | ^6.0.0`, excluye 7. [Metadatos](https://registry.npmjs.org/@astrojs/check/0.9.10). |
| Supabase JS         | `2.115.0`                       | `2.115.0`                                       | Node `>=22.0.0`. [Metadatos](https://registry.npmjs.org/@supabase/supabase-js/2.115.0).                                                                                                  |
| Node.js             | `26.8.1` Current; `24.20.0` LTS | **`24.20.0` LTS**                               | Mismo runtime en desarrollo y CI; piso combinado `22.12.0`. [Índice oficial](https://nodejs.org/dist/index.json), [ciclo de versiones](https://nodejs.org/en/about/previous-releases).   |
| Sitemap / RSS Astro | `3.7.4` / `4.0.19`              | Esas versiones, sujeto a instalación comprobada | [Sitemap](https://registry.npmjs.org/@astrojs/sitemap/3.7.4), [RSS](https://registry.npmjs.org/@astrojs/rss/4.0.19).                                                                     |

La compatibilidad aquí es **declarada por metadatos**. F1 debe demostrarla con instalación limpia, `npm ls`, typecheck y build; no se ha realizado una instalación en esta tarea. Si cambian versiones, registrar fecha, evidencia y resultado antes de actualizar el lockfile. No usar `--force` ni `--legacy-peer-deps` para ocultar conflictos.

Tailwind 4 requiere navegadores modernos: Chrome 111+, Safari 16.4+ y Firefox 128+ como piso de su núcleo CSS. La matriz efectiva será la intersección con el target de Vite y las APIs utilizadas; se comprobarán versiones actuales de Chrome, Edge, Firefox y WebKit. [Compatibilidad oficial](https://tailwindcss.com/docs/compatibility). La integración será `@tailwindcss/vite`, según [Astro](https://docs.astro.build/en/guides/styling/) y [Tailwind](https://tailwindcss.com/docs/installation/using-vite), sin incorporar la integración antigua para Tailwind 3.

PostgreSQL y el runtime Edge se alinearán con el proyecto Supabase que se aprovisione y su CLI fijada. No se afirmará una versión remota sin inspeccionarla; la versión exacta, extensiones y configuración se registrarán al iniciar F5.

## 3. Restricciones globales

- Un solo repositorio y un solo proyecto Astro; salida estática, sin servidor tradicional ni SPA global.
- Supabase/PostgreSQL como fuente de verdad. No hardcodear biografía, experiencia, proyectos, artículos, métricas, especialidades, principios ni ajustes administrables.
- Identidad: **AL — Alonso Larenas**. Claim base del maestro: **Automatización · Desarrollo · Transformación Digital**; la descripción y el Hero incorporan Desarrollo, IA y Datos conforme al maestro.
- Sitio público expresivo y editorial; admin sobrio, denso y productivo con el mismo sistema visual.
- Markdown como fuente editorial; HTML sanitizado al generar y al mostrar previews.
- `authenticated != administrator`. Solo `admin_profiles.active = true` y `role = owner` habilitan escritura de contenido.
- RLS y grants desde la creación del esquema. Secretos solo en entornos privados; ningún service role en assets o HTML.
- Publicaciones estáticas por slug; edición administrativa con páginas físicas y `?id=UUID`.
- Todos los bloques opcionales del caso de estudio se omiten limpiamente si no tienen contenido; no generar títulos vacíos.
- Mobile-first; WCAG AA; targets ≥44px; `focus-visible`; reduced motion; contenido público legible sin JavaScript cuando sea posible.
- LCP <2,5 s; CLS <0,1; INP <200 ms. Mediciones de laboratorio y de campo deben identificarse por separado.
- Sin GSAP inicial, React global, comentarios, newsletter, CRM, multiadmin, workflow editorial, publicaciones programadas, pagos, comercio ni chat.
- Estados de dominio exactos: proyectos `concept/development/production/completed/archived` más `published`; posts `draft/published/archived`; mensajes `new/read/replied/archived`; builds `queued/building/success/failed`.
- Ninguna cifra ilustrativa del maestro se publicará como logro real. Seed de demostración solo en desarrollo/pruebas, identificado y separado del seed de producción.
- Cada fase exige revisión de diff, documentación y comprobaciones aplicables antes de avanzar.

## 4. Conflictos, vacíos y decisiones propuestas

Estas resoluciones completan la especificación y forman parte del plan que debe aprobarse. No cambian C2.

| ID  | Requisito afectado / causa                                                                           | Alternativa propuesta                                                                                                                                                              | Impacto y verificación                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Últimas versiones: TypeScript 7 queda fuera del peer de `@astrojs/check`                             | Fijar TS 6.0.3 hasta soporte declarado y validado de TS 7                                                                                                                          | Conserva TypeScript estricto; F1 demuestra instalación sin conflictos.                                                                                                                                                                    |
| D02 | Rutas `/...` del maestro frente al hosting de repositorio                                            | Base inicial inferida `https://alarenas1988.github.io/portfolio-alonso/`; helpers únicos de URL y `trailingSlash: always`                                                          | `/admin` lógico será `/portfolio-alonso/admin/`. Todas las rutas/assets/callbacks de Auth deben respetar la base. [Astro Pages](https://docs.astro.build/en/guides/deploy/github/).                                                       |
| D03 | Robots efectivo: un repositorio Pages en subruta no controla `/robots.txt` del host                  | Generar robots y meta robots; admin siempre `noindex,nofollow`. Para robots efectivo en raíz, usar dominio propio en este mismo repo o configuración autorizada del host           | Registrar limitación si se mantiene subruta; no declarar resuelto robots del host con un archivo en `/portfolio-alonso/`. [Ubicación requerida](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt).                |
| D04 | Contenido Sobre mí/cómo trabajo, antes-después, canonical y robots no tienen todos sus campos en §13 | Extensiones mínimas explícitas del esquema, descritas en §7.2 de este plan                                                                                                         | Migraciones aditivas, tipos y CMS correspondientes; no campos sueltos hardcodeados.                                                                                                                                                       |
| D05 | Lectura pública de hijos podría revelar proyectos/posts privados                                     | RLS de cada hijo/join comprueba visibilidad propia y del padre; vistas/RPC respetan esa frontera                                                                                   | Pruebas directas por UUID de borradores, relaciones y galerías.                                                                                                                                                                           |
| D06 | “CMS privado” alojado estáticamente                                                                  | HTML administrativo sin datos privados; autorización real en RLS y Edge; guard de cliente para UX                                                                                  | La ruta y su código pueden descargarse públicamente. Eso no concede acceso a datos.                                                                                                                                                       |
| D07 | Autosave y publicación; C2 tiene demora                                                              | Guardar persiste en Supabase; publicar guarda, valida y solicita rebuild. Mostrar “Guardado” y estado de publicación por separado                                                  | Otro build puede recoger cualquier contenido marcado público ya guardado; V1 no incluye versiones editoriales aisladas. Aviso explícito en el CMS.                                                                                        |
| D08 | Cancelación de Actions puede impedir callback final; `site_builds` no tiene estado cancelled         | Usar `failed` con razón `cancelled/superseded/timeout`, callbacks idempotentes y reconciliación                                                                                    | Nunca dejar un build indefinidamente “building”; `success` significa despliegue comprobado. [Concurrencia](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).            |
| D09 | Metadatos de RLS no protegen bytes de bucket público                                                 | Borradores en bucket `private`; traslado deliberado a bucket público al hacer público el asset                                                                                     | URLs de buckets públicos son públicas aun sin SELECT sobre metadatos. [Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals).                                                                                           |
| D10 | Reemplazar/borrar assets remotos puede romper la última publicación correcta                         | Objetos con nombre inmutable; copiar imágenes y CV usados al artefacto estático; borrar referencias de DB con control de uso                                                       | Build fallido conserva HTML y archivos anteriores. Retirar datos sensibles ya publicados requiere despliegue efectivo y gestionar copias externas.                                                                                        |
| D11 | `/blog` pide “Más leídos” pero analytics es privado                                                  | Guardar únicamente ranking derivado público en posts; el agregador privado lo actualiza, sin exponer eventos, sesiones ni RPC de analytics                                         | Ranking sin tráfico no se presenta como medición; se usa un estado vacío.                                                                                                                                                                 |
| D12 | Agregados definidos no cubren origen, dispositivo, todos los clics y rangos largos                   | Ampliar agregados privados por dimensiones y conservar sesiones mínimas para únicos por rango                                                                                      | Evita sumar únicos diarios como si fueran usuarios únicos mensuales; detalles en F10.                                                                                                                                                     |
| D13 | Claves nuevas de Supabase no son JWT; el runtime actual expone diccionarios de claves                | Priorizar `@supabase/server`, `withSupabase()` / `createSupabaseContext()` y modos `user/publishable/secret/none`. JWT de usuario en Authorization; API keys únicamente en apikey. | Usar autenticación del SDK; ninguna implementación manual equivalente si el SDK resuelve el caso. La autorización owner y validación del webhook siguen siendo obligatorias. [Auth SDK](https://supabase.com/docs/guides/functions/auth). |
| D14 | Cuenta GitHub inspeccionada solo puede leer                                                          | Configurar cuenta/credencial con acceso al repo antes del despliegue y PAT acotado para dispatch                                                                                   | Bloquea publicación remota, no planificación ni desarrollo local. No cambiar dueño, remoto o repositorio para eludirlo.                                                                                                                   |
| D15 | “Subtle” y acentos del diseño no garantizan AA en todas las combinaciones                            | Mantener tokens; reservar combinaciones insuficientes para decoración y elegir tokens de texto con contraste comprobado                                                            | No usar gris sutil para texto pequeño ni texto blanco sobre gradiente sin medir cada punto.                                                                                                                                               |
| D16 | Sitio estático no ofrece protección de ruta por servidor, 301 configurables ni headers arbitrarios   | Páginas físicas, 404 real, advertencia de cambio de slug y política CSP compatible mediante meta cuando corresponda                                                                | No prometer redirects HTTP o headers que Pages no permite configurar; Auth/RLS siguen siendo la protección.                                                                                                                               |

### 4.1 Dependencias externas y datos que se necesitarán

No bloquean la aprobación del plan. Antes de su fase correspondiente se deben disponer mediante configuración segura:

- **F1/F5:** runtime Node seleccionado, CLI Supabase fijada y Docker operativo para reconstrucción local. Proyecto Supabase, región y PostgreSQL disponibles para integración remota; accesos fuera del código.
- **F6:** identidad de la única cuenta owner, correo de recuperación y URLs de redirección autorizadas. Desactivar alta pública; alta y vinculación inicial documentadas sin contraseña en seed.
- **F3/F4/F8/F14:** biografía, trayectoria, contacto real, enlaces, CV, imágenes con permiso de publicación, textos de proyectos y métricas verificables. Faltantes se muestran como estados vacíos en desarrollo; el contenido final se valida antes del lanzamiento.
- **F9/F11:** cuenta con permisos GitHub, Pages habilitado mediante Actions, fine-grained PAT restringido a este repositorio, secretos callback/hash y origen permitido. El proveedor de email es opcional; guardar mensajes es obligatorio.
- **F12:** confirmar URL final. Sin dominio propio se usa la base inferida y se informa la limitación de robots de raíz.
- **F14:** Safari real requiere dispositivo Apple o acceso a un entorno adecuado; WebKit automatizado es evidencia parcial, no equivalente a probar Safari real.

## 5. Orden y dependencias

| Orden | Fase de la solicitud | Depende de                         | Entregable que desbloquea                               |
| ----- | -------------------- | ---------------------------------- | ------------------------------------------------------- |
| 1     | F1 Bootstrap         | Aprobación de este plan            | Proyecto verificable, rutas/base y configuración.       |
| 2     | F2 Design System     | F1                                 | Tokens y componentes compartidos.                       |
| 3     | F5 Base de datos     | F1; resoluciones D04/D12           | Esquema, seed, tipos y contratos de contenido.          |
| 4     | F6 Seguridad/RLS     | F5; se diseña y migra junto a ella | Acceso seguro desde build y CMS.                        |
| 5     | F8 Storage           | F2, F5, F6                         | Contrato de assets, biblioteca base y CV.               |
| 6     | F3 Frontend público  | F2, F5, F6, F8                     | Home y navegación con datos Supabase.                   |
| 7     | F4 Páginas internas  | F3                                 | Casos, blog, perfil y contacto prerenderizados.         |
| 8     | F9 Edge Functions    | F5, F6; contratos de F8            | APIs privadas/públicas verificadas localmente.          |
| 9     | F10 Analítica        | F9; eventos de F3/F4               | Tracking, agregados y consultas del dashboard.          |
| 10    | F7 CMS               | F2, F5, F6, F8, F9, F10            | CMS integrado, persistencia, panel y acciones.          |
| 11    | F11 Publicación C2   | F4, F7, F9; permisos externos      | Recorrido real guardar → publicar → Pages.              |
| 12    | F12 SEO              | F4; URL verificada en F11          | Metadata y feeds auditados en producción.               |
| 13    | F13 Performance/AA   | F2–F12 aplicables                  | Evidencia de calidad y correcciones de cierre.          |
| 14    | F14 QA final         | Todas                              | Release candidata, documentación y validación completa. |

F5 y F6 son dos unidades revisables pero una frontera de seguridad: no desplegar migraciones de F5 a un entorno expuesto sin F6. Desde F5 todas las tablas nacen con RLS activo y denegación por defecto. F8 entrega servicios/componentes que F7 incorpora al CMS. F9 prueba dispatch y callbacks con dobles de GitHub antes de F11; la validación remota de C2 permanece expresamente en F11.

## 6. Estructura prevista y límites de responsabilidad

Se conservará la estructura del maestro, con esta separación adicional de servicios y pruebas:

```text
.github/workflows/{quality,deploy,reconcile-builds}.yml
public/{favicon.svg,fonts/}
src/components/public/       # Navbar, MobileNavigation, Hero, ProjectCard,
                             # ProjectMetric, TechnologyBadge, ExperienceTimeline,
                             # BlogCard, ContactCard, Footer, CaseStudySection
src/components/shared/       # Button, GlassCard, SectionHeader, Icon, FormField
src/components/admin/        # AdminSidebar, AdminHeader, StatCard, DataTable,
                             # MarkdownEditor, MediaPicker, Toast, Modal, Skeleton
src/layouts/{PublicLayout,AdminLayout}.astro
src/pages/index.astro
src/pages/proyectos/{index,[slug]}.astro
src/pages/blog/{index,[slug]}.astro
src/pages/{sobre-mi,contacto,404}.astro
src/pages/{rss.xml,robots.txt}.ts
src/pages/admin/index.astro
src/pages/admin/{login,reset-password}.astro
src/pages/admin/projects/{index,new,edit}.astro
src/pages/admin/blog/{index,new,edit}.astro
src/pages/admin/{experience,technologies,impact,media,contact,messages,
                 analytics,seo,settings}/index.astro
src/lib/config/{public,build}.ts
src/lib/supabase/{browser,build,queries}.ts
src/lib/content/{snapshot,projects,posts,profile}.ts
src/lib/auth/{session,owner,redirects}.ts
src/lib/markdown/{render,sanitize,code,toc}.ts
src/lib/media/{repository,upload,usage,build-assets}.ts
src/lib/analytics/{client,events,queries}.ts
src/lib/admin/{autosave,errors}/
src/lib/admin/{projects,posts,experience,technologies,impact,settings}/
src/lib/seo/{metadata,schema}.ts
src/lib/utils/{urls,slugs,dates}.ts
src/scripts/{navigation,motion,contact,code-copy}.ts
src/styles/{tokens,global,motion,admin}.css
src/types/{database,content,events,builds}.ts
supabase/config.toml
supabase/migrations/         # esquema, RLS, storage, RPC, analítica, mantenimiento
supabase/seed.sql
supabase/functions/_shared/{env,auth,cors,validation,rate-limit,github}.ts
supabase/functions/{publish-site,track-event,contact-submit,build-status}/index.ts
supabase/tests/{schema,rls,storage,analytics,builds}.test.sql
tests/{unit,integration,e2e,fixtures}/
scripts/{check-static-output,check-secrets}.mjs
docs/{ARCHITECTURE,DEPLOYMENT,SECURITY,CONTENT,QA,DECISIONS,PHASE_LOG}.md
.env.example
.env.edge.example
astro.config.mjs / tsconfig.json / package.json / package-lock.json
eslint.config.mjs / .prettierrc.json / .gitignore / .nvmrc
```

No se crearán archivos vacíos por cumplir un árbol. Cada archivo aparece cuando su fase lo necesita. Una página conecta datos y componentes; las consultas, autorización, validación, Markdown y publicación quedan fuera de la presentación. Los módulos de GitHub viven del lado Edge/CI, nunca en el bundle administrativo.

### 6.1 Contratos que guían las fases

- **Contenido de build:** `loadPublicSnapshot(): Promise<PublicSnapshot>`; `PublicSnapshot` contiene ajustes públicos, contacto visible, redes, proyectos con hijos, posts con taxonomías, experiencias, especialidades, principios, métricas y referencias públicas de media. Tipos de DB generados; DTO de presentación derivado y validado, sin `any`. Una RPC de lectura `public.get_public_snapshot()` con ejecución bajo RLS obtiene una vista consistente por build; no incluye tablas privadas.
- **URL:** `withBase(path: string): string` y `absoluteUrl(path: string): string`; normalizan barra final, base y canonical sin duplicar `/portfolio-alonso`. Solo protocolos aprobados; redirects de Auth restringidos a rutas propias.
- **Markdown:** `renderMarkdown(source: string): Promise<RenderedMarkdown>`; salida HTML sanitizado, TOC tipado y tiempo de lectura. Preview y build comparten reglas; no ejecutar MDX, scripts ni componentes de usuario.
- **Owner:** helper `requireOwner()` en cliente para UX; la decisión autorizante sigue siendo `private.is_portfolio_admin()` y la validación JWT/owner en Edge. Nunca confiar en email, metadata de signup, localStorage o un booleano de la UI.
- **Guardado:** servicios por recurso reciben un DTO validado y la revisión/`updated_at` esperada, devuelven fila y revisión persistidas; los conflictos no sobrescriben silenciosamente otra pestaña. Una actualización de proyecto y sus relaciones se realiza con RPC transaccional autorizada.
- **Errores Edge:** respuestas tipadas `{ error: { code, message }, request_id }`, sin stack, secretos ni payload personal en logs. HTTP 400 validación, 401 identidad, 403 autorización, 413 tamaño, 429 límite, 5xx fallo externo.
- **Publicación:** `publish-site` recibe `request_id` UUID, `trigger_type`, `entity_type/entity_id` opcionales validados, y devuelve `build_id/status`. Repetir `request_id` no crea otro dispatch. Configuración de owner/repo viene de secrets, nunca del cliente.
- **Tracking:** `track-event` recibe UUID aleatorio de sesión, `event_id`, evento permitido, pathname y metadatos limitados; HMAC se calcula únicamente en servidor. `contact_submit` se registra al persistir el mensaje para evitar dobles conversiones.
- **Estado:** `build-status` acepta callbacks autenticados con `build_id`, `run_id`, `run_attempt`, estado, SHA, tiempos e identificador de despliegue cuando exista. Duplicados y transiciones fuera de orden no degradan un resultado final válido.

## 7. Modelo de datos y ampliaciones controladas

### 7.1 Cobertura obligatoria del modelo maestro

Implementar **todos los campos de §13**, no solo los visibles en la primera pantalla. Este catálogo identifica las tablas por dominio; el maestro mantiene la definición funcional de sus columnas.

| Dominio          | Tablas                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Identidad        | `auth.users` administrada por Supabase; `admin_profiles`                                                          |
| Configuración    | `site_settings`, `social_links`, `contact_settings`                                                               |
| Casos de estudio | `projects`, `project_features`, `project_images`, `project_metrics`, `project_challenges`, `project_technologies` |
| Tecnologías      | `technologies`                                                                                                    |
| Blog             | `posts`, `post_categories`, `post_category_relations`, `tags`, `post_tags`                                        |
| Trayectoria      | `experiences`, `experience_highlights`, `experience_projects`, `experience_technologies`                          |
| Perfil / impacto | `specialties`, `work_principles`, `impact_metrics`                                                                |
| Archivos         | `media_assets`, `documents`                                                                                       |
| Comunicación     | `contact_messages`                                                                                                |
| Analítica        | `analytics_events`, `analytics_daily`, `analytics_daily_content`                                                  |
| Operación        | `admin_activity`, `site_builds`                                                                                   |

UUID como identidad salvo claves naturales de agregados y joins. Claves compuestas en relaciones, unicidad de slugs por recurso, FK e índices de FK, publicación/fecha/orden y eventos/fecha. `timestamptz` para instantes, `date` para fechas editoriales y períodos, `value` textual para métricas. Constraints de estados, slugs ASCII, rangos temporales, tamaño de entradas, positivos/no negativos donde corresponda. `updated_at` mediante triggers; acciones administrativas mediante auditoría sin cuerpos de mensajes, contraseñas ni tokens.

### 7.2 Ampliaciones mínimas propuestas

1. **Perfil y SEO global:** agregar a `site_settings` `about_summary_markdown`, `about_profile_markdown`, `working_method_markdown`, `about_image_asset_id`, `canonical_base`, `robots_policy` y `timezone` (inicial `America/Santiago`). Especialidades y principios conservan sus tablas y se editan en Configuración, sin agregar módulos V1 innecesarios. Settings/contact son singletons con restricción de única fila.
2. **Contacto:** agregar `email_visible`, `whatsapp_visible`, `whatsapp_cta_label`; `social_links.visible` controla GitHub/LinkedIn. Mantener disponibilidad y textos existentes. Asociar CV activo por `documents`; `site_settings.cv_url` se mantiene sincronizado, no como segunda fuente independiente.
3. **Casos y posts:** agregar `canonical_url` y `robots_policy` opcionales a ambos; `before_markdown/after_markdown` y `sort_order` a proyectos; `popular_rank` nullable a posts, actualizado por agregación. Los campos narrativos de proyectos contienen Markdown aunque conserven los nombres del maestro. `projects.challenges` sirve de resumen; `project_challenges` contiene casos detallados, evitando renderizado duplicado.
4. **Media:** referencias FK de assets en portadas/OG/perfil/galería/documentos además de los campos URL del maestro, que se derivan/sincronizan. `media_assets.visibility` distingue privado/público. `media_references` registra usos editoriales y enlaces de Markdown para impedir borrar assets utilizados; único `(asset_id, entity_type, entity_id, field)`. Ningún `created_by` se filtra en el DTO público.
5. **Operación:** `site_builds.request_id`, `github_run_attempt`, `failure_reason`, `deployment_id`, `content_snapshot_hash`, `retry_of` y `updated_at`; unicidad por solicitud y por run/intento. `contact_messages.submission_id` único y `notification_status` para reintentos sin duplicación. `analytics_events.event_id` único.
6. **Agregados:** completar contadores de todos los eventos; agregar tablas privadas `analytics_daily_dimensions` y `analytics_daily_sessions` para página/origen/dispositivo/navegador y únicos por rango. No exponerlas a anon.
7. **Protección operativa:** `private.rate_limit_buckets` con contadores atómicos y expiración. RPC limitada a Edge, sin Redis ni servicio adicional. Hashes para abuso separados de las sesiones de analytics, sin IP completa persistida.

Cada ampliación tendrá migración, constraint, grants/RLS, tipo, interfaz de edición si aplica y caso de aceptación. No introducir un CMS genérico JSON ni un motor de permisos adicional.

## 8. Fases de implementación

Las verificaciones de cada fase se suman a la puerta de calidad común de §9. Los comandos de aplicación aquí descritos son futuros: aún no existe `package.json`.

### Fase 1 — Bootstrap del proyecto

**Depende de:** aprobación del plan y runtime disponible. **Maestro:** §§3–5, 34–36.

**Entregable:** proyecto Astro mínimo reproducible, tipado estricto, límites cliente/build y herramientas de calidad.

**Archivos:** `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json`, `.nvmrc`, `.gitignore`, `.env.example`, `.env.edge.example`, `eslint.config.mjs`, `.prettierrc.json`, `src/lib/config/{public,build}.ts`, `src/lib/supabase/{browser,build}.ts`, `src/lib/utils/urls.ts`, layouts base, `src/pages/index.astro`, `README.md`, `docs/ARCHITECTURE.md`, `docs/PHASE_LOG.md`, copia del maestro en raíz.

- [x] Preservar README e historial; copiar el maestro íntegro y verificar su hash. Fijar Node/npm, paquetes compatibles y lockfile. Resolver PATH para la sesión/documentar Laragon, sin dependencia de PHP o Apache.
- [x] Configurar Astro estático, plugin Tailwind Vite, TypeScript estricto y separación de configuración pública/privada. Inicializar clientes Supabase sin secretos privilegiados en `src/`.
- [x] Crear `.env.local` ignorado por Git y `.env.example` sin valores reales con `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Sin credenciales aportadas, dejarlas vacías y comprobar el estado sin configuración; no inventar una conexión real.
- [x] Crear helpers de base URL y rutas; usar `site`/`base` derivados de configuración validada. Preparar `404.astro` y salida por directorios.
- [x] Configurar lint de Astro/TS, formato y runner de pruebas significativas. Agregar scripts `dev`, `build`, `preview`, `typecheck`, `lint`, `format:check`, `test`, `test:e2e` y comprobación de artefactos al incorporarlos.
- [x] Documentar instalación Windows/CI, variables y alcance C2. La página de bootstrap identifica que el contenido todavía no está conectado; no lleva métricas ficticias.

**Verificaciones:** instalación limpia con `npm ci` una vez generado el lockfile; `npm ls`; `npm run typecheck`, `npm run lint`, `npm run format:check`, pruebas del helper URL con base `/` y `/portfolio-alonso/`, `npm run build`, inspección de `dist` y preview. Comprobar que los paquetes no requieren forzar peers.

**Aceptación:** instalación reproducible; HTML estático válido; assets resueltos bajo subruta; ningún secreto privado en bundle; versión real del runtime documentada. La conexión de contenido queda identificada para F5/F6, no simulada como terminada.

**Riesgos:** PATH de Node, diferencias Windows/Linux, nueva versión mayor de Astro y herramientas TS. El build mínimo debe demostrar compatibilidad antes de desarrollar componentes.

**Commits sugeridos:** `chore: bootstrap astro portfolio`; `chore: configure quality checks and environment`; `docs: document portfolio architecture`.

### Fase 2 — Design System

**Depende de:** F1. **Maestro:** §§2, 19–26, 32.

**Entregable:** identidad visual implementable y componentes compartidos accesibles, sin diseño alternativo.

**Archivos:** `src/styles/{tokens,global,motion,admin}.css`, `src/components/shared/{Button,GlassCard,SectionHeader,Icon,FormField}.astro`, componentes base de badge/input, `public/favicon.svg`, fuentes locales, `src/scripts/motion.ts`, `docs/DECISIONS.md`.

- [x] Implementar tokens exactos del maestro y asignarlos a Tailwind con variables CSS; nombres semánticos consistentes.
- [x] Crear isotipo AL geométrico en SVG legible a 16/32px; Lucide como base, logos tecnológicos de fuentes oficiales con permisos. No usar generación raster para reemplazar este sistema vectorial.
- [x] Cargar Manrope Variable, Space Grotesk Variable y JetBrains Mono con WOFF2 optimizado, `font-display` y fallback ajustado; limitar pesos y preload.
- [x] Construir botones Primary/Secondary glass/Ghost, cards, inputs, badges y estados hover/focus/disabled/loading/error. Separar tokens de estilos del admin.
- [x] Implementar motion con CSS/WAAPI/IntersectionObserver, degradación sin JS, `@supports` para blur y reduced motion. Solo activar tilt/spotlight en puntero fino con `requestAnimationFrame`.
- [x] Revisar composiciones Home/editorial/admin a 360, 768 y 1440px; los componentes se prueban en fixtures de desarrollo, sin publicar una galería interna del sistema.

**Tokens que no se pueden reinterpretar:**

| Grupo            | Valores del maestro                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Midnight         | 950 `#050816`; 900 `#080C1A`; 850 `#0B1020`; 800 `#10172A`                                                                                   |
| Glass / bordes   | Blanco alpha `.035/.055/.085`; bordes `.10/.18`                                                                                              |
| Texto            | `#F8FAFC`, `#CBD5E1`, `#94A3B8`, `#64748B` con uso sujeto a contraste                                                                        |
| Acentos          | Cyan `#22D3EE`; Blue `#3B82F6`; Violet `#8B5CF6`; Magenta `#D946EF`                                                                          |
| Gradiente        | 135deg; cyan 0%, blue 42%, violet 72%, magenta 100%; uso selectivo                                                                           |
| Tipo             | Hero `clamp(3.4rem,7vw,7.2rem)`; H1 `clamp(2.8rem,5vw,5.5rem)`; H2 `clamp(2rem,3.6vw,3.8rem)`; H3 `clamp(1.4rem,2vw,2rem)`; blog 18px / 1.75 |
| Espaciado        | 4/8/12/16/24/32/48/64/80/96/128/160px; secciones desktop 120–160, tablet 96, mobile 72px                                                     |
| Anchos / padding | General 1440px; normal 1280px; editorial 720–780px; padding lateral 48/32/20px                                                               |
| Radios           | 12/18/24/32/40px; pill 9999px                                                                                                                |
| Glass conceptual | Blanco `.05`; borde blanco `.10`; blur 24px; sombra `0 24px 80px rgba(0,0,0,.25)`                                                            |
| Glow             | Blur 80–160px; opacidad `.10–.24`; ambiental                                                                                                 |
| Motion           | 150/250/400/600ms; `cubic-bezier(0.22,1,0.36,1)`; tilt X ±2°, Y ±3°                                                                          |
| Breakpoints      | 0–639, 640–767, 768–1023, 1024–1279, 1280–1535, 1536+                                                                                        |

**Verificaciones:** controles por teclado, foco visible, targets ≥44px, contraste sobre superficies compuestas y gradientes; zoom 200/400%; reduced motion; fallback sin blur; inspección de tipografía sin CLS apreciable; capturas por breakpoint. Comparación visual con §§19–26, no con una plantilla externa.

**Aceptación:** paleta y tipografías exactas; fondo CSS Midnight con glows/grid/noise discretos; glass jerárquico, no generalizado; contenido legible desde la primera pintura; ningún efecto depende obligatoriamente de mouse.

**Riesgos:** contraste de acentos y gris sutil, coste GPU de blur, desbordamiento del Hero. Ajustar composición y uso de tokens, no inventar una paleta nueva.

**Commits sugeridos:** `feat: implement portfolio design tokens`; `feat: add accessible shared components`.

### Fase 3 — Frontend público

**Depende de:** F2, F5, F6, F8. **Maestro:** §§6, 10–11, 21.

**Entregable:** Home completo con datos reales de Supabase y navegación pública responsive.

**Archivos:** `src/pages/index.astro`, `src/layouts/PublicLayout.astro`, `src/components/public/{Navbar,MobileNavigation,Hero,ProjectCard,TechnologyBadge,ExperienceTimeline,BlogCard,ContactCard,Footer}.astro`, componentes de Sobre mí/especialidades/impacto, `src/lib/content/{snapshot,profile}.ts`, `src/scripts/{navigation,motion,contact}.ts`.

- [ ] Integrar snapshot público en build; validar datos y errores. Una consulta fallida detiene el build de producción, no produce una Home vacía que sustituya el sitio correcto.
- [ ] Construir navbar transparente que pasa a floating glass compacta con transición 300–400ms; overlay móvil con redes, Escape, retorno de foco y bloqueo de scroll reversible.
- [ ] Construir Hero con AL, nombre, propuesta “Tecnología aplicada a problemas reales”, claim, CTA proyectos/contacto, terminal conceptual y nodos. Secuencia aproximada 0/100/200/300/450/600/700ms y duración visual 900–1200ms, sin retrasar lectura o interacción.
- [ ] Componer, en orden, destacados (3–6 cuando exista contenido suficiente), Sobre mí, especialidades, stack por categorías sin porcentajes, experiencia relacionada, impacto, Blog/Insights, contacto y footer.
- [ ] Habilitar enlaces WhatsApp/email/redes/CV desde settings; copiar email con feedback accesible. Home sin formulario. Footer con stack discreto; si muestra hora, usar `America/Santiago`, no UTC-4 fijo todo el año.
- [ ] Añadir contratos de tracking a acciones; activación del transporte en F10. Empty states honestos cuando Supabase no tenga datos, sin publicar ejemplos de logros.

**Verificaciones:** orden de secciones, enlaces/base, solo contenido visible/publicado, teclado del menú, CTA móvil, layouts 320–1920px, títulos largos, cero overflow global. Desactivar JS: contenido y enlaces básicos siguen funcionando; menú tiene una alternativa usable.

**Aceptación:** Home no monolítica y completamente alimentada por Supabase; ningún SDK de CMS en el bundle público; identidad consistente; imágenes con dimensiones y alt; no cifras hardcodeadas.

**Riesgos:** falta de contenido, imágenes grandes y exceso de animación en Hero. No aprobar contenido ficticio como sustituto de material personal.

**Commits sugeridos:** `feat: add public navigation and hero`; `feat: add public home experience`.

### Fase 4 — Páginas internas

**Depende de:** F3 y contratos públicos de F5/F6/F8. **Maestro:** §§5, 7–10, 27–29.

**Entregable:** listados, casos de estudio, artículos, perfil y contacto con HTML indexable por ruta.

**Archivos:** rutas públicas del árbol, `src/lib/content/{projects,posts}.ts`, `src/lib/markdown/{render,sanitize,code,toc}.ts`, componentes de caso de estudio/galería/artículo, `src/scripts/code-copy.ts`, pruebas de rutas y Markdown.

- [ ] Generar `/proyectos/` y `/proyectos/[slug]/` mediante rutas estáticas del snapshot. En listado: filtros simples de tecnología/categoría cuando los datos lo permitan, con todos los casos accesibles sin JS; estado vacío definido.
- [ ] Implementar las 13 secciones del caso: Hero; resumen; problema; objetivo; solución; arquitectura/flujo; funcionalidades; tecnologías; galería; resultados; desafíos/aprendizajes; enlaces; siguiente proyecto. Cada bloque es opcional; agregar antes/después opcional. Mostrar estado/año/rol cuando estén presentes.
- [ ] Crear `/blog/`: editorial, destacado, categorías, últimas publicaciones, artículos técnicos y ranking de más leídos derivado; categorías iniciales completas y administrables.
- [ ] Crear `/blog/[slug]/`: categoría/título/bajada/fecha/lectura/portada, Markdown sanitizado, TOC, recursos, tags, compartir y relacionados. Código con lenguaje, copiar, filename y líneas opcionales; escapes seguros.
- [ ] Crear `/sobre-mi/` con perfil/cómo trabajo/experiencia/especialidades/stack/principios/CTA/contacto; `/contacto/` con canales y formulario condicionado por settings.
- [ ] Aplicar slugs lowercase ASCII únicos/editables; colisiones rechazadas por DB. Filtrar posts futuros aunque V1 no ofrezca programación. No generar rutas de borradores, archivados ni relaciones privadas.
- [ ] Incorporar metadata básica desde el inicio; conectar formulario real en F9 y feeds/auditoría final en F12.

**Verificaciones:** caso mínimo, caso completo y campos vacíos; HTML físico `dist/proyectos/slug/index.html` y `dist/blog/slug/index.html`; refresco directo bajo base real; 404; JS desactivado; Markdown con XSS, `javascript:`/HTML peligroso, headings repetidos y código con caracteres especiales; galería por teclado.

**Aceptación:** proyectos presentados como casos y artículos indexables; enlaces, TOC, compartir y copiar funcionales; no fuga de drafts al HTML, feeds o assets; filtros no impiden lectura sin JS. La entrega final de contacto depende de F9 y queda registrada hasta entonces.

**Riesgos:** sanitización inconsistente entre preview/build, slugs publicados cambiados sin redirección HTTP, truncamiento de consultas por límites API. El snapshot debe cubrir todos los registros públicos sin depender del máximo por defecto de la API.

**Commits sugeridos:** `feat: add project case studies`; `feat: add blog and markdown rendering`; `feat: add profile and contact pages`.

### Fase 5 — Supabase / PostgreSQL

**Depende de:** F1; decisiones D04/D11/D12. Se ejecuta antes de F3. **Maestro:** §§13, 28–29, 35–36.

**Entregable:** esquema reproducible completo, seed mínimo, tipos generados y repositorios de datos sin duplicación.

**Archivos:** `supabase/config.toml`, `supabase/migrations/<timestamp>_schema.sql`, migraciones aditivas de settings/media/operación, `supabase/seed.sql`, `supabase/tests/schema.test.sql`, `src/types/{database,content}.ts`, `src/lib/supabase/queries.ts`, `src/lib/content/snapshot.ts`, `docs/CONTENT.md`.

- [ ] Fijar CLI y levantar Supabase local con Docker; registrar PostgreSQL/extensiones y comandos reproducibles. Evitar usar datos productivos para pruebas destructivas.
- [ ] Crear todas las tablas de §7.1, columnas del maestro y ampliaciones aprobadas de §7.2. RLS activo y sin concesiones públicas al nacer; preparar F6 conjuntamente.
- [ ] Agregar PK/FK, índices de lectura/join, restricciones de publicación/slug/fechas/orden, singleton settings/contact, CV activo único y owner activo único. Usar cascade solo en dependientes editoriales; proteger identidades/media y evitar borrar auditoría por cascada.
- [ ] Implementar triggers de actualización y transacciones para guardar contenido con relaciones. Mantener `published` separado del estado de desarrollo de proyecto; `archived` no es público aunque un checkbox antiguo permanezca activo.
- [ ] Seed productivo idempotente: marca y textos base autorizados, categorías, especialidades y cuatro principios; sin usuarios Auth, contraseñas, estadísticas, trayectorias ni proyectos inventados. Fixtures de pruebas aisladas con casos publicados/privados y relaciones.
- [ ] Generar tipos desde el esquema, crear DTO y snapshot validado. Preferir RPC de lectura consistente y consultas centralizadas; un error de esquema/lectura aborta el build.

**Verificaciones:** `supabase db reset` solo local, repetir reconstrucción; `supabase db lint`; `supabase test db`; comprobar relaciones huérfanas, unicidad, estados inválidos, fechas, orden y tipos regenerados sin drift. Build con seed público en entorno de integración.

**Aceptación:** toda la DB de aplicación se reconstruye desde migraciones/seed; campos CMS necesarios representados; ninguna tabla expuesta nace escribible; cero SQL manual no documentado.

**Riesgos:** CLI/Docker no disponibles, divergencia con PostgreSQL remoto, ambigüedades del modelo. Detener aplicación remota hasta tener las políticas de F6 y haberlas probado.

**Commits sugeridos:** `feat: add portfolio content schema`; `feat: add operational schema and seed`; `feat: add typed public content snapshot`.

### Fase 6 — Auth, seguridad y RLS

**Depende de:** F5. **Maestro:** §§12.2, 14–15, 31.

**Entregable:** frontera de autorización comprobada en DB, Auth y Storage.

**Archivos:** migraciones `..._rls.sql`, `..._storage_policies.sql`, `supabase/tests/{rls,storage}.test.sql`, `src/lib/auth/{session,owner,redirects}.ts`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`.

- [ ] Implementar `private.is_portfolio_admin()` que verifica `auth.uid()` contra perfil activo owner. Si es SECURITY DEFINER: `search_path` fijo/vacío, referencias de esquema completas, rol de función controlado y EXECUTE mínimo. Evitar recursión al consultar `admin_profiles`.
- [ ] Separar grants de policies: lectura pública solo a filas visibles/publicadas; INSERT/UPDATE/DELETE de contenido únicamente owner, con `USING` y `WITH CHECK`. Acceso directo a RPC y vistas también sujeto a pruebas.
- [ ] Aplicar regla del padre a features, imágenes, métricas, desafíos y joins; visibilidad a tecnologías/categorías y experiencias relacionadas. Public snapshot de lista explícita de campos, con invocación bajo RLS.
- [ ] Tablas de mensajes, analytics y builds: sin lectura anon; owner consulta; escrituras de eventos/builds solo Edge/servicios autorizados. Mensajes permiten al owner cambiar estados; auditoría solo se inserta por servicios/triggers y no se edita desde CMS.
- [ ] `admin_profiles`: owner lee lo necesario y actualiza solo nombre/avatar si se ofrece; no puede registrar owners desde cliente. No admitir autoalta de perfiles ni escalar role/active vía `user_metadata`. Esquema `private` fuera de la API expuesta.
- [ ] Configurar login email/password, sin registro público, recovery en página física `/admin/reset-password/`, URLs exactas de localhost/base/producción. Bootstrap documentado: crear usuario Auth mediante canal administrativo y vincular UUID por procedimiento seguro de una sola vez.
- [ ] Storage: comprobar bucket, ruta y owner para carga/reemplazo/borrado; lectura privada solo owner; reglas SQL prueban list, insert, update, delete y upsert.

**Verificaciones:** pgTAP/SQL y llamadas REST con anon, authenticated sin perfil, perfil inactivo y owner activo. Probar enumeración directa por UUID, modificación de FK, creación de owner, `WITH CHECK`, relaciones de drafts, funciones SECURITY DEFINER y acceso a buckets. Recovery y sesión expirada no conceden acceso accidental.

**Aceptación:** `authenticated != administrator` demostrado por pruebas negativas; RLS en todas las tablas expuestas; anon no inserta mensajes ni analytics; owner de contenido no controla privilegios ni falsifica builds. Cero secretos en artefactos y logs revisados.

**Riesgos:** grants amplios por defecto, vistas que omiten RLS, recursión en políticas y confianza en guard de UI. No habilitar CMS real sin pasar esta matriz.

**Commits sugeridos:** `feat: configure portfolio owner auth and rls`; `test: verify authorization boundaries`.

### Fase 7 — CMS `/admin`

**Depende de:** F2, F5, F6, F8, F9 y F10. Se integra después de servicios/seguridad. **Maestro:** §12 completo, §§28–29.

**Entregable:** CMS funcional para una cuenta owner; páginas físicas y módulos TS por responsabilidad.

**Archivos:** todas las rutas `src/pages/admin/` definidas en §6, `AdminLayout.astro`, componentes admin, servicios por recurso, `src/lib/admin/autosave/`, pruebas E2E de Auth/CRUD/editores.

- [ ] **7A Acceso y shell:** login, recovery, sesión expirada, cierre de sesión, estado sin autorización. Sidebar Overview/Content/Media/Communication/System, header, tablas, filtros, formularios, skeletons, toasts, modales y errores. HTML inicial sin consultas ni contenido privado.
- [ ] **7B Proyectos:** listado con todos/publicados/borradores/destacados/archivados; new/edit por UUID; tabs General/Contenido/Funcionalidades/Tecnologías/Galería/Impacto/SEO. Casos opcionales, orden de hijos, enlaces, visibilidad y previsualización local autorizada.
- [ ] **7C Blog:** CRUD, categorías, tags y editor Markdown Editar/Split/Preview; toolbar H1/H2/Bold/Link/Image/Code/Quote; preview sanitizado; slug editable y advertencia si ya fue publicado. Categorías/tags se gestionan dentro de Blog.
- [ ] **7D Trayectoria y perfil:** CRUD de cargo/organización/fechas/descripción/hitos/proyectos/tecnologías/visibilidad/orden; tecnologías completas; métricas globales textuales; especialidades y principios en Configuración; edición de todos los textos de perfil.
- [ ] **7E Media y comunicación:** integrar biblioteca de F8, selector de media y CV; settings email/WhatsApp/mensaje/redes/CTA/disponibilidad/formulario/visibilidad; mensajes new/read/replied/archived con lectura y cambios de estado, sin CRM ni envío de respuestas automático.
- [ ] **7F Analítica y sistema:** dashboard con visitas 30d, contactos, proyectos publicados, artículo/proyecto más consultados, origen, dispositivo, última publicación/build/estado y accesos rápidos. Analítica con 7/30/90d/12meses/personalizado; SEO global y por recurso; reconstruir, publicar y reintentar mediante F9.
- [ ] Implementar autosave con debounce, cola por entidad y estado Guardando/Guardado/Error/Conflicto. Guardar relaciones en transacción; detectar cambios de otra pestaña; reintento explícito y protección de navegación con cambios sin persistir. Autosave no dispara un build por tecla.
- [ ] Archivar como acción principal reversible; borrado definitivo secundario con confirmación y reporte de referencias. Errores inline asociados al campo; no perder el texto del editor ante red fallida.

**Verificaciones:** E2E de acceso directo/refresh a cada ruta; new → autosave → reload → editar relaciones → publicar → archivar; recovery/logout/session expiry; draft inaccesible con anon; HTML fuente sin datos; teclado del editor/modal/sidebar; vista mobile; errores de red, conflicto entre pestañas y reintento.

**Aceptación:** todos los módulos enumerados funcionan con Supabase real de prueba, no solo UI; toda propiedad administrable tiene lugar de edición; tablas paginadas; persistencia demostrada; indicadores sin datos muestran estado vacío. Las llamadas C2 se prueban con doble hasta F11 y su aceptación remota se cierra allí.

**Riesgos:** editor demasiado grande, pérdida de cambios, XSS de preview y falsa equivalencia Guardado/Publicado. Dividir módulos por caso de uso; contenido privado nunca se serializa durante build.

**Commits sugeridos:** `feat: add admin auth and shell`; `feat: add project cms`; `feat: add markdown blog cms`; `feat: add profile and communication management`; `feat: add analytics and publishing dashboard`.

### Fase 8 — Supabase Storage y multimedia

**Depende de:** F2, F5 y F6. Se ejecuta antes de las páginas consumidoras. **Maestro:** §§12.11, 13.18–19, 15, 24–25.

**Entregable:** gestión segura de assets, biblioteca reutilizable y pipeline de assets estáticos/CV.

**Archivos:** migraciones de buckets/referencias, `src/lib/media/{repository,upload,usage,build-assets}.ts`, `src/components/admin/MediaPicker.astro`, componentes de biblioteca, `supabase/tests/storage.test.sql`, pruebas integración de media.

- [ ] Crear buckets `portfolio-public` (projects/technologies/profile), `blog` (posts), `documents` (cv), `private` (temporary). Publicar bytes solo cuando el owner decida hacerlos públicos; preview privado mediante URL firmada corta, nunca incorporada al build.
- [ ] Validar tamaño, MIME y extensión en cliente y restricciones del bucket; propuesta V1: imágenes JPEG/PNG/WebP/AVIF ≤10 MiB y CV PDF ≤10 MiB. SVG de marca/tecnologías revisados como assets de código; no aceptar SVG/HTML arbitrario subido al bucket público.
- [ ] Guardar metadata, dimensiones, categoría, alt obligatorio para imágenes informativas, caption y autor. Validar bytes procesables durante el pipeline; no confiar solo en nombre o Content-Type. Asset decorativo requiere marca explícita y alt vacío autorizado.
- [ ] Implementar grid/filtros/búsqueda/upload/progreso/reemplazo/eliminación/copiar URL/edición alt-caption/consulta de uso; compensar fallos parciales entre Storage y PostgreSQL y ofrecer limpieza de huérfanos con revisión.
- [ ] Reemplazar mediante nueva ruta UUID, actualizar referencias transaccionalmente y conservar anterior hasta completar operación. Bloquear eliminación si existe uso activo; bajas de archivos son explícitas, nunca efecto implícito de cascade SQL.
- [ ] Descargar solo assets públicos referenciados desde buckets/orígenes permitidos durante build; optimizar imágenes con Astro/sharp, generar tamaños/formatos y mapear HTML al asset local. Incluir el PDF activo para descarga same-origin. Límites de descarga/timeout/redirecciones impiden fetch arbitrario.

**Verificaciones:** anon/noowner/owner con cada operación; MIME/tamaño prohibidos, alt vacío no justificado, fallo de upload o metadata, reemplazo y restauración, eliminación en uso, private URL denegada; build fallido tras reemplazo no rompe imágenes/CV del artefacto publicado anterior.

**Aceptación:** owner administra todos los assets y CV; ningún archivo privado aparece en `dist`; dimensiones y alt disponibles; última publicación contiene sus propios assets y PDF. RLS de metadatos no se confunde con privacidad del bucket.

**Riesgos:** objetos huérfanos, assets usados desde Markdown y límites de artefactos/ancho de banda. Mantener registro de referencias y medir tamaño del build; no descargar toda la biblioteca.

**Commits sugeridos:** `feat: add secure storage and media services`; `feat: add media library and cv pipeline`.

### Fase 9 — Edge Functions

**Depende de:** F5/F6 y contratos de publicación/contacto/analytics. **Maestro:** §§10.4, 16–18, 35.

**Entregable:** cuatro endpoints con autenticación diferenciada, validación, límites e idempotencia.

**Archivos:** `supabase/functions/_shared/`, las cuatro carpetas de funciones, `supabase/config.toml`, pruebas Deno/integración, migraciones de rate limit/idempotencia, `docs/SECURITY.md`.

| Función          | Autenticación / responsabilidad                                                                                                               | Resultado                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `publish-site`   | Validar JWT con Auth y comprobar owner activo; validar recurso y solicitud; crear queued y llamar dispatch `portfolio_publish` con `build_id` | `202` con build; error GitHub deja `failed` recuperable                   |
| `track-event`    | Endpoint público; allowlist, tamaño, ruta y UUID válidos; no confundir publishable key con identidad                                          | HMAC y evento persistido o rechazo controlado; sin escritura anon directa |
| `contact-submit` | Endpoint público; honeypot, duración mínima, validación/sanitización/límites e idempotencia                                                   | Mensaje persistido; correo opcional; fallo de correo conserva mensaje     |
| `build-status`   | Callback privado con secreto/firma; sin dependencia de JWT de usuario                                                                         | Estado y run/intento/deployment actualizados de manera idempotente        |

- [ ] Implementar helpers de entorno, CORS por orígenes exactos localhost/producción, OPTIONS, JSON y errores. CORS limita navegadores, no sustituye autenticación ni controles de abuso.
- [ ] Priorizar `@supabase/server`: `withSupabase()` o `createSupabaseContext()` según integración. `publish-site` usa modo `user` y verifica owner; tracking/contacto usan `publishable` sin equiparar clave con identidad; callback usa `none` más su firma obligatoria; comunicaciones de servicio con API key privada usan `secret` cuando corresponda. `Authorization: Bearer <user JWT>` expresa identidad; `apikey: <publishable/secret key>` expresa API key. Nunca tratar `sb_publishable_*` ni `sb_secret_*` como JWT ni recrear la autenticación resuelta por el SDK. [Auth Edge](https://supabase.com/docs/guides/functions/auth).
- [ ] Payload propuesto: tracking ≤4 KiB, publish/callback ≤8 KiB, contacto ≤16 KiB; nombre 2–120, email ≤254, asunto 3–200, mensaje 20–5000 caracteres, tiempo mínimo 3s. Validar límites en servidor, sin logging de cuerpos.
- [ ] Rate limiting atómico PostgreSQL: tracking 60/min por sesión y límite adicional por hash efímero de origen; contacto 5/15min por origen y techo global configurable; publish una solicitud activa equivalente y cooldown 30s. HMAC separado para abuso con rotación diaria y TTL ≤24h; no guardar IP ni UA completo. Límites son parámetros privados versionados/documentados.
- [ ] Contacto guarda antes de notificar; submission UUID evita duplicados. Email a destinatario fijo configurado, remitente verificado y Reply-To validado; escapar contenido en plantilla y bloquear inyección de headers. Sin proveedor: CMS conserva recepción y lo indica.
- [ ] Callback con HMAC de timestamp + cuerpo mediante `BUILD_CALLBACK_SECRET`, ventana 5min, comparación constante y correlación run/build/intento. Reintentos legítimos no duplican ni permiten replay que cambie un estado final. GitHub PAT solo Edge, repo/owner fijos.
- [ ] Integrar formulario de `/contacto/` con estados enviando/éxito/error/reintento; alternativas WhatsApp/email permanecen si JS o Edge fallan.

**Verificaciones:** pruebas por función con requests válidos, malformados, gigantes, origen no permitido, JWT vencido, authenticated noowner, owner inactivo, callback adulterado/expirado/repetido, dispatch denegado, límite concurrente y caída de email. Deno check/lint/test más integración con Supabase local.

**Aceptación:** cada escritura privilegiada está protegida; no API genérica para ejecutar SQL/dispatch arbitrario; 204 de GitHub significa aceptado, no sitio publicado; fallos son visibles y recuperables; mensajes persisten aunque falle email.

**Riesgos:** claves nuevas y gateway, abuso distribuido, contadores no atómicos y retry de notificación. No agregar servicios externos de rate limiting por defecto; Turnstile solo si la evidencia de abuso lo justifica.

**Commits sugeridos:** `feat: add secure publishing edge functions`; `feat: add contact and analytics ingestion`.

### Fase 10 — Analítica propia

**Depende de:** F9, eventos de F3/F4 y tablas de F5. **Maestro:** §§12.3/12.14, 13.21–22, 17.

**Entregable:** métricas anónimas, agregaciones diarias y consultas privadas útiles para el CMS.

**Archivos:** `src/lib/analytics/{client,events,queries}.ts`, `src/types/events.ts`, migraciones `..._analytics_aggregation.sql` y mantenimiento, `supabase/tests/analytics.test.sql`, pruebas unitarias/tracking, `docs/SECURITY.md`.

- [ ] UUID aleatorio en `sessionStorage`; fallback en memoria si almacenamiento está bloqueado. Sin fingerprint ni identificador personal persistente. Edge calcula `HMAC-SHA-256(session, ANALYTICS_HASH_SECRET)` y guarda solo hash; expiración y rotación documentadas.
- [ ] Instrumentar `page_view`, `project_view`, `post_view`, `whatsapp_click`, `email_click`, `email_copy`, `github_click`, `linkedin_click`, `demo_click`, `cv_download`, `contact_submit`, `article_share`. No duplicar conversiones con evento de cliente y servidor; deduplicar por `event_id`.
- [ ] Normalizar pathname sin query/hash, guardar solo dominio de referrer y familias amplias dispositivo/browser. Rechazar paths administrativos y UUID de contenido no publicado; no enviar texto de formulario, email, nombre, IP ni UA completo.
- [ ] Tracking no bloquea navegación; presupuesto de reintento pequeño sin cola persistente infinita. Respetar señales de exclusión DNT/GPC cuando estén disponibles. Reportar como medición aproximada susceptible a bloqueadores/bots.
- [ ] Agregación SQL idempotente por fecha, contenido y dimensiones, bajo rol de servicio; `pg_cron` de Supabase horario con recomputación de día actual/anterior. Día de informe en `America/Santiago`; almacenamiento de instantes en UTC y pruebas de cambio horario.
- [ ] Retención propuesta: eventos detallados 90 días; agregados y sets diarios de hashes 400 días; hashes de abuso ≤24h. `analytics_daily_sessions` contiene fecha/session_hash sin navegación personal y permite `COUNT(DISTINCT)` por intervalo; nunca sumar únicos diarios para obtener únicos del rango.
- [ ] Extender contadores para todos los clics y shares. Dashboard separa contactos de conversiones por canal; `contact_submit` representa formulario persistido; CV download mide activación del enlace, no lectura garantizada del archivo.
- [ ] Consultas de rango 7/30/90d/12 meses/personalizado sobre agregados: visitas, visitantes aproximados, vistas, contactos, CV; series, top pages/proyectos/posts, origen/dispositivo/conversiones. Actualizar ranking público de posts con IDs públicos y posición, sin acceso público a analytics.

**Verificaciones:** vector conocido de HMAC, ninguna IP/payload sensible persistido; eventos duplicados; mismo visitante en varios días; rango sin tráfico; límites inclusivo/exclusivo de fechas; agregación repetida sin duplicar totales; retención; anon denegado en todos los agregados; bloqueo de analytics no afecta sitio.

**Aceptación:** los 12 eventos están cubiertos; KPIs explicables y consistentes con fixtures; privacidad según maestro; cron y reconstrucción de agregados documentados; se puede medir antes de conectar las pantallas F7.

**Riesgos:** discrepancias de únicos, pérdidas por bloqueadores, bots y rendimiento de datos. No prometer identificación de personas ni exactitud publicitaria.

**Commits sugeridos:** `feat: implement anonymous analytics pipeline`; `feat: add daily analytics aggregates and queries`.

### Fase 11 — Publicación C2 con GitHub Actions / Pages

**Depende de:** F4/F7/F9, credencial autorizada y proyecto Supabase configurado. **Maestro:** §§3.3, 12.4, 16.1/16.4, 18.

**Entregable:** flujo real `/admin → Supabase → publish-site → repository_dispatch → Actions → Astro → Pages`, con estado y recuperación.

**Archivos:** `.github/workflows/{quality,deploy,reconcile-builds}.yml`, ajustes de `build-status` y cliente admin, `scripts/{check-static-output,check-secrets}.mjs`, `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`.

- [ ] Verificar permisos de cuenta/repo, habilitar Pages desde Actions y environment `github-pages`; configurar variables/secrets por ámbito. Fine-grained PAT solo este repo con Contents:write para dispatch; Actions:read para reconciliar. [Permiso de dispatch](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event).
- [ ] `quality.yml` en PR/push: instalación reproducible, formato/lint/typecheck, pruebas esenciales, build con Supabase local y fixtures aisladas cuando no haya credenciales productivas. PR no recibe secretos de producción ni publica.
- [ ] `deploy.yml`: triggers `push` a `main`, `repository_dispatch` tipo `portfolio_publish` y `workflow_dispatch`. Workflow debe existir en la rama predeterminada. No ejecutar instrucciones arbitrarias del `client_payload`.
- [ ] BUILD: checkout, Node fijado, `npm ci`, typecheck/lint/tests, snapshot Supabase público, `astro build`, validación de HTML/assets y secretos, artifact Pages. Snapshot/error de DB o asset obligatorio fallido aborta; no usar contenido viejo de caché como fallback silencioso.
- [ ] DEPLOY separado, solo con BUILD correcto: permisos mínimos `contents:read`, `pages:write`, `id-token:write`, environment `github-pages`, acciones oficiales fijadas a versiones/SHA revisados. La credencial privilegiada Supabase y PAT no entran en el proceso Astro.
- [ ] Callback de inicio crea/vincula `site_builds` también para push/manual; usar run/intento como identidad idempotente y `build_id` para dispatch. Publicar `success` solo tras confirmación de `deploy-pages`, incluyendo URL, SHA y deployment; fallo de build/deploy mantiene el sitio anterior.
- [ ] Concurrencia `portfolio-production`, cancelar ejecución anterior cuando llega otra; registrar cancelación/sustitución como failed con razón. Reintentar desde admin crea nueva solicitud vinculada a la anterior, no sobrescribe historial.
- [ ] Reconciliación independiente: workflow `workflow_run` al completarse deploy, barrido cada 15 minutos y ejecución manual consulta runs/jobs/deployment para recuperar callbacks perdidos y queued cancelados antes de iniciar. GitHub programa estos trabajos con disponibilidad variable; el plazo es un objetivo operativo, no un SLA. `build-status` acepta reconciliación solo autenticada por servicio. No inferir “deploy exitoso” únicamente del resultado global si falló el callback posterior.
- [ ] Dashboard diferencia DB conectada, última publicación correcta, build actual y fallo de comunicación. Comprobar el sitio real y la URL de deployment; no mostrar Online únicamente porque existe un registro success antiguo.

**Verificaciones:** los tres triggers reales; guardar cambios desde CMS y comprobar HTML publicado con JS desactivado; dispatch fallido, Supabase inaccesible, error de build, fallo deploy, callback perdido y dos publicaciones seguidas. Comparar hash de HTML/imágenes/CV anterior tras build fallido. Comprobar retries, run links y resolución de todos los queued/building finalizados en el siguiente ciclo de reconciliación (objetivo ≤15min).

**Aceptación:** recorrido completo auditado, última publicación preservada y reintento operativo; ningún PAT/secret en dist ni logs; los datos guardados sobreviven a fallos; estado refleja despliegue, no solo compilación. Bloqueo de credenciales no se declara como prueba remota superada.

**Riesgos:** permiso READ actual, Pages no confirmado, límites/cola de Actions, cancelación antes de callbacks, assets remotos borrados. Mitigación por ámbitos de secretos, reconciliación y artefacto autocontenido.

**Commits sugeridos:** `ci: add portfolio quality workflow`; `feat: add github pages publishing workflow`; `fix: reconcile interrupted site publications`.

### Fase 12 — SEO

**Depende de:** F4 y URL final verificada en F11. **Maestro:** §§12.15, 27–28.

**Entregable:** SEO por página y contenido, sitemap/RSS/robots y datos estructurados coherentes con el hosting.

**Archivos:** `src/lib/seo/{metadata,schema}.ts`, layouts públicos/admin, `src/pages/{rss.xml,robots.txt}.ts`, integración sitemap, iconos/OG, pruebas de HTML/feeds, `docs/DEPLOYMENT.md`.

- [ ] Título/descripción por ruta con overrides de proyectos/posts; canonical absoluto y opcional por contenido; OG/Twitter Cards con imágenes públicas y URL completa; `lang=es` y metadatos de fechas.
- [ ] Schema.org Person, WebSite, BreadcrumbList y BlogPosting/CreativeWork según contenido; serialización segura de JSON-LD y datos verificables sin inventar credenciales/logros.
- [ ] Sitemap solo de páginas públicas indexables; RSS de posts publicados no futuros, con HTML sanitizado/URLs absolutas. No incluir admin, previews, fixtures, borradores ni 404.
- [ ] Configuración robots global y por recurso validada; `noindex,nofollow` en todas las páginas administrativas. No bloquear por robots una URL si se necesita que el robot lea su noindex.
- [ ] Resolver D03: con dominio propio servir robots en raíz; con subruta documentar limitación y usar metadatos efectivos por página. No configurar DNS/dominio que el usuario no haya indicado.
- [ ] Revisar cambios de slug con advertencia y consecuencias; sin motor de redirects HTTP ficticio. Canonical base del CMS debe coincidir con deployment o bloquear publicación por configuración incoherente.

**Verificaciones:** parsear HTML/JSON-LD/XML, canonical sin doble base/query, URLs OG/RSS/sitemap accesibles, títulos/description únicos, `noindex` en admin desde fuente, ausencia de drafts en feeds. Verificar robots desde raíz del host, no solo desde la carpeta publicada.

**Aceptación:** metadata visible en HTML sin JS; casos/artículos indexables; sitemap y RSS correctos; robots efectivo o limitación registrada sin falsear cumplimiento. Si se exige robots de host como condición de lanzamiento, resolver dominio/control de raíz antes de aprobar release.

**Riesgos:** canonical incorrecta por subruta, indexación del shell admin, OG privada y ausencia de robots efectivo. Todos quedan cubiertos por prueba del artefacto y URL desplegada.

**Commit sugerido:** `feat: complete portfolio seo and feeds`.

### Fase 13 — Performance y accesibilidad

**Depende de:** componentes y flujos completos; requisitos aplicados desde F2. **Maestro:** §§20, 23–25, 31–32.

**Entregable:** auditoría y ajustes con evidencia de rendimiento y accesibilidad.

**Archivos:** componentes/estilos/scripts afectados por hallazgos, configuración Playwright/axe/Lighthouse, `docs/QA.md`; sin refactors ajenos a resultados medidos.

- [ ] Medir Home, listado, caso, artículo largo, contacto y admin en desktop/mobile con condiciones de red/CPU registradas. LCP <2,5s, CLS <0,1 e INP <200ms; registrar métricas y fecha, no solo un score.
- [ ] Priorizar imagen LCP, lazy load fuera del primer viewport, tamaños explícitos, srcset/AVIF/WebP, fuentes limitadas, HTML estable y ausencia de SDK admin en público. Propuesta de presupuesto: JS inicial público ≤50 KiB gzip, CSS inicial ≤40 KiB gzip, imagen Hero móvil ≤250 KiB; cualquier excepción debe justificar medición y seguir cumpliendo objetivos.
- [ ] Perfilar blur/glow/spotlight y scroll; animar transform/opacity sin thrashing, suspender trabajo fuera de pantalla, quitar interacción decorativa en touch/reduced motion y evitar animaciones infinitas.
- [ ] Auditar landmarks, jerarquía headings, skip link, nombres accesibles, etiquetas/errores asociados, alt, contrastes 4.5:1 para texto normal y 3:1 donde corresponda, foco/teclado/diálogos y targets ≥44px.
- [ ] Probar zoom/reflow, orientación, texto largo y tamaño de fuente del usuario; reduced motion, alto contraste/forced colors y ausencia de JavaScript. Lectura manual con NVDA; VoiceOver si hay dispositivo.
- [ ] Corregir por impacto y repetir solo páginas/controles afectados, más regresión común. Diferenciar medición de interacción de laboratorio de INP de campo en p75: este último requiere tráfico real, no se deduce de Lighthouse.

**Verificaciones:** Lighthouse reproducible y axe automatizado, inspección de red/bundles, perfiles de interacción, recorridos de teclado y lector de pantalla. Guardar reportes/capturas resumidos sin datos personales.

**Aceptación:** sin incidencias críticas/serias automatizadas y sin bloqueos manuales; objetivos medidos en laboratorio registrados; campo pendiente de tráfico identificado. No afirmar “WCAG certificada” o “INP real garantizado” con una única prueba.

**Riesgos:** efectos costosos, contraste de tokens en capas, falta de datos de campo. Reducir trabajo visual conservando identidad y contenido.

**Commit sugerido:** `perf: optimize portfolio rendering and accessibility`.

### Fase 14 — QA final y entrega

**Depende de:** F1–F13, contenido real y configuración externa de lanzamiento. **Maestro:** §§31–37.

**Entregable:** release candidata comprobada, checklist de operación y documentación completa.

**Archivos:** `README.md`, `docs/{ARCHITECTURE,DEPLOYMENT,SECURITY,CONTENT,QA,PHASE_LOG}.md`, pruebas E2E y fixes concretos.

- [ ] Ejecutar matriz en Chrome/Edge/Firefox actuales y WebKit automatizado; Safari real si se dispone. Pantallas 320/360/390/640/768/1024/1280/1440/1920px, landscape y zoom. Registrar versiones y pruebas no disponibles.
- [ ] Recorrido público completo y de owner: login/recovery, CRUD relaciones, autosave/conflictos, Markdown/preview, assets/CV, canales/contacto, mensajes, analytics, SEO/settings, publicar/reintentar y refresh en rutas admin.
- [ ] Reconstruir Supabase local desde cero; comprobar migraciones/types/RLS/Storage/Edge y pruebas de usuario no autorizado. Simular fallos de red/servicios y confirmar protección de última publicación.
- [ ] Verificar checkout limpio → `npm ci` → checks → build; inspeccionar enlaces internos/externos, canonicals, sitemap/RSS, 404, assets, secretos y tamaño de artefacto. Confirmar que una edición Supabase aparece tras C2 real.
- [ ] Revisar contenido real con Alonso: mínimo material suficiente para destacados, casos, trayectoria/contacto/CV válidos, derechos de imágenes y métricas verificadas. Un sitio técnicamente correcto con fixtures no es un portfolio listo para lanzar.
- [ ] Completar manual de instalación/env/Supabase/local/build/Pages; arquitectura y límites de seguridad; bootstrap owner; despliegue de migraciones/funciones; rotación de secretos; backup/restauración y reintento de publicación. Separar pasos manuales pendientes de pasos ya comprobados.
- [ ] Revisar `git diff`, historial de commits, checklist del maestro y riesgos residuales. Corregir fallos bloqueantes antes de proponer integración/publicación final.

**Verificaciones:** suite común completa, DB/Edge/E2E y smoke real Pages. Registrar resultado, fecha, navegador, commit y entorno en `docs/QA.md`; no marcar como aprobada una prueba omitida por falta de credenciales/hardware.

**Aceptación:** todos los criterios funcionales/seguridad/UX/visuales del maestro trazados a evidencia; cero bloqueos conocidos; secretos seguros; configuración reproducible; limitaciones de robots/Safari/medición de campo expresas y resueltas o aceptadas según corresponda.

**Riesgos:** confundir validación local con despliegue real, falta de contenido o permisos. Si falta infraestructura, entregar código y documentación verificados e identificar exactamente la validación remota restante, sin declarar todo finalizado.

**Commits sugeridos:** `test: validate portfolio end to end`; `docs: finalize setup deployment and operations`.

## 9. Puerta de calidad por fase y política Git

Una fase solo se cierra cuando se ejecutan sus verificaciones con salida comprobada, se corrigen fallos y se documenta el resultado. Los comandos se fijarán en F1; no se han ejecutado checks de una aplicación inexistente durante esta planificación.

| Ámbito         | Comprobación prevista                                             | Cuándo                                                                |
| -------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Dependencias   | `npm ci`, `npm ls`                                                | F1, CI y cambios de dependencias                                      |
| Formato        | `npm run format:check`                                            | Cada fase con archivos nuevos/modificados                             |
| Tipos / lint   | `npm run typecheck`, `npm run lint`                               | Cada fase de aplicación                                               |
| Lógica         | `npm test`                                                        | Cada fase; pruebas significativas del comportamiento afectado         |
| Estático       | `npm run build`, `npm run check:static`, `npm run check:secrets`  | Cada fase con app; últimos dos scripts desde que F1/F11 los incorpore |
| DB             | `supabase db lint`, `supabase test db`                            | Cambios de esquema/RLS/RPC/agregaciones                               |
| Reconstrucción | `supabase db reset`                                               | F5/F6 y QA; exclusivamente instancia local de pruebas                 |
| Edge           | `deno check`, `deno lint`, `deno test` sobre funciones/fixtures   | F9 y cambios posteriores de funciones                                 |
| Navegador      | `npm run test:e2e`, axe y revisión visual/teclado focalizada      | Cambios de UI y flujos; matriz completa en F14                        |
| Git            | `git diff --check`, revisión de `git diff` y `git status --short` | Antes de todo commit                                                  |

Las pruebas automáticas priorizan reglas que pueden fallar: autorización, publicación, persistencia, parsing/sanitización, subrutas, filtros públicos e idempotencia. No crear tests triviales que repliquen clases CSS. Los cambios visuales reversibles se verifican con contraste, navegación y capturas. Regresiones anteriores se incluyen en el conjunto común; no repetir baterías costosas sin cambio o fallo que lo justifique.

`docs/PHASE_LOG.md` registrará por fase: alcance, commits, comandos y resultado, capturas/reportes relevantes, desviaciones justificadas y dependencias externas aún no verificadas. Un servicio simulado se identifica como simulado. Un test no ejecutado se identifica como pendiente, no como aprobado.

Tras la aprobación se trabajará en una rama de implementación, preservando `main`; aislamiento adicional solo si hace falta. Commits pequeños y coherentes por tarea, usando los ejemplos de cada fase. No un commit gigante de toda la aplicación, no force-push, no reescritura del historial inicial. Revisión local completa antes de cada commit y revisión de integración antes de publicar. Esta tarea de planificación no realiza push ni cambios en Supabase/GitHub Pages.

## 10. Variables de entorno y separación de secretos

Los archivos `.env.example` y `.env.edge.example` contendrán nombres, valores ficticios/inofensivos y comentarios; nunca credenciales reales. Los `.env` efectivos y artefactos temporales de pruebas quedan ignorados por Git. No mezclar configuración del build con secretos operativos por comodidad.

| Variable                                             | Ámbito previsto                                 | Tratamiento                                                                                                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`                                | Browser admin / build                           | Pública; validar HTTPS en producción.                                                                                                                                                 |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY`                    | Browser admin / build                           | Pública; RLS sigue siendo obligatorio.                                                                                                                                                |
| `PUBLIC_SITE_URL`                                    | Browser / build / Actions variable              | URL pública completa con base; origen y pathname se derivan una sola vez. Valor inicial propuesto: `https://alarenas1988.github.io/portfolio-alonso/`.                                |
| `SUPABASE_URL`                                       | Edge                                            | Configuración provista por runtime; no secreto por sí misma.                                                                                                                          |
| `SUPABASE_SECRET_KEY`                                | Contrato privado conceptual del maestro         | No se carga en Astro. Helper Edge utiliza el diccionario `SUPABASE_SECRET_KEYS` del runtime actual; fallback singular solo si el entorno lo ofrece explícitamente.                    |
| `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS` | Edge administrado                               | Diccionarios inyectados por plataforma; validar presencia de la clave seleccionada. No copiar diccionarios privados al frontend.                                                      |
| `GITHUB_FINE_GRAINED_TOKEN`                          | Solo secretos Edge                              | Dispatch y consultas de reconciliación del repo autorizado.                                                                                                                           |
| `GITHUB_REPOSITORY_OWNER` / `GITHUB_REPOSITORY_NAME` | Configuración Edge                              | Fijos al repo, no aceptados desde requests; no sensibles por sí mismos.                                                                                                               |
| `ANALYTICS_HASH_SECRET`                              | Solo secretos Edge                              | HMAC de sesiones; rotación invalida continuidad de hashes y debe documentarse.                                                                                                        |
| `RATE_LIMIT_HASH_SECRET`                             | Solo secretos Edge                              | Propuesta adicional para aislar hashes efímeros de abuso.                                                                                                                             |
| `BUILD_CALLBACK_SECRET`                              | Secretos Edge y Actions                         | Firma de callbacks; disponible solo en pasos de callback/reconciliación, no en el proceso Astro.                                                                                      |
| `SUPABASE_BUILD_STATUS_URL`                          | Actions variable                                | Endpoint callback, no credencial.                                                                                                                                                     |
| `EMAIL_PROVIDER_SECRET`                              | Solo secretos Edge, opcional                    | Nunca en DB pública, HTML o UI de settings.                                                                                                                                           |
| `EMAIL_FROM` / `EMAIL_TO`                            | Configuración privada Edge                      | Destinatario fijo y remitente verificado para notificaciones.                                                                                                                         |
| `ALLOWED_ORIGINS`                                    | Configuración Edge                              | Allowlist separada por entorno; la ruta base no forma parte del origin HTTP.                                                                                                          |
| `SUPABASE_ACCESS_TOKEN` / referencia del proyecto    | Herramientas de despliegue Supabase, si se usan | Aprovisionamiento/CLI fuera del frontend y del build público; DB password solo en el gestor de secretos correspondiente.                                                              |
| `GITHUB_TOKEN` de Actions                            | Runner / permisos por job                       | Token efímero de GitHub; no variable pública, no sustituto de la clave de Supabase. Reconciliación usa `actions:read` y acceso de lectura al estado de deployment cuando corresponda. |

El build de producción consulta exclusivamente contenido accesible con publishable key y políticas públicas. No necesita service role. Las funciones privilegiadas usan secretos del backend; las acciones de owner verifican JWT y perfil antes de acceder a privilegios elevados. El aislamiento se verifica además mediante análisis de imports y escaneo de `dist` con secretos canario en pruebas, sin imprimir valores reales.

## 11. Pruebas esenciales por escenario

| Área                 | Casos mínimos de aceptación                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publicación de datos | Proyecto público/privado/archivado; post draft/publicado/futuro; tecnologías ocultas; hijo de padre oculto; relación desde experiencia visible hacia proyecto privado.                                                 |
| Owner                | JWT válido sin perfil, owner inactivo, rol manipulado, intento de autoalta, acceso directo a tablas/RPC/Storage; todo denegado salvo owner activo autorizado.                                                          |
| CMS                  | Crear, autoguardar, recargar, modificar relaciones, conflicto entre pestañas, red caída, archivar, confirmar eliminación; ni pérdida de texto ni publicación falsa.                                                    |
| Markdown             | XSS, protocolos peligrosos, imágenes externas no permitidas, headings duplicados, código con `<script>` literal, filename, copiar, TOC y preview/build equivalentes.                                                   |
| Media                | Upload inválido, objeto privado, referencias en Markdown, fallo metadata/Storage, reemplazo inmutable, borrado en uso, PDF activo, última publicación preservada.                                                      |
| Contacto             | Payload válido, honeypot, envío demasiado rápido, email inválido, gigante, rate limit concurrente, doble envío, proveedor de email caído; mensaje legítimo conserva persistencia.                                      |
| Analytics            | HMAC estable, UUID inválido, evento no permitido, duplicados, red bloqueada, sin storage, cero tráfico, misma sesión en varios días, cambios de fecha/horario y privacidad.                                            |
| C2                   | Push/manual/dispatch; payload con build_id incorrecto, timeout tras posible aceptación de dispatch, callback falsificado/replay, build/deploy fallido, dos runs, cancelación previa al inicio, retry y reconciliación. |
| Rutas / SEO          | Base `/` y base repo, refresh directo de editor con UUID, ruta pública por slug, 404, sitemap/RSS y meta robots en HTML; no datos admin serializados.                                                                  |
| UX                   | 320px, tablet, desktop, landscape, zoom, teclado, lector de pantalla, reduced motion, sin blur, JS desactivado y mensajes de error accesibles.                                                                         |

Un timeout de GitHub después de enviar dispatch es resultado incierto: conservar la solicitud y reconciliar antes de volver a dispararla; un reintento HTTP con el mismo `request_id` devuelve el mismo build. Para callback o reconciliación, validar run/intento/repo y estado real de despliegue, no aceptar campos de URL como prueba de éxito.

## 12. Registro de riesgos y condiciones de cierre

| Riesgo                                                                     | Prioridad             | Mitigación y fase responsable                                                          |
| -------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| Escritura por usuario authenticated noowner o fuga por relaciones          | Crítica               | Denegar por defecto, RLS/grants y matriz adversarial F5/F6.                            |
| Secretos en bundle, preview o callbacks                                    | Crítica               | Aislar módulos/entornos, sanitizar, HMAC y escanear F1/F6/F9/F11.                      |
| Destruir última publicación al fallar build o borrar assets                | Alta                  | Deployment solo de artefacto validado y assets autocontenidos F8/F11.                  |
| GitHub CLI con permiso READ                                                | Alta para despliegue  | Resolver cuenta/permisos antes de F11; no bloquea trabajo local.                       |
| Entorno Supabase/Docker aún no disponible                                  | Alta para integración | Verificar e instalar/configurar en F1/F5; ejecutar primero en local.                   |
| Vacíos entre funcionalidades y campos SQL                                  | Alta                  | Extensiones trazadas D04/§7.2 antes de desarrollar CMS.                                |
| C2 no publica instantáneamente ni aísla revisiones de contenido ya público | Media                 | UI Guardado/Publicado y comunicación clara de snapshot/rebuild F7/F11.                 |
| Builds huérfanos por cancelación/callback perdido                          | Alta                  | Idempotencia, run/intento y reconciliación independiente F9/F11.                       |
| Abuso de formularios/analytics                                             | Alta                  | Límites atómicos, HMAC efímero, payload estricto y honeypot F9/F10.                    |
| Métricas falsas por sumar únicos o por fixtures                            | Alta                  | Distintos por rango y contenido real aprobado F10/F14.                                 |
| Robots en subruta                                                          | Media / condición SEO | Resolver host/dominio o documentar limitación aceptada F12.                            |
| Contraste y coste de efectos                                               | Media                 | Tokens con usos accesibles, presupuestos y profiling F2/F13.                           |
| TS latest incompatible con comprobador                                     | Media                 | Selección TS6 documentada e instalación sin forzar peers F1.                           |
| Safari real / CWV de campo sin entorno o tráfico                           | Media                 | Declarar alcance medido; WebKit y laboratorio como evidencia parcial F13/F14.          |
| Información personal y proyectos aún no suministrados                      | Alta para lanzamiento | Contenido/medios/métricas verificados; nunca rellenar con logros inventados F3/F4/F14. |

## 13. Trazabilidad del maestro a las fases

| Sección del maestro          | Cobertura en el plan                             |
| ---------------------------- | ------------------------------------------------ |
| 1 Objetivo general           | Resumen, restricciones, F3/F4 y aceptación F14   |
| 2 Identidad de marca         | F2/F3, SVG AL y claim                            |
| 3 Arquitectura C2            | Contratos, F1/F5/F6/F9/F11                       |
| 4 Estructura del repositorio | §6, F1                                           |
| 5 Rutas                      | D02/D06, F1/F4/F7                                |
| 6 Home                       | F3, datos F5 y diseño F2                         |
| 7 Casos de estudio           | F4, modelo F5, editor F7                         |
| 8 Blog/Markdown/código       | F4/F7/F12                                        |
| 9 Sobre mí y principios      | §7.2, F3/F4/F5/F7                                |
| 10 Contacto                  | F3/F4/F7/F9/F10                                  |
| 11 Footer                    | F3                                               |
| 12 CMS completo              | F7, biblioteca F8, métricas F10, publicación F11 |
| 13 Modelo de datos           | §7 y F5/F10                                      |
| 14 Seguridad y RLS           | F6/F9 y matriz §11                               |
| 15 Storage                   | F6/F8                                            |
| 16 Edge Functions            | F9/F11                                           |
| 17 Analítica propia          | F10 y variables §10                              |
| 18 GitHub Actions            | F11                                              |
| 19 Design System             | Tokens exactos F2                                |
| 20 Animaciones               | F2/F3/F13                                        |
| 21 Navbar                    | F3                                               |
| 22 Botones                   | F2                                               |
| 23 Responsive                | F2/F3/F4/F7/F13/F14                              |
| 24 Accesibilidad             | F2 y todas las fases UI, cierre F13/F14          |
| 25 Performance               | F1/F2/F8/F13                                     |
| 26 Iconografía               | F2/F5/F7                                         |
| 27 SEO                       | §7.2, F4/F7/F12                                  |
| 28 Slugs                     | F4/F5/F7/F12                                     |
| 29 Borrado y estados         | Restricciones, F5/F7/F8                          |
| 30 Fuera de V1               | Restricciones globales                           |
| 31 Aceptación funcional      | Verificaciones por fase, §11, F14                |
| 32 Aceptación visual         | F2/F3/F13/F14                                    |
| 33 Orden sugerido            | §5, datos y seguridad adelantados                |
| 34 Reglas de implementación  | Restricciones, estructura y puerta de calidad §9 |
| 35 Variables                 | §10 y F1/F9/F11                                  |
| 36 Entregables               | Todas las fases y documentación F14              |
| 37 Resultado esperado        | Resumen y aceptación final F14                   |

## 14. Estado de esta entrega y aprobación

- [x] Maestro leído completamente e identificado por hash.
- [x] Repositorio, archivos existentes, runtime y acceso GitHub inspeccionados sin modificar servicios.
- [x] Versiones consultadas en fuentes oficiales; incompatibilidad de TypeScript documentada.
- [x] Plan con 14 fases, orden, dependencias, entregables, verificaciones, riesgos y aceptación.
- [x] Trazabilidad de las 37 secciones y decisiones que completan vacíos.
- [x] Aprobación de Alonso para iniciar únicamente F1 conforme a este plan y sus precisiones.
- [x] Inicio y cierre de F1 con resultados reales registrados; detenida para revisión antes de F2.
- [x] Aprobación, ejecución y cierre de F2 con tokens, componentes, accesibilidad y revisión visual; detenida antes de F3 y fases posteriores.

La autorización ejecutada comprende **F2 — Design System** sobre el bootstrap aprobado: infraestructura visual, componentes compartidos y validación responsive. Al finalizar F2 se entrega evidencia y se detiene el trabajo para revisión, sin avanzar a F3 ni a fases posteriores.

### Precisiones aprobadas antes de F1

1. Edge Functions priorizan `@supabase/server` y los modos de autenticación del SDK. No se implementan funciones Edge durante F1.
2. Separación estricta entre JWT de usuario en `Authorization` y API keys en `apikey`; claves publicables/secretas no son JWT.
3. `.env.local` existe, está ignorado y contiene las dos variables públicas Supabase; `.env.example` no incluye valores reales. La falta de claves no bloquea un bootstrap local sin conexión.
4. El proyecto remoto tiene **Automatic RLS habilitado**, según información del owner. F5/F6 conservarán declaraciones explícitas de RLS, grants y policies en migraciones: ambas capas se mantienen.
5. El permiso READ de GitHub CLI no bloquea desarrollo local; resolver escritura/configuración es requisito obligatorio antes de F11.
6. F9/F11 se implementan en incrementos verificables: publicación → callback de estado → reintento manual → reconciliación automática/casos extremos. Se preserva la seguridad y todos los requisitos finales.
7. F10A implementa eventos básicos y consultas para un dashboard útil, conectado en F7; F10B completa agregaciones multidimensionales, retención y optimizaciones. F7 puede empezar con F10A; F10 no se cierra hasta completar ambos incrementos.
8. Seguridad, RLS, secretos, accesibilidad, responsive y Design System no se reducen. Trabajar en la rama local `feat/f1-bootstrap` dentro del checkout actual, conforme al plan aprobado; no se necesita un worktree adicional para este bootstrap aislado por rama.
