# Registro de fases

## F4 — Páginas públicas internas — 2026-09-06

**Estado:** implementada y validada; se detiene para revisión del usuario, sin push, PR ni merge automático. Base origin/main `1f4780a1e87a418c0cee9e8ad12df7f7c38dcb50`, sincronizada con main limpio y con F1/F2/F5/F6/F8/F3 y los checkpoints Supabase integrados. F3 ya había sido aprobada y mergeada mediante PR #9. Rama nueva `feat/f4-public-pages`, worktree aislado `.worktrees/f4-public-pages`; no se reutilizaron worktrees anteriores.

Se implementan `/proyectos/`, `/proyectos/[slug]/`, `/blog/`, `/blog/[slug]/`, `/sobre-mi/`, `/contacto/` y 404 coherente. Los detalles son HTML estático mediante getStaticPaths; no se generan drafts, archivados o posts futuros. Navbar, navegación móvil, Footer, tarjetas, timeline y MediaImage se reutilizan con estado activo y enlaces definitivos bajo el base. Se mantienen tokens, tipografía y movimiento F2/F3.

Una lectura pública compartida por build alimenta Home, índices y detalles: snapshot F5/F6 → pipeline de assets F8 → DTO de presentación. El build falla ante error de lectura, contrato incompatible o asset obligatorio ausente. No hay SSR ni cliente privilegiado. Las colecciones vacías son contenido editorial válido y no se rellenan con fixtures.

Markdown compartido y tipado: AST remark/GFM, transformaciones controladas, allowlist rehype-sanitize y HTML estático. Se descarta HTML del autor, se neutralizan enlaces inseguros y se exige `media:UUID` resuelto mediante el mapa F8. Incluye tablas con scroll local, TOC con IDs únicos, lectura determinista, resaltado Shiki con tokens F2, copia accesible y relacionados públicos por categorías/tags/recencia. Los parsers no llegan al navegador público.

El formulario tiene UI, validación cliente, ayudas, errores, contador y adapter desacoplado. **Enviar permanece deshabilitado** y nunca informa entrega exitosa. Con form_enabled=true se puede revisar el texto localmente; con false se deshabilitan los campos. No hay peticiones, inserciones ni mailto sustitutivo. F9 sigue pendiente.

### Verificaciones finales

- npm ci y npm ls --depth=0 correctos; npm audit --audit-level=high: **0 vulnerabilidades**. Dependencias exactas de Markdown/sanitización y Shiki fijadas en lockfile; sin framework UI adicional.
- format:check, lint y typecheck correctos; **120 archivos, 0 errores, warnings o hints**.
- **133/133 pruebas unitarias**, incluidas rutas, visibilidad, mínimos/completos, filtros, orden, canonical, CV, validación de contacto, TOC, lectura, sanitización e imágenes/enlaces dentro de tablas.
- **176 E2E aprobadas, 58 omitidas por dispositivo/matriz, 0 fallos**. Nueve anchos: 320/360/390/640/768/1024/1280/1440/1920. Conserva regresiones de F1/F2/F3/F8 y añade páginas internas, filtros, casos/artículos, teclado, Escape/foco, copy, formulario sin envío, no-JS, reduced motion, refresh, enlaces y 404.
- Axe WCAG A/AA sin violaciones en páginas probadas. La revisión detectó IDs repetidos del SVG compartido: BrandMark ahora asigna un ID por instancia. Un enlace de BlogCard quedaba bajo 44px durante transform a 768px; se ajustó a 48px y se repitió toda la suite, conservando la aserción original.
- **Cinco builds aislados**: completo y vacío correctos; indisponibilidad, contrato incompatible y asset faltante fallan. Una RPC por build; tres assets sintéticos F8; tres casos y cuatro artículos públicos del fixture, sin rutas privadas.
- **16 comprobaciones adicionales del artefacto vacío offline** y **16 del artefacto remoto real**: móvil/desktop, con/sin JS, navegación, accesibilidad, formulario inactivo y 404. Astro dev también sirve snapshot y tres assets F8 bajo el base correcto.
- **Build con snapshot remoto público real correcto**: seis HTML — Home, proyectos, blog, sobre-mi, contacto y 404 — y cero detalles de proyectos/posts. check:static correcto; check:secrets correcto sobre **21 artefactos**.
- Revisión visual de **13 capturas completas con fixtures**: proyectos 390/768/1440; caso, blog, artículo, sobre-mi y contacto 390/1440. También **nueve capturas reales** de índices/perfil/contacto sin contenido inventado. Evidencia local ignorada en `.tools/f4-visual/`. Sin overflow global, imágenes rotas ni recursos remotos en el navegador.
- git diff --check correcto; cambios permanentes separados en commits locales. Las capturas/builds y `.env.local` permanecen ignorados.

### Commits e inventario

- `a95fb1c` — feat: add shared sanitized markdown rendering
- `8a12da8` — feat: add static public project case studies
- `98e733f` — feat: add editorial blog pages and article interactions
- `a60abe7` — feat: add public profile and safe contact form
- `6d637a5` — test: verify public content routes
- Cierre documental: `docs: record phase four validation`.

El inventario completo, dependencias, contratos y comandos están en [PUBLIC_PAGES.md](PUBLIC_PAGES.md). El historial exacto se obtiene con `git log 1f4780a..feat/f4-public-pages --oneline`.

### Decisiones y pendientes

La skill superpowers solicitada no estaba disponible: ejecución secuencial con frontend-design, preservando F2/F3. Los filtros aparecen solo cuando hay varias opciones reales utilizadas. Las secciones de casos y perfil son condicionales; no se inventan arquitectura, experiencia, tecnologías, resultados ni logros. Se corrigieron dos detalles de los componentes compartidos por evidencia de accesibilidad, sin rediseñar Home.

El contenido real muestra identidad/claim/resumen, seis especialidades y cuatro principios. Aún no hay proyectos/posts/experiencias/tecnologías/métricas/media publicados; contacto y CV no están configurados como visibles. El envío real depende de F9. Las auditorías finales SEO/performance siguen pendientes de sus fases: estas verificaciones no certifican LCP/CLS/INP de producción.

**Supabase remoto no fue modificado en F4.** No cambiaron migraciones, tipos de PostgreSQL, RLS, Auth, Storage, buckets, owner ni seed. No se inició F7/F9/F10/F11/F12/F13/F14 ni otra fase. El siguiente paso es la revisión del usuario.

## F3 — Frontend público / Home — 2026-09-06

**Estado:** implementada y validada, pendiente de revisión del usuario. Base origin/main `ac2045a85e9d8d10ffc9675b3dc82c8a300a9ccf`, que contiene F1/F2/F5/F6/F8, baseline 019 y primer despliegue remoto. Main se verificó limpio, se sincronizó sin reescribir historial y permaneció intacto. Trabajo aislado en `feat/f3-public-home` / `.worktrees/f3-public-home`.

Se reemplaza la portada fixture por Home Astro estática con Navbar, Hero, destacados, About, especialidades, stack, experiencia, impacto, preview Blog, contacto y Footer, en ese orden. Veinte componentes públicos separados reutilizan F2 y MediaImage de F8. La portada F2 se conserva exclusivamente como fixture de regresión fuera de src/pages.

`loadPublicSnapshot()` → pipeline F8 → DTO Home → HTML. Configuración pública y publishable key, sin JWT owner ni credenciales privilegiadas. Los builds fallan si falla la RPC, el contrato o un asset obligatorio. El snapshot real muestra identidad/claim/resumen, seis especialidades y cuatro principios; respeta las colecciones vacías y los canales de contacto/CV aún no visibles. No se insertó contenido ficticio.

Navbar compacta con scroll; menú details/summary sin JS y dialog con JS, Escape, ciclo/retorno de foco y scroll lock. Hero con terminal conceptual y nodos SVG, sin WebGL ni typing infinito. Contacto con wa.me seguro, mailto, copia con aria-live, redes y CV condicionales. Hook no-op tipado para futuras interacciones, sin tracking. Metadata básica desde settings; no SEO avanzado.

### Verificaciones

- npm ci y npm ls --depth=0 correctos; npm audit --audit-level=high: **0 vulnerabilidades**, sin dependencias nuevas.
- format:check, lint y typecheck correctos; **0 errores, warnings o hints**, 89 archivos examinados.
- **104/104 pruebas unitarias**, incluidas 17 nuevas de Home; siguen pasando contratos de F1/F2/F5/F6/F8.
- **114 E2E aprobadas, 21 omitidas por dispositivo/matriz, 0 fallos**. Nueve tamaños: 320/360/390/640/768/1024/1280/1440/1920. Se conserva el umbral original de ancho de tarjetas F2, reconfirmado específicamente a 320px.
- Axe WCAG A/AA para Home completa/vacía y menú abierto; targets de 44px, teclado, foco, Escape, touch, reduced motion, no-JS y navegación sin rutas rotas.
- **Cinco escenarios de build aislado**: completo y vacío correctos; lectura 503, contrato incompatible y asset requerido faltante fallan de forma exigida. Tres assets sintéticos, imágenes AVIF/WebP/PNG y PDF mediante F8. La API fixture se apaga antes de las pruebas de navegador.
- **Astro dev** verificado con snapshot anónimo y tres assets sintéticos. El middleware respeta la base incluso cuando Vite la retira antes de resolver la petición. Usa outDir y proceso aislados.
- **Build remoto público real correcto**, dos páginas (Home y 404), seguido de check:static y check:secrets correctos. Nueve archivos en dist; HTML sin URL/key de Supabase ni contenido de fixtures. Asset map vacío acorde al contenido remoto real.
- Capturas completas y de Hero de **360/390/768/1024/1440/1920**, tanto con snapshot real como con fixture completo, inspeccionadas. Se revisaron tarjetas, About/principios, timeline, blog, contacto, footer y menú. Cero overflow o imágenes rotas en las capturas.
- git diff --check correcto. El árbol se deja limpio tras el commit documental, sin PR, push ni merge de F3.

La inspección visual corrigió un espacio perdido en el Hero y la altura del terminal que se superponía a 768px; una prueba geométrica protege ahora esa composición. El menú tiene semántica de botón y un ciclo de foco explícito. La matriz ampliada detectó un file input F8 demasiado ancho a 320px: se limita con width/min-width sin modificar servicios ni backend.

HTML real: 35.901 bytes; tres scripts inline suman 4.141 bytes (1.689 gzip como referencia). CSS: 53.442 bytes (10.362 gzip). Son tamaños del artefacto, no una certificación de LCP/CLS/INP; F13 sigue pendiente.

### Commits

- `15f6037` — feat: map public snapshot to typed home presentation
- `aed053d` — feat: add public navigation and hero
- `1dfc073` — feat: compose public home sections with static media
- `d6de84b` — fix: keep media input within narrow viewports
- `4e99a69` — fix: serve generated home assets during development
- `b028ea0` — test: verify offline responsive public home

El ajuste final conserva el umbral de regresión F2 mediante `test: preserve approved design system width checks`; el cierre documental usa `docs: record phase three public home validation`. El historial completo se obtiene con `git log ac2045a..feat/f3-public-home --oneline`.

### Inventario, decisiones y límites

54 archivos creados/modificados: README.md; astro.config.mjs; eslint.config.mjs; package.json; playwright.config.ts; docs/{ARCHITECTURE,HOME,PHASE_LOG}.md; scripts/{capture-home,home-assets-integration,serve-home-tests,test-home-build,test-home-dev}.mjs; veinte componentes en src/components/public; src/components/shared/{Icon,PageHead}.astro; src/components/admin/MediaPicker.astro (solo ancho); src/layouts/PublicLayout.astro; src/pages/index.astro; src/styles/home.css; src/scripts/{navigation,contact}.ts; src/lib/content/{home,home-build,presentation,interactions,snapshot}.ts; tests/e2e/{bootstrap,design-system,home}.spec.ts; tests/fixtures/{design-system-page,empty-home-page}.astro; tests/fixtures/{home-server,home-snapshot}.ts; tests/unit/home.test.ts.

La skill superpowers solicitada no estaba disponible; desarrollo secuencial con frontend-design y el sistema F2 aprobado. No se añadieron librerías, tipos DB, migraciones ni un pipeline alternativo de imágenes.

**Desviación delimitada:** mientras F4 no exista, navegación principal mediante anclas de Home y About hacia principios. El enlace a /sobre-mi/, los artículos y «Ver todos los insights» se habilitarán con sus rutas F4. Se consultó la preferencia y se adoptaron anclas al no recibir respuesta; el validador estático no se debilitó para tolerar 404. Contacto/CV y colecciones reales pendientes son contenido editorial, no fixtures a sembrar.

**Supabase remoto no fue modificado en F3.** No hubo cambios de esquema/RLS/Auth/owner/buckets/policies ni escrituras de contenido. No se inició F4/F7/F9/F10/F11/F12/F13/F14 ni otra fase. La revisión del usuario es el siguiente paso. [Contrato, comandos y evidencia detallada](HOME.md).

## Checkpoint técnico backend — 2026-09-06, primer despliegue real

**Estado:** checkpoint completado, baseline y owner remoto verificados. Rama/worktree nuevos `chore/supabase-initial-deploy` / `.worktrees/supabase-initial-deploy`, desde origin/main `d3b5d0f671aa783c09d59760a68b466aded5662f`, con F1/F2/F5/F6/F8 y baseline corregido. Main limpio, sincronizado y sin reescritura de historial.

CLI 2.116.0 autenticada y enlazada a portfolio-alonso, sa-east-1, PostgreSQL 17.6. Inspección previa sin drift: cero tablas propias/buckets/objetos/usuarios y sin historial de aplicación; Automatic RLS activo. Respaldo lógico nuevo fuera de Git, ACL restringida y recuperación ensayada. El dump completo encontró permiso denegado en una tabla Storage Vector; se conservó y se generó/restauró la variante con las dos exclusiones oficiales, ambas tablas vacías. Sin cambios de permisos administrados.

Puerta local: reconstrucción vacía, baseline/seed, 613 SQL, 107 Auth/RLS, 66 Storage/media, 9 PK y 87 unitarias correctas; tipos/snapshot, npm ci/ls/audit, formato, lint, typecheck, build, salida estática y secretos correctos. Dry-run solo 019; SQL exacto aprobado. Evidencia previa en `253533e`.

**Push real:** 2026-09-06 15:09:35 UTC, exit code 0, únicamente 019. Historial real con 527 sentencias, sin migraciones archivadas pendientes. Catálogo estructural idéntico a local: 32 public + 3 private con RLS, 4 vistas, 256 constraints, 99 índices, 138 policies; tres definer propias seguras y Automatic RLS preservado. Cuatro buckets reales, MIME/límites correctos, sin policy UPDATE/upsert/move.

Seed separado, versionado y transaccional: 21 filas base autorizadas. 28 comprobaciones anónimas API reales y loadPublicSnapshot correctos, sin fixtures persistentes. Generación de tipos remotos: única diferencia explicada __InternalSupabase.PostgrestVersion 14.5, sin diferencias de schema; database.ts permanece reproducible desde local. Comparación de catálogo usa igualdad estructural, sin confundir orden JSON con drift.

Después del deploy se reconstruyó otra vez localmente desde vacío y se repitieron 613 SQL, 107 Auth/RLS, 66 media y 9 PK, tipos, lint y snapshot. Catálogo igual a remoto; fixtures limpios. Signup remoto deshabilitado, rechazo real HTTP 422/signup_disabled comprobado, email/password conservado. Site URL GitHub Pages y cuatro redirects exactos admin/recovery de producción/localhost guardados.

**Parada respetada y continuación:** `18f4bf9` documentó la espera del alta segura; el usuario confirmó «owner creado». Se verificó una única cuenta Auth confirmada y se ejecutó el bootstrap administrativo transaccional sin identidad hardcodeada. Resultado: private.is_portfolio_admin()=true, un perfil owner activo y contraseña intacta.

**Pruebas remotas completadas:** 139 comprobaciones adicionales, 91 de Auth/RLS/snapshot y 48 de Storage/media, con JWT reales del owner definitivo y fixtures noowner/inactivo. Se demostraron escalación denegada, borradores/hijos/futuros ocultos, lectura privada solo owner, CRUD permitido al owner, snapshot equivalente para cuatro roles, UUID Storage, signed preview, publicación, referencias múltiples/Markdown, bloqueo de delete, reemplazo, desvinculación y reporte de huérfanos. La credencial administrativa no fue usada para las aserciones de permisos.

Limpieza confirmada: solo un Auth user y un perfil owner activo; cero proyectos/posts/tecnologías/mensajes/media/referencias/objetos de testing. Las cuentas temporales fueron eliminadas y se cerró solo la sesión de prueba del owner. Auditoría final: 14 secciones de catálogo idénticas a local, 35 tablas RLS, tres definer propias, Automatic RLS preservado e historial solo 019. [Informe completo](checkpoints/INITIAL_DEPLOY.md), [139 pruebas](checkpoints/initial-deploy/owner-smoke.json), [estado final](checkpoints/initial-deploy/final-state.json).

Bootstrap en `f977ca6`; smoke test y evidencia en `543a0c2`. Formato/lint/typecheck/secretos/diff se verificaron nuevamente sobre scripts y documentación finales; no cambió el baseline ni la aplicación desde la reconstrucción completa posterior al push. [Validación de continuación](checkpoints/initial-deploy/owner-validations.json). Cierre documental: `docs: close controlled Supabase deployment checkpoint`.

Sin PR ni merge automático de esta rama. No se modificaron migraciones ni código de aplicación, ni se inició F3/F4/F7/F9/F10/F11/F12/F13/F14.

## Checkpoint técnico backend — 2026-09-06, instalación inicial atómica

**Estado:** implementación local y revisión previa terminadas; despliegue remoto pendiente de revisión. Rama/worktree nuevos `chore/supabase-initial-baseline` / `.worktrees/supabase-initial-baseline`, desde `origin/main` `c89ed9c0220cfbb088b55138279e4ba14eb54e29`. PR #6 del checkpoint anterior ya integrado; main estaba limpio y sincronizado. No se repite su PR ni merge.

**Causa y decisión:** el primer push de la secuencia histórica creaba temporalmente la FK compuesta de 014 antes de corregirla con 018. La instalación inicial pasa a `20260906001900_initial_portfolio.sql`, generada determinísticamente en una única transacción y restringida a aplicación vacía. Nunca crea esa FK; conserva únicamente la referencia UUID RESTRICT hacia `storage.objects.id`. Las 18 fuentes se archivan sin modificar contenido, con manifiesto de hashes. La 018 sigue disponible para bases F8 existentes; no se reescriben commits.

**Prueba de ambos caminos:** test de arquitectura inicialmente rojo; observador DDL local bloquea incluso una dependencia transitoria no-PK y observa 596 eventos durante 019. Se demuestra rollback completo ante fallo final, rechazo sin cambios sobre aplicación ocupada, actualización F8 con datos reales mediante API y 13 comprobaciones, y equivalencia exacta en 14 secciones de catálogo más equivalencia semántica del seed. La adopción del historial mediante migration repair se ensaya exclusivamente en local después de demostrar equivalencia, conservando contenido y respaldo del registro anterior. Nueve grupos de pruebas correctos; reconstrucción final vacía por 019 y seed.

**Recuperación:** respaldo remoto previo restaurado en el stack aislado `portfolio-alonso-baseline-local`, PostgreSQL 17.6, API 58421 / DB 58422. Se verifican hashes y coincidencia del catálogo con el origen real. Dos adaptaciones locales explícitas: comprobar un permiso de plataforma ya existente en lugar de reotorgarlo sin privilegios, y alinear defaults de secuencias del template local con el origen. Se preservan función y event trigger de Automatic RLS. No se alteran los archivos originales del respaldo ni otros stacks.

**Revisión remota:** CLI autenticada 2.116.0 y link del mismo proyecto portfolio-alonso, sa-east-1. Comparación forward del catálogo remoto con el SQL exacto y su ejecución local sobre el respaldo restaurado: ningún objeto preexistente eliminado, estructura administrada Storage intacta, Automatic RLS idéntico. El timeout histórico del motor de diff directo no se presenta como resuelto. Dry-run remoto lista únicamente 019, sin seed ni roles y con Vault omitido. Auditoría final de solo lectura confirma remoto sin cambios: cero tablas propias y buckets. No hay db push efectivo, cambios Auth ni owner.

**Validación local final:** db lint correcto; **613 pruebas SQL**, **107 comprobaciones Auth/RLS**, **66 Storage/media**, **9 del sondeo PK** y **87 unit tests** correctos. Tipos regenerados sin diferencias; snapshot y seed idempotente correctos. Auditoría: 35 tablas propias con RLS, 138 policies, tres funciones SECURITY DEFINER propias y la función de plataforma Automatic RLS comprobada por separado. Fixtures limpiados: cero usuarios Auth, objetos Storage, metadata y proyectos de testing; historial local únicamente 019.

**Validación del proyecto:** npm ci, npm ls --depth=0 y npm audit --audit-level=high correctos, cero vulnerabilidades; format:check, lint, typecheck, build, check:static, check:secrets y git diff --check correctos. Sin dependencias nuevas, cambios de DTO ni UI; no aplica una nueva suite E2E por este checkpoint.

La [decisión y procedimiento](checkpoints/INITIAL_BASELINE.md) incluye archivo histórico, adopción, recuperación, límites y evidencias reproducibles. Implementación en `88716ef` y pruebas/evidencia en `5432c04`. El respaldo ensayado corresponde al proyecto vacío actual; archivos futuros y configuración Auth requieren respaldo propio. Quedan pendientes aprobación de instalación, auditoría actualizada inmediatamente antes del despliegue y validaciones posteriores con owner. No se hace PR ni merge automático de esta rama; F3/F4/F7/F9/F10/F11 no iniciadas.

## Checkpoint técnico backend — 2026-09-06, CLI autenticada

El usuario completó login con npx.cmd. CLI 2.116.0 verificó y enlazó portfolio-alonso en sa-east-1. Auditoría READ ONLY nueva: PostgreSQL 17.6, Automatic RLS activo, sin tablas propias/buckets/objetos/usuarios Auth ni historial de aplicación. No se modificaron Auth remoto ni owner.

Se obtuvo backup lógico de roles/esquema/datos fuera de Git, con ACL restringida y hashes. Incluye suplemento del event trigger Automatic RLS omitido por el dump estándar; la restauración no está ensayada. El diff explícito hacia migraciones falló por timeout en conexión directa; migra en dirección inversa terminó y se conserva únicamente como evidencia, nunca como SQL para aplicar.

La simulación autorizada `db push --linked --dry-run --skip-vault` listó 18 migraciones sin seed ni actualización Vault. **Parada:** el primer push ejecutaría 014 antes de 018 e introduciría temporalmente la FK no-PK rechazada. Se necesita acordar la estrategia de instalación inicial; no se modifica silenciosamente el historial mergeado. [Evidencia y límites](checkpoints/CLI_REMOTE_PREFLIGHT.md).

Sin despliegue efectivo, PR, merge ni fases posteriores. Esta actualización modifica documentación/evidencia y excluye de Prettier el cache `supabase/.temp/` creado por CLI, ya ignorado por Git. format:check, check:secrets, revisión de tokens en JSON y git diff --check correctos. No se repiten ni se atribuyen a remoto las validaciones funcionales locales ya aprobadas.

## Checkpoint técnico backend — 2026-09-06, corrección local Storage

**Estado:** dependencia no-PK corregida y verificada en local. db push prohibido; remoto sin cambios. Continúa exclusivamente en `chore/supabase-remote-readiness`, desde la base `e8a4750097cbb6a7c85e01ce36cf91c3f38a4185`. No hay PR ni merge de este checkpoint.

**Test primero:** la prueba de arquitectura falló sobre F8 al encontrar una FK a columnas Storage no-PK. La inspección confirmó `objects_pkey(id)`, UUID con default gen_random_uuid(). Antes de crear la corrección, nueve comprobaciones API demostraron upload, copia, nueva identidad al reemplazar/recrear y DELETE protegido conservando fila y bytes. El error del servicio es `ResourceReferenced`.

**Corrección:** migración `20260906001800_storage_object_identity.sql`, sin editar las 17 anteriores. Backfill transaccional de `media_assets.storage_object_id`, NOT NULL, UNIQUE y FK a la PK con RESTRICT; después retira únicamente nuestra FK compuesta. Trigger INVOKER propio de consistencia UUID/localización, sin nuevos SECURITY DEFINER ni permisos Storage UPDATE. Los servicios conservan upload.data.id; la reconciliación y el reporte de huérfanos comprueban UUID. El DTO público permanece sin cambios. No se alteraron columnas, índices ni constraints de Storage.

**Actualización con datos:** ensayo separado sobre F8/17 con objeto real API, metadata legacy y dos referencias editoriales; aplicación local de 018 conservó datos y protección de borrado. 13 comprobaciones correctas. Evidencia en [local-storage-upgrade.json](checkpoints/local-storage-upgrade.json).

**Reconstrucción final:** se verificó ausencia de usuarios/objetos/metadata de testing y se eliminó el stack aislado `portfolio-alonso-readiness-local` con `supabase stop --no-backup`. `db:start` recreó PostgreSQL 17.6, aplicó las **18 migraciones y seed desde cero**. Los stacks de fases anteriores no se modificaron. API 57421, DB 57422; CLI fijada 2.116.0.

**Validación DB/API final:** db lint sin errores; **612 pruebas SQL** en cinco archivos; tipos regenerados y comparación exacta; snapshot real y seed idempotente correctos; **107 comprobaciones Auth/RLS**, **66 Storage/media** y **9 del sondeo PK**. Incluyen referencias múltiples/Markdown, reemplazo, borrado bloqueado y permitido, tres carreras registro/borrado, huérfanos por ausencia/UUID incorrecto, fallos de transporte, validación de archivos y pipeline. Auditoría: 35 tablas propias con RLS, 138 policies y las tres funciones definer originales con search_path vacío. Al terminar: cero usuarios Auth, objetos Storage, media_assets y media_references de testing; cuatro buckets locales y 18 migraciones registradas.

**Eliminación:** usos editoriales bloquean retirar metadata; después de desvincular, el servicio elimina metadata no usada y finalmente bytes vía API. RESTRICT impide el orden inverso. Un fallo final devuelve limpieza pendiente; el reporte no borra automáticamente. La FK no sustituye backups de bytes ni evita cambios privilegiados de plataforma.

**Validación npm:** npm ci (407 paquetes), npm ls --depth=0 y npm audit --audit-level=high correctos, cero vulnerabilidades. format:check y lint correctos; typecheck de 58 archivos con cero errores/advertencias/hints; **84/84 unit tests**, incluyendo archivos y build-assets; build estático de dos páginas; check:static correcto con base /portfolio-alonso/ y check:secrets correcto en ocho artefactos. git diff --check correcto. Sin dependencias nuevas ni cambios de comportamiento UI; no se requiere otra ejecución E2E para esta corrección.

**Autenticación CLI:** comprobada después de validar localmente; CLI 2.116.0 devuelve login requerido. Se detiene antes de link/inspección remota adicional/diff: el usuario debe ejecutar `npx supabase login` y confirmar. No se solicita ni versiona access token. No se ejecutó db push.

La [decisión completa](checkpoints/STORAGE_OBJECT_IDENTITY.md) registra catálogo, evidencia API, evolución de servicios/tipos y límites. El [informe remoto](checkpoints/SUPABASE_REMOTE_READINESS.md) distingue la auditoría histórica del resultado local actual. Auth remoto, owner, Automatic RLS y todos los datos remotos siguen sin modificaciones. F3/F4/F7/F9/F10/F11 no iniciadas.

## Checkpoint técnico backend — 2026-09-06, inspección previa

**Estado:** detenido antes de db push; no es una fase funcional ni una aprobación de backend remoto.

**Base:** origin/main `e8a4750097cbb6a7c85e01ce36cf91c3f38a4185`, merge previo de F8/PR #5. Main limpio, sincronizado con fast-forward y ancestros F1/F2/F5/F6/F8 comprobados. Rama/worktree nuevos: `chore/supabase-remote-readiness`, `.worktrees/supabase-remote-readiness`. No se volvió a hacer commit/PR/merge de F8.

Se ejecutaron consultas de catálogo mediante transacciones READ ONLY en el dashboard del proyecto configurado y dos GET con la clave pública. Proyecto portfolio-alonso, sa-east-1, Free; PostgreSQL 17.6 (imagen 17.6.1.166), Auth 2.196.0, PostgREST 14.5. Cero tablas de aplicación, usuarios Auth, buckets y objetos; historial de migraciones de aplicación ausente. Automatic RLS activo, sin cambios. Signup activo, Site URL localhost:3000 y redirects vacíos. No hay backups restaurables incluidos en el plan.

**Bloqueo:** FK de migración 014 hacia storage.objects(bucket_id,name), respaldada por índice administrado no primario. Se documentó la corrección que debe mantener integridad editorial, bloqueo de DELETE directo y concurrencia. No se modificaron migraciones ni esquema. La CLI fijada 2.116.0 tampoco está autenticada; faltan login, dump restaurable y diff generado. No se intentó sortear estos controles.

Evidencia, revisión estática de las 17 migraciones, SECURITY DEFINER, drift de plataforma y plan de recuperación en [SUPABASE_REMOTE_READINESS.md](checkpoints/SUPABASE_REMOTE_READINESS.md). Los JSON guardan catálogo/configuración, no secretos ni un backup completo. Los scripts SQL nuevos son solo de inspección.

**Validación de esta entrega:** npm ci (407 paquetes), npm ls y npm audit --audit-level=high correctos, cero vulnerabilidades; format:check y lint correctos; typecheck de 58 archivos sin errores/advertencias/hints; npm test 84/84; build de dos páginas; check:static correcto bajo /portfolio-alonso/; check:secrets correcto en ocho artefactos; git diff --check correcto. No hubo cambios UI que requieran E2E en esta entrega. La reconstrucción SQL completa, Auth/Storage/media con fixtures, tipos remotos y drift posterior quedan pendientes de la corrección y del despliegue. No se reutilizan resultados históricos F8 como resultados nuevos.

**Remoto:** no se aplicaron migraciones, seed, cambios Auth, buckets ni fixtures. RPC get_public_snapshot respondió 404/PGRST202 porque aún no existe; no se presenta como test RLS satisfactorio. Owner no creado. Sin PR/merge automático de este checkpoint. F3/F4/F7/F9/F10/F11 no iniciadas.

## Fase 1 — Bootstrap

**Estado:** completada; detenida para revisión antes de F2.

**Rama:** `feat/f1-bootstrap`
**Fecha:** 2026-09-05 (`America/Santiago`)

### Alcance

- Documento maestro incorporado con el mismo SHA-256 del original.
- Precisiones aprobadas registradas en el plan.
- Astro estático, Tailwind Vite, TypeScript estricto y Supabase JS.
- Configuración pública validada; `.env.local` ignorado y sin credenciales inventadas.
- Clientes Supabase de browser/build y separación API key/JWT.
- Rutas con base de GitHub Pages, layout público/admin mínimo y 404.
- Formato, lint, tipos, unit tests, E2E, checks de artefacto y secretos.
- README y arquitectura de instalación/despliegue.

### Decisiones y desviaciones

- Node 24.20.0 no estaba instalado en PATH. Para validar F1 se descargó el binario oficial en `.tools/`, se verificó contra `SHASUMS256.txt` y se ignoró en Git. Se recomienda activar Node 24 mediante Laragon o un version manager.
- Vite se elevó de 8.0.13 a 8.2.2 dentro del rango de Astro/Tailwind, porque 8.0.13 tenía dos advisories en Windows. `npm audit` queda limpio.
- npm 11 bloquea scripts de instalación sin aprobación. Se revisó y aprobó únicamente `esbuild@0.28.2`, fijado en `allowScripts`.
- Supabase JS 2.115.0 separa API keys para Edge Functions, pero aún usa la publishable key como Bearer en Storage/REST cuando no hay sesión. Se añadió un guard de transporte pequeño y probado que elimina solo ese fallback y preserva JWT reales.
- Astro 7 inicia `preview` en background al detectar agentes. Playwright fija `ASTRO_PREVIEW_BACKGROUND=0` para que gestione correctamente su proceso.
- No se creó configuración Supabase local ni se probó conexión remota: corresponde a F5 y no se entregaron credenciales en F1.
- GitHub CLI mantiene permiso READ. Es una dependencia obligatoria para F11, sin impacto en F1 local.

### Integraciones todavía simuladas o pendientes por fase

- El contenido todavía no se consulta desde Supabase.
- `Database` es un tipo placeholder vacío y documentado; F5 lo reemplaza por tipos generados.
- `AdminLayout` es un shell estático sin Auth; F6/F7 implementan identidad, owner y CMS.
- No existen migraciones, policies, buckets, Edge Functions ni workflows. Se conservan sus fases.

### Evidencia

- Node `24.20.0`; npm `11.19.0`.
- `npm ci`: 393 paquetes instalados desde lockfile, 0 vulnerabilidades.
- `npm ls --depth=0`: árbol válido, sin dependencias inválidas.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- `npm run format:check`: correcto.
- `npm run lint`: correcto, sin mensajes.
- `npm run typecheck`: 20 archivos, 0 errores, 0 advertencias, 0 hints.
- `npm test`: 36 pruebas aprobadas.
- `npm run build`: 2 páginas estáticas generadas.
- `npm run check:static`: 2 documentos HTML y base `/portfolio-alonso/` válidos.
- `npm run check:secrets`: 3 artefactos revisados, sin material privado detectado.
- `npm run test:e2e`: 9 pruebas aprobadas en desktop, tablet y mobile.
- Revisión visual manual de capturas desktop/mobile: legible, sin overflow y deliberadamente mínima.
- Hash del maestro versionado: `F38CE3E6A0E3A6AE012D29949D5170BB89F02FD443DFA1A2B7D5BF11AA106CD8`.

### Commits de F1

- `3ee008c docs: incorporate approved phase one scope and clarifications`
- `5413cd5 chore: bootstrap astro portfolio`
- `7ca668b docs: document phase one architecture and validation`

Los fallos RED de TDD y los fallos de entorno investigados no se presentan como checks finales: las pruebas fallaron primero por módulos/scripts ausentes; Playwright falló inicialmente porque Astro creó un preview en background; el audit detectó Vite vulnerable antes de subirlo a 8.2.2. La evidencia anterior procede de ejecuciones frescas posteriores a las correcciones.

## Fase 2 — Design System

**Estado:** completada; detenida para revisión antes de F3 y fases posteriores.

**Rama:** `feat/f2-design-system`

**Fecha:** 2026-09-05 (`America/Santiago`)

### Alcance

- Tokens exactos de color, glass, gradiente, tipografía, espaciado, contenedores, radios, glow y movimiento.
- Manrope, Space Grotesk y JetBrains Mono variables en WOFF2 locales; display/body precargadas.
- Fondo CSS Midnight con glows, grid y ruido tenues, sin imagen raster.
- Isotipo AL geométrico en componente gradiente/monocromo y favicon SVG.
- Lucide mediante `@lucide/astro`, con importaciones individuales.
- Button, GlassCard, SectionHeader, Badge, Input, FormField, Icon, Feedback y BrandMark.
- Motion progresivo con IntersectionObserver y requestAnimationFrame; tilt ±2°/±3° solo con puntero fino.
- Estilos admin con blur 12px y glow 0.035 frente a 24px y 0.10 del público.
- Fixture temporal en `/` para revisión; no se creó `/design-system` ni se inició la Home definitiva.

### Revisión visual

- 360px: H1 se divide en dos líneas; botones ocupan todo el ancho; cards y admin se apilan sin overflow.
- 390px: H1 cabe en una línea; jerarquía y targets conservan aire lateral de 20px.
- 768px: principios en tres columnas; componentes en una columna amplia; padding lateral de 32px.
- 1024px: composición de componentes 7/5 y 5/7; jerarquía estable y sin colapso de cards.
- 1440px: ancho de contenido limitado a 1280px y secciones con ritmo editorial amplio.
- 1920px: el contenido permanece centrado y no se estira por encima del máximo definido.

### Accesibilidad y performance

- 43 pruebas unitarias validan configuración, seguridad, tokens, movimiento y contraste.
- Axe no detecta incidencias WCAG A/AA/2.1 AA en los seis anchos.
- Contraste calculado: Primary 19.07:1, Secondary 13.44:1 y Muted 7.78:1 sobre Midnight 950.
- Texto Midnight sobre los cuatro stops del CTA: entre 4.71:1 y 11.04:1.
- Subtle 4.19:1 queda sin uso como texto pequeño.
- Todos los botones e inputs tienen al menos 44px; foco visible, disabled, loading, error y feedback son verificables.
- El isotipo se renderiza y conserva su geometría a 16px, 32px y escala principal; el fixture permanece usable con zoom CSS equivalente a 200% y 400%.
- Reduced motion elimina transformaciones decorativas; touch no activa tilt; el contenido funciona sin JavaScript.
- El JS propio se limita a un módulo de motion sin framework, loops permanentes ni librerías de animación.
- Playwright: 42 casos por seis breakpoints; 39 aprobados y 3 omisiones previstas de la prueba touch en desktop.

### Commits de F2

- `555f06c feat: implement portfolio design tokens`
- `a5ec868 feat: add accessible shared components`

La instalación inicial de `lucide-astro` produjo una advertencia de deprecación. Se sustituyó antes de implementar iconos por el paquete oficial `@lucide/astro@1.41.0`. La primera revisión visual detectó cards colapsadas por el aislamiento de CSS scoped; una prueba de ancho reprodujo el fallo y el selector compartido se corrigió antes de generar las capturas finales.

## Fase 5 — Supabase / PostgreSQL

**Estado:** completada localmente; detenida para revisión. No se inició F6 ni otra fase posterior.

**Rama/worktree:** `feat/f5-supabase-schema` en `.worktrees/f5-supabase-schema`.

**Fecha:** 2026-09-05, America/Santiago (migraciones con timestamp UTC del 6 de septiembre).

### Integración de F2 y punto de partida

Se aplicó el flujo solicitado `superpowers:finishing-a-development-branch` para verificar el cierre encontrado. Al retomar, main ya estaba en `7022b20`, merge de F2, y contenía F1 mediante `b93c2c5`. Los controles `git merge-base --is-ancestor feat/f1-bootstrap main` y `git merge-base --is-ancestor feat/f2-design-system main` devolvieron 0. No se repitió un merge ya existente ni se reescribieron commits.

El worktree de F2 ya no estaba registrado ni presente; no se eliminó ningún archivo. La rama F5 aislada ya existía y tenía como ancestro el main actualizado, con dos commits de tooling. Se conservó ese trabajo. Las ramas locales/remotas existentes se mantuvieron; no hubo push ni eliminación remota.

Se revalidó main antes de completar F5: npm ci, formato, lint, tipos, 43 unitarias, build, salida estática, secretos y diff. El lint del checkout principal se ejecutó con `--ignore-pattern .worktrees/**` para no recorrer el checkout aislado anidado. En el worktree F5 se ejecutó el comando normal sin excepciones.

### Entorno confirmado

Docker Desktop 4.89.0, motor 29.7.2 y WSL 2 operativos. CLI Supabase 2.116.0 fijada exactamente en package.json/package-lock.json. PostgreSQL local 17.6, imagen 17.6.1.165, proyecto portfolio-alonso-local.

Node 24.20.0/npm 11.19.0 disponibles en el runtime local existente. Se añadió al PATH de las terminales de trabajo; no se cambió la configuración global. .env.local está ignorado y las dos variables públicas Supabase fueron comprobadas y validadas sin imprimir valores.

### Entrega

- Siete migraciones: base; media/settings; contenido; relaciones; operación/analytics; integridad; snapshot.
- 32 tablas public y tres private; RLS habilitado en todas y cero grants/policies de cliente.
- Modelo completo de §13 y ampliaciones de §7.2 con columnas explícitas, FK indexadas, singletons y unicidad de owner/CV activos.
- URLs derivadas de assets, referencias editoriales con FK reales, CV sincronizado y cascades limitados a dependencias editoriales.
- Seed idempotente con identidad/textos aprobados, categorías, especialidades y principios. Sin usuarios/owner reales, datos de contacto, proyectos, experiencia ni cifras inventadas.
- RPC `get_public_snapshot()` consistente, invoker y sin EXECUTE público; loader tipado, validación en runtime y DTO separados.
- Tipos de public/private generados desde PostgreSQL y comprobación de drift reproducible.
- Scripts de operaciones locales y documentación de reconstrucción en [CONTENT.md](CONTENT.md).

### Verificaciones finales

| Comando / prueba                                                     | Resultado                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm ci`                                                             | 402 paquetes; 0 vulnerabilidades                                                     |
| `npm run format:check`                                               | Correcto                                                                             |
| `npm run lint`                                                       | Correcto                                                                             |
| `npm run typecheck`                                                  | 38 archivos Astro/TS; 0 errores, warnings o hints                                    |
| `npm test`                                                           | 49 pruebas aprobadas                                                                 |
| `npm run build`                                                      | 2 páginas estáticas; fixture F2 conservado                                           |
| `npm run check:static`                                               | 2 documentos y base /portfolio-alonso/ correctos                                     |
| `npm run check:secrets`                                              | 8 artefactos revisados; sin secretos detectados                                      |
| `git diff --check` / `git diff --cached --check`                     | Correctos al cerrar los cambios                                                      |
| `supabase db reset --local`                                          | Tres reconstrucciones completas ejecutadas; última con todas las migraciones finales |
| `supabase db lint --local --schema public,private --fail-on warning` | Sin errores ni warnings                                                              |
| `supabase test db --local`                                           | 194 aserciones pgTAP aprobadas                                                       |
| `npm run db:types`                                                   | Tipos generados desde PostgreSQL local                                               |
| `npm run db:types:check`                                             | Sin drift; formato del repositorio aplicado por el generador                         |
| `npm run db:snapshot:check`                                          | Snapshot PostgreSQL real validado y seed repetido dos veces sin cambios              |
| Catálogo RLS                                                         | public: 32/32; private: 3/3; todas habilitadas                                       |

Las pruebas SQL cubren PK, todas las FK indexadas, UNIQUE/CHECK, slugs, singletons, owner activo, CV activo/PDF, estados y fechas, updated_at, idempotencia, cascades, preservación de media/auditoría, relaciones públicas, exclusión de borradores/futuros/privados y denegación de anon/authenticated. Un rol temporal con SELECT pero sin policies demuestra que la RPC respeta RLS; todos los fixtures, identidades y permisos temporales se revierten con ROLLBACK.

Las pruebas HTTP unitarias usan un transporte simulado; la prueba de contrato con PostgreSQL sí usa la base local real. No se presenta el build como conectado a la API pública mientras los grants de F6 siguen cerrados. No se repitió la revisión visual de F2 porque no hubo cambios de interfaz.

### Commits de implementación

Ya existentes al retomar:

- `3abc12e chore: pin supabase local tooling`
- `660af93 chore: ignore supabase local state`

Creados durante F5:

- `6a9ab5f feat: add portfolio content and media schema`
- `54ab922 feat: add operational schema and relational integrity`
- `9d9788b feat: add typed public content snapshot`
- `6e1ce31 test: verify portfolio database and snapshot contracts`

El commit de cierre documental se identifica en `git log main..feat/f5-supabase-schema --oneline`.

### Precisiones, desviaciones y riesgos pendientes

- La integración F2 y la creación del worktree F5 ya estaban realizadas; se verificaron y reutilizaron sin repetirlas.
- Por la frontera de seguridad solicitada, F5 entrega el snapshot comprobado en PostgreSQL y el loader probado, manteniendo EXECUTE cerrado. El build mediante API anónima queda pendiente de las policies/grants de F6 y de su conexión a páginas en F3/F4.
- La integridad transaccional está en PostgreSQL y sus triggers; las RPC de edición con control de revisión se dejan para F6/F7, al implementar autorización/CMS. No se abrió una escritura genérica en F5.
- No se implementó la RPC operativa de rate limiting ni tracking/agregación: solo las tablas privadas aprobadas. Su lógica pertenece a F9/F10.
- Los estados usan text con CHECK para evolucionar mediante migraciones aditivas. media_references usa FK reales más columnas derivadas para evitar referencias polimórficas huérfanas.
- No se verificó la versión PostgreSQL remota. Antes de aplicar el esquema deben comprobarse esa compatibilidad y la matriz completa F6.
- La detección de enlaces Markdown, validación de bytes y publicación de archivos pertenece a F4/F8. Los usos registrados y las FK directas ya quedan protegidos.
- No se modificó el proyecto Supabase remoto ni Automatic RLS. No hubo db push, reset remoto, alta de owner real ni cambios en dashboard.
- F6, Auth, Storage de la aplicación, CMS, Edge Functions, tracking, Home definitiva y Actions C2 no se iniciaron.

Inventario de archivos: `supabase/migrations/*.sql`, `supabase/seed.sql`, `supabase/tests/schema.test.sql`, `src/types/{database,content}.ts`, `src/lib/content/{snapshot,snapshot-contract,parse-snapshot}.ts`, `src/lib/supabase/queries.ts`, `scripts/{supabase-local,generate-database-types,check-local-snapshot}.mjs`, `tests/unit/snapshot.test.ts`, `package.json`, `eslint.config.mjs`, `docs/{ARCHITECTURE,CONTENT,PHASE_LOG}.md`. El tooling previo también versionó `supabase/config.toml`, `supabase/.gitignore` y el lockfile.

## Fase 6 — Auth, seguridad y RLS

**Estado:** completada y verificada exclusivamente en Supabase local; detenida para revisión. F8, F3, F7 y las demás fases posteriores no se iniciaron.

**Fecha:** 2026-09-06, America/Santiago.

**Rama/worktree:** `feat/f6-auth-rls` en `.worktrees/f6-auth-rls`.

### Sincronización y alcance

Se verificó el checkout limpio, se sincronizó main con origin/main y se creó el worktree aislado desde `4056e6b9ee06a4a0fb6e2fe48248dd179e8b2ae8`, merge del PR #3 de F5. Ese historial contiene F1, F2 y F5. No se reescribió historial, no hubo force-push y main permanece en ese commit. F6 deja commits locales para revisión; no se publica ni integra automáticamente.

El stack F6 usa project_id `portfolio-alonso-f6-local`, API 55421 y PostgreSQL 55422, aislado de F5. Docker Desktop 4.89.0/motor 29.7.2, Supabase CLI 2.116.0 fijada y PostgreSQL 17.6 (imagen 17.6.1.165) están operativos. Node 24.20.0/npm 11.19.0 se habilitaron únicamente en el PATH de trabajo. .env.local sigue ignorado; las pruebas Auth/REST rechazan endpoints distintos al entorno local fijado.

### Migraciones y autorización

Se agregaron seis migraciones; las siete de F5 y su seed permanecen sin modificación:

| Migración                                 | Responsabilidad                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| 20260906000800_owner_authorization.sql    | Función owner, perfil protegido y proyecciones públicas de contacto/media               |
| 20260906000900_content_rls.sql            | Grants y policies por recurso, padres/joins visibles y autoría de media                 |
| 20260906001000_private_data_rls.sql       | Lectura owner de operación, actualización limitada de mensajes y escrituras de servicio |
| 20260906001100_public_snapshot_access.sql | RPC pública invoker con proyección idéntica para todos los roles                        |
| 20260906001200_public_media_cache.sql     | Invalidación de URLs al privatizar assets o desactivar CV                               |
| 20260906001300_storage_policies.sql       | Contrato de bucket/ruta/owner y cinco policies Storage sin crear buckets                |

Las 32 tablas public y tres private conservan RLS. El catálogo tiene 139 policies incluyendo Storage. authenticated sin perfil e inactive owner solo ven contenido público. Owner activo obtiene CRUD en 25 tablas editoriales, lectura operacional y UPDATE(status) de mensajes. admin_profiles solo permite leer el perfil propio y editar display_name/avatar_url; no concede INSERT/DELETE ni UPDATE de id/role/active.

Hay 23 tablas con SELECT público filtrado y dos vistas con proyecciones públicas para contacto/media. Dos vistas administrativas invoker exponen agregados privados únicamente al owner. Solo get_public_snapshot es RPC propia en public; private no está expuesto en PostgREST.

Las tres funciones propias SECURITY DEFINER son is_portfolio_admin, read_public_contact y read_public_media. Todas viven en private, tienen propietario postgres, search_path vacío, proyección fija/sin parámetros y EXECUTE limitado. La primera evita recursión al consultar perfiles; las otras dos eliminan campos que RLS por fila no puede redactar. El inventario también distingue las cuatro funciones definer administradas por la plataforma.

El snapshot y loadPublicSnapshot están habilitados y validados contra PostgreSQL/API local reales. La salida de anon, usuario normal, owner inactivo y owner activo es equivalente salvo generated_at; excluye drafts, archivados, posts futuros, media privada, contacto oculto, mensajes, analytics, builds, auditoría y perfiles. Las páginas de F2 conservan su fixture.

### Auth, recovery y Storage

Auth bloquea signup global y mantiene activo el proveedor email/password. Las identidades y contraseñas de pruebas se generan de forma aislada; las contraseñas viven solo en memoria y los usuarios se eliminan al terminar. La prueba real verifica que manipular user_metadata no concede permisos, que JWT alterado/expirado falla y que desactivar al owner revoca acceso con el mismo JWT.

Se implementaron helpers de sesión verificada y owner para UX, y contrato de recovery con callbacks fijos bajo /portfolio-alonso/. No se crearon páginas de login/recovery ni CMS. El alta administrativa futura del único owner y la configuración remota para impedir signup se documentan sin credenciales ni UUID reales en DEPLOYMENT.md.

Storage mantiene RLS de la tabla administrada y agrega cinco policies para portfolio-public, blog, documents y private. Los cuatro buckets de testing se crean solo dentro de una transacción revertida. El catálogo final no contiene buckets de aplicación. F8 deberá crearlos, configurar MIME/tamaño y validar bytes/operaciones HTTP; no se implementó gestión multimedia.

### Verificaciones finales

| Comando / evidencia                          | Resultado                                                          |
| -------------------------------------------- | ------------------------------------------------------------------ |
| npm ci                                       | 402 paquetes; 0 vulnerabilidades                                   |
| npm ls --depth=0                             | Dependencias completas y válidas                                   |
| npm run format:check                         | Correcto                                                           |
| npm run lint                                 | Correcto                                                           |
| npm run typecheck                            | 42 archivos; 0 errores, warnings o hints                           |
| npm test                                     | 55 pruebas aprobadas                                               |
| npm run build                                | 2 páginas estáticas; fixture F2 conservado                         |
| npm run check:static                         | Base /portfolio-alonso/ y 2 documentos correctos                   |
| npm run check:secrets                        | 8 artefactos; sin secretos detectados                              |
| git diff --check / git diff --cached --check | Correctos                                                          |
| npm run db:reset                             | Reconstrucción final desde cero con las 13 migraciones y seed      |
| npm run db:lint                              | Sin errores ni warnings                                            |
| npm run db:test                              | 568 aserciones: 194 esquema + 333 autorización + 41 Storage        |
| npm run db:types:check                       | Tipos regenerados; sin drift                                       |
| npm run db:snapshot:check                    | Contrato PostgreSQL real e idempotencia del seed correctos         |
| npm run test:auth:local                      | 106 comprobaciones Auth/REST reales aprobadas; fixtures eliminados |
| npm run db:audit                             | Catálogo final exportado a SECURITY_AUDIT.json                     |

Las pruebas negativas cubren lectura directa de drafts/hijos por UUID, FK de recursos privados, joins, vistas, RPC privada, CRUD no autorizado, segundo owner, role/active/id, metadata, WITH CHECK, publicación no autorizada y falsificación de autoría. UPDATE/DELETE denegados se comprueban también mediante cero filas afectadas. Se prueba un search_path manipulado con tabla temporal falsa sin alterar la decisión owner. Todas estas pruebas acceden directamente a PostgreSQL/HTTP, sin protección de UI.

La reconstrucción final se ejecutó después de completar migraciones y pruebas. El recorrido posterior repitió lint SQL, 568 aserciones, comprobación de tipos, snapshot, Auth/REST y auditoría. No se repitió QA visual porque F6 no modifica la interfaz.

### Commits

- `5bd4696 feat: add portfolio owner authorization and rls`
- `9831ef0 feat: secure public snapshots and storage access`
- `394f057 feat: configure local auth and recovery contracts`
- `04b6be4 test: verify portfolio authorization boundaries`

El cierre documental usa `docs: record phase six security validation`; el historial completo se consulta con `git log origin/main..feat/f6-auth-rls --oneline`.

### Precisiones y pendientes

- La redacción de columnas exige dos helpers definer adicionales a la función owner; están justificados y probados. Ninguna RPC de edición genérica ni auditoría enterprise fue agregada.
- storage.objects pertenece a Supabase. Su RLS se verifica en la migración sin cambiar propiedad; su ACL incluye concesiones de la plataforma que postgres no puede revocar. Las policies deniegan DML no autorizado por la API; las concesiones amplias administradas y sus otorgantes quedan inventariados para revisar antes de producción. No se conceden permisos equivalentes en las tablas de aplicación.
- graphql_public.graphql es un stub invoker del stack, con EXECUTE administrado para clientes; pg_graphql no está habilitado y la invocación local no devuelve datos. Debe revisarse nuevamente si se habilita esa extensión en otro entorno.
- Recovery entrega contrato y solicitud Auth local verificada; la página física y el intercambio PKCE de la UI quedan para F7. La ruta no se presenta como implementada.
- Buckets, validación de MIME/bytes/tamaño, URLs firmadas y UI pertenecen a F8. RLS de metadatos no vuelve privados los bytes ya publicados en un bucket público.
- El despliegue remoto requiere aprobación y comparación de versiones, grants y policies existentes (las policies permisivas se combinan con OR). La prueba local no certifica un entorno remoto que no se ha inspeccionado/modificado.
- No se cambió Supabase remoto, Automatic RLS, Auth remoto ni owner remoto. No hubo db push, secrets remotos, Edge Functions ni pruebas contra producción.

Inventario F6: seis migraciones anteriores; `supabase/config.toml`; `supabase/tests/{schema,rls,storage}.test.sql`; `supabase/tests/fixtures/content.psql`; `src/lib/auth/{session,owner,redirects}.ts`; `src/types/database.ts`; `tests/unit/auth.test.ts`; `scripts/{check-local-snapshot,test-local-auth,audit-local-security}.mjs`; `package.json`; `docs/{SECURITY,ARCHITECTURE,DEPLOYMENT,CONTENT,PHASE_LOG}.md`; `docs/SECURITY_AUDIT.json`.

## Fase 8 — Supabase Storage y multimedia

**Estado:** completada exclusivamente en Supabase local; detenida para revisión. No se iniciaron F3, F4, F7, F9, F10, F11 ni otras fases.

**Fecha:** 2026-09-06, America/Santiago.

**Rama/worktree:** feat/f8-storage-media en .worktrees/f8-storage-media.

### Cierre de F6 y base verificada

Se consultó GitHub: PR #4 MERGED, head e5698e1, merge 25c351557d060b7438cb89ae520a96681ae69828. Todos los commits de F6 estaban en origin/feat/f6-auth-rls y eran ancestros de origin/main. El PR no tenía checks automáticos; su evidencia es la validación local documentada de F6. No fue necesario repetir el merge.

Con el checkout principal limpio se ejecutaron fetch y pull --ff-only. Se verificaron ancestros de F1, F2, F5 y F6 y se creó la nueva rama exclusivamente desde origin/main 25c3515. No se reutilizó el worktree F6, no hubo force-push ni reescritura de historial. Main permanece en esa base; F8 solo crea commits locales para revisión.

### Entorno y migraciones

Docker Desktop 4.89.0/motor 29.7.2 y WSL 2 operativos. CLI Supabase 2.116.0 fijada, PostgreSQL 17.6 (imagen 17.6.1.165), Node 24.20.0 y npm 11.19.0. El stack portfolio-alonso-f8-local usa API 56421 y DB 56422, aislado de F5/F6. .env.local permanece ignorado; ninguna prueba usa el proyecto remoto que pueda figurar en sus variables públicas.

Cuatro migraciones aditivas, sin modificar las 13 de F5/F6:

| Migración                                | Entrega                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 20260906001400_storage_buckets.sql       | Cuatro buckets, MIME/10 MiB, rutas UUID, objetos inmutables y FK que protege bytes registrados           |
| 20260906001500_media_lifecycle.sql       | decorative, constraints, logos de tecnologías, referencias Markdown, reemplazo transaccional y CV activo |
| 20260906001600_media_public_contract.sql | Proyección pública tipada con decorative/logos y documentos generales independientes del CV              |
| 20260906001700_media_api_integrity.sql   | Trigger CV compatible con pg-safeupdate de PostgREST y protección adicional del Markdown al eliminar     |

Las 35 tablas de aplicación siguen con RLS; Storage también. El catálogo final tiene cuatro buckets, cuatro vistas y 138 policies, incluidas las cuatro finales de Storage. Las tres funciones propias SECURITY DEFINER siguen siendo las justificadas de F6; las dos RPC nuevas son SECURITY INVOKER y verifican owner explícitamente.

### Infraestructura entregada

- Buckets: portfolio-public (projects/technologies/profile/general), blog (posts), documents (cv/general) y private (temporary/drafts/processing).
- JPEG/PNG/WebP/AVIF y PDF según bucket, máximo 10 MiB. SVG/HTML/JS/ejecutables no admitidos como uploads genéricos.
- Upload inicial privado, publicación explícita mediante copia nueva, UUID independiente de filename y signed previews privados de 60 segundos.
- Metadata editorial completa, decorative explícito y alt informativo obligatorio. FK al objeto Storage; no se guardan bytes en PostgreSQL.
- Referencias automáticas de proyectos, artículos, galerías, perfil/settings, documentos, tecnologías y tokens Markdown.
- Reemplazo atómico con revisión obligatoria (también se rechaza NULL), FK y tokens actualizados; el archivo anterior queda retenido.
- Borrado bloqueado en uso, incluida llamada directa a Storage y manipulación manual de media_references. No hay borrado de bytes por cascade editorial.
- Compensación tras fallo de INSERT, reconciliación de respuesta perdida, cleanup explícito si fallan bytes y reporte de huérfanos sin eliminación automática.
- CV: registro inactivo y activación atómica de un único PDF público; documentos generales publicados no dependen de cv_enabled.
- Pipeline desde snapshot/Storage reales: origen permitido, redirects denegados, timeout, límite de streaming, decodificación, AVIF/WebP/PNG responsive y PDF local.
- Asset map por UUID con nombres SHA-256, dimensiones y rutas bajo la base de Astro; MediaImage.astro no conoce Storage.
- Biblioteca aislada con búsqueda/filtros, upload, metadata, publicación, usos, reemplazo, borrado y preview. Sus estados/errores conservan datos del usuario.
- Fixture UI fuera de src/pages, inyectado solo en Playwright. No se creó navegación CMS ni /admin/media productivo.

### Validaciones finales

| Verificación                                 | Resultado                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| npm ci                                       | 407 paquetes instalados; 0 vulnerabilidades                                  |
| npm ls --depth=0                             | Dependencias completas y versiones fijadas                                   |
| npm run format:check                         | Correcto                                                                     |
| npm run lint                                 | Correcto                                                                     |
| npm run typecheck                            | 58 archivos; 0 errores, warnings o hints                                     |
| npm test                                     | 84 pruebas aprobadas                                                         |
| npm run test:e2e                             | 45 aprobadas; 3 omisiones touch previstas de F2 en desktop; seis breakpoints |
| npm run build                                | 2 páginas estáticas; fixture multimedia excluido del build normal            |
| npm run check:static                         | Base /portfolio-alonso/ y referencias correctas                              |
| npm run check:secrets                        | 8 artefactos; sin secretos detectados                                        |
| git diff --check / git diff --cached --check | Correctos                                                                    |
| npm run db:reset                             | Reconstrucción final desde cero con 17 migraciones y seed                    |
| npm run db:lint                              | Sin errores ni warnings                                                      |
| npm run db:test                              | 605 aserciones SQL aprobadas                                                 |
| npm run db:types:check                       | Tipos generados reproduciblemente; sin drift                                 |
| npm run db:snapshot:check                    | Snapshot PostgreSQL real válido; seed idempotente                            |
| npm run test:auth:local                      | 106 comprobaciones Auth/REST reales aprobadas                                |
| npm run test:media:local                     | 55 comprobaciones Storage/media reales aprobadas                             |
| npm run db:audit                             | Catálogo actualizado en SECURITY_AUDIT.json                                  |

Las pruebas cubren anon/noowner/inactive/owner, upload/list/download/sign/update/upsert/delete, bytes públicos/privados y ausencia de autorización administrativa por JWT solamente. Los tests de archivo incluyen formatos válidos, corrupción, MIME falso, extensión incorrecta, >10 MiB, PDF corrupto/activo, SVG, HTML disfrazado, Unicode y filenames repetidos.

Las pruebas de uso incluyen proyecto/post/tecnología, referencias repetidas, Markdown inválido, reemplazo con revisión obsoleta o nula, eliminación bloqueada, desvinculación y protección frente a borrar media_references manualmente. Se probaron fallos parciales y respuesta perdida con Auth/Storage reales.

El pipeline se prueba con origen/URL privados o no permitidos, timeout, tamaños excesivos, corruptos y ausentes, referencias requeridas faltantes, varias imágenes, PDF, formatos y anchos, hashes estables y conservación del manifest anterior ante fallo. El build normal no contiene rutas de pruebas ni sus bundles.

La biblioteca pasó axe, responsive y reintento con metadata conservada en seis tamaños. Se inspeccionaron capturas móviles y desktop. Las pruebas UI usan un adaptador sintético; la seguridad y los servicios se verifican directamente en PostgreSQL y HTTP real, sin guards de UI.

La última reconstrucción se ejecutó después de terminar migraciones y pruebas, seguida de toda la batería SQL/Auth/Storage. El estado final tiene 0 usuarios Auth, 0 media_assets y 0 storage.objects de testing; solo permanecen los cuatro buckets migrados y el seed autorizado.

### Dependencias y decisiones

sharp 0.35.4 pasa a dependencia directa, reutilizando la versión que ya traía Astro. Se añade pdf-lib 1.17.1 con carga dinámica en validación PDF. No se añaden frameworks UI ni un servicio de procesamiento.

La FK a storage.objects depende de su clave única bucket/name administrada por Supabase: deberá comprobarse en actualizaciones y antes del despliegue remoto. Las ACL de Storage administradas por la plataforma quedan inventariadas, sin cambiar propietarios ni conceder SQL arbitrario a clientes.

La policy UPDATE de objetos se retira deliberadamente: la administración conserva upload y metadata editorial, y reemplaza mediante nuevos UUID. No se permite upsert permanente. Se amplían las carpetas general/drafts/processing y el tipo document conforme a la autorización F8 del usuario.

RLS y MIME no decodifican los bytes en el servidor. Los servicios y el build sí los validan; un owner que evite los servicios puede subir contenido inválido con MIME permitido, cuyo uso obligatorio falla en el build. No se implementó antivirus ni una Edge Function de validación.

El reporte distingue ausencia de objeto de errores 500 del backend; estos últimos dejan complete=false y requieren revisión. La comprobación de bytes implica descargas de mantenimiento, no una tarea automática.

La biblioteca y el pipeline quedan preparados para integración con F3/F4/F7. La portada F2 no se conecta todavía a contenido Supabase, y no se construyó renderer Markdown, CMS ni despliegue C2. El contrato y los comandos completos están en MEDIA.md.

### Commits de implementación

- f4af3ab — feat: add isolated portfolio storage buckets
- 1a14654 — feat: add transactional media references and lifecycle
- 1026140 — feat: add secure media upload and maintenance services
- 41242c1 — feat: add static media build pipeline
- 36d339b — feat: add isolated reusable media library
- ef67a67 — test: verify portfolio media and storage security

El cierre documental usa docs: record phase eight media validation. El historial completo se consulta con git log origin/main..feat/f8-storage-media --oneline.

### Inventario y límites

47 archivos creados/modificados: astro.config.mjs; eslint.config.mjs; package.json/package-lock.json; playwright.config.ts; cuatro migraciones F8; supabase/config.toml; supabase/tests/{schema,rls,storage,media}.test.sql y fixtures/content.psql; src/types/{database,content}.ts; src/lib/content/snapshot-contract.ts; src/lib/media/{types,paths,validation,validation-build,repository,upload,usage,lifecycle,orphans,build-assets,library,library-controller}.ts; src/components/admin/MediaPicker.astro; src/components/shared/MediaImage.astro; scripts/{audit-local-security,check-local-snapshot,test-local-auth,test-local-media}.mjs; tests/unit/{snapshot,media}.test.ts; tests/e2e/media.spec.ts; tests/fixtures/media-page.astro; docs/{ARCHITECTURE,CONTENT,DEPLOYMENT,SECURITY,MEDIA,PHASE_LOG}.md; docs/SECURITY_AUDIT.json.

No se modificó Supabase remoto ni Automatic RLS. No hubo db push, buckets/uploads remotos, cambios Auth remotos, secrets ni Edge Functions. F5/F6/F8 requieren revisión conjunta antes del primer despliegue autorizado. F3/F4/F7/F9/F10/F11 no se iniciaron.

# F9 — Edge Functions (2026-09-06)

Base `302a00211db100237630d16bd323f07e8475bc92`, rama `feat/f9-edge-functions`, worktree nuevo. Cuatro funciones, shared utilities, RPC service-only sobre tablas existentes, formulario F4 conectado y pruebas adversariales/HTTP/navegador. Baseline 019 intacto; migraciones 020/021 aplicadas local y remotamente. Contact-submit versión 2 ACTIVE y formulario habilitado tras 27 comprobaciones remotas; fixtures eliminados. Publish-site/build-status/track-event permanecen locales. SQL 659, Edge 90, HTTP 79, Auth 107, Storage/media 66, npm 146, E2E 179 aprobadas (73 omisiones por breakpoint). Reconstrucción posterior, tipos y auditoría sin drift inesperado. Se corrigieron empaquetado de dependencias e identificación del origen tras evidencia del runtime administrado. [Registro detallado](EDGE_FUNCTIONS.md) y [evidencia de cierre](checkpoints/F9_EDGE_FUNCTIONS.md). Sin PR/merge ni inicio de F10/F7/F11/F12/F13/F14.

# F10 — Analytics first-party (2026-09-06, completada)

Base e528078f19a245af7d56b00be6895e3af681777a; rama feat/f10-first-party-analytics y worktree nuevo. F9 ya integrada; no se repitió su integración. Ejecución secuencial al no estar disponible el skill superpowers solicitado.

Cliente y hooks públicos, contrato F9 único, sesiones efímeras, DNT/GPC, agregados horarios, retención 90/400 fechas y repositorio owner-only. 022 posterior a 019/020/021; no tablas duplicadas ni cambios a esas migraciones. [Detalle de implementación](ANALYTICS.md).

Upgrade con raw existente y reconstrucción desde volumen local vacío verificados. 714 SQL, 99 Edge, 49 Analytics HTTP, 79 Edge HTTP, 107 Auth/RLS, 66 Storage/media; formulario local real conserva recepción/retry/conversión única. 176 unitarias npm; E2E completo: 197 aprobados y 136 omisiones previstas por breakpoint. Build público remoto posterior: seis páginas y 22 artefactos sin secretos.

022 aplicada a las 21:34 UTC, sin seed/roles/Vault. Track-event v1 ACTIVE; se añadió solo ANALYTICS_RATE_LIMIT_HMAC_SECRET y se reutilizó el HMAC existente. Contacto pasó de v2 a v3 por la actualización de configuración de la plataforma, con los 14 archivos idénticos a F9 y sin deploy de su código. 35 smoke checks remotos aprobados, fixtures eliminados y agregados recalculados. Tipos y catálogo propios coinciden; dry-run vacío, Automatic RLS activo. [Cierre, incidencias y evidencia](checkpoints/F10_ANALYTICS.md).

Incidencia ambiental: cinco stacks Supabase anteriores acumulaban 56 contenedores. Se detuvieron 44 contenedores de cuatro stacks antiguos del portfolio preservando sus volúmenes. db reset quedó bloqueado en inicialización de esquemas administrados; se sustituyó por el procedimiento soportado stop/start desde volumen vacío. La prueba de upgrade usa copias ignoradas de migraciones/configuración/dependencias de funciones. No hubo modificación de tablas administradas para resolverlo.

No se inició F7/F11/F12/F13/F14; sin PR ni merge automático.

# F7 — CMS administrativo (2026-09-06, validación en curso)

Base 5f0e42910983dfbf14c919769d2c057c7811625e, rama feat/f7-admin-cms, worktree nuevo desde origin/main. Rutas estáticas, Auth/PKCE, repositorios y editores, autosave con conflictos, integración F8, mensajes y Analytics F10. Migración aditiva 023 para transacciones editoriales, sin nuevas tablas ni SECURITY DEFINER. Las 15 pruebas E2E iniciales del CMS pasaron contra Auth/PostgreSQL/Storage local; revisión de 30 capturas detectó y corrigió la barra de acciones móvil. El cierre y despliegue controlado se registrarán una vez terminadas todas las verificaciones. [Guía CMS](ADMIN_CMS.md). Sin push, PR ni merge; F10B/F11/F12/F13/F14 no iniciadas.
