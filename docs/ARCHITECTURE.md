# Arquitectura del portfolio

## Home pública de F3 — 2026-09-06

La portada consume una lectura consistente de `loadPublicSnapshot()` durante el build. `loadHomePage()` coordina la RPC anónima, `buildSnapshotAssets()` de F8 y el DTO de presentación `createHomeModel()`. La página solo compone componentes Astro. El navegador recibe HTML, CSS, assets locales y scripts pequeños para navegación, movimiento progresivo y copia de correo; no recibe un cliente Supabase ni una sesión administrativa.

Los datos administrables vienen del snapshot: identidad, Hero, perfil, colecciones visibles, contacto y CV. Las etiquetas de interfaz y el terminal conceptual son presentación. No hay contenido profesional inventado ni fallback de datos productivos. Snapshot inválido, configuración ausente o media obligatoria rota detienen el build. El diseño vacío es un resultado válido de una lectura correcta.

F8 mantiene el único pipeline: UUID editorial → asset map → archivos con hash, dimensiones, AVIF/WebP/PNG y PDF. `MediaImage.astro` oculta Storage a los componentes. En desarrollo, una integración sirve exclusivamente esos archivos con hash desde el outDir de Astro. No acepta URLs de descarga arbitrarias. En producción el mismo outDir forma el artefacto autocontenido.

La navegación móvil usa details/summary sin JavaScript y un dialog modal nativo como mejora progresiva. Incluye Escape, foco, bloqueo de scroll y retorno al disparador. Los eventos de contacto pasan por un no-op tipado; no existe tracking F10. Las rutas internas y el listado completo del blog se completarán en F4; F3 utiliza anclas de Home para conservar navegación funcional.

El [contrato de Home y evidencia](HOME.md) describe estados vacíos, pruebas sin red remota y límites. El fixture F2 permanece fuera de src/pages, inyectado solo en el artefacto de pruebas junto al fixture F8. Las secciones siguientes conservan el historial de los checkpoints del backend; F3 no cambia migraciones, tipos DB, grants, Auth ni Storage.

## Primer backend remoto — 2026-09-06

El baseline 019 está aplicado en portfolio-alonso, sa-east-1, PostgreSQL 17.6. Las 32 tablas public, 3 private, vistas, funciones, grants/RLS y buckets coinciden con una nueva reconstrucción local. Supabase contiene los 21 registros base autorizados y la cuenta Auth/perfil del owner definitivo; no quedan fixtures. loadPublicSnapshot funciona contra remoto. La única diferencia de tipos generados es la anotación del servicio PostgREST 14.5; los schemas tipados no cambian.

Auth remoto impide signup y permite redirects exactos bajo /portfolio-alonso/. El usuario creó su cuenta y el bootstrap administrativo la vinculó como único owner activo. La matriz anon/noowner/inactivo/owner, snapshot y ciclo Storage real pasaron 139 comprobaciones; catálogo y Automatic RLS permanecen sin drift. Ninguna fase funcional posterior está iniciada. La [operación independiente](checkpoints/INITIAL_DEPLOY.md) parte de main d3b5d0f en chore/supabase-initial-deploy; no hay cambios de código de aplicación, migraciones ni pipeline.

## Instalación inicial vigente

La rama `chore/supabase-initial-baseline` parte de main `c89ed9c` y prepara una instalación inicial atómica mediante `20260906001900_initial_portfolio.sql`. Las 18 migraciones originales se conservan sin cambios en `supabase/legacy-migrations/`; 018 sigue siendo la transición para bases F8 existentes. Un generador con hashes produce la baseline sin crear en ningún momento la FK compuesta hacia Storage. Las futuras migraciones irán después de 019 en el directorio activo. [Decisión, equivalencia y adopción](checkpoints/INITIAL_BASELINE.md).

No cambia el modelo público ni sus DTO. Se comparan catálogo, grants, RLS, funciones, referencias y Storage de ambos caminos; el ensayo incluye restauración del estado remoto previo y conservación de Automatic RLS. No se ejecuta despliegue remoto ni se inicia F3.

## Checkpoint backend previo a F3

El [checkpoint de compatibilidad remota](checkpoints/SUPABASE_REMOTE_READINESS.md), iniciado desde origin/main e8a4750097cbb6a7c85e01ce36cf91c3f38a4185, inspeccionó el proyecto real sin desplegar. PostgreSQL local/remoto coincide en 17.6. Automatic RLS es una configuración administrada preexistente que se conservará además de RLS explícito. La migración correctiva 018 sustituye localmente la dependencia del índice no primario por una FK a `storage.objects.id` (PK UUID), con RESTRICT y sin alterar Storage. Conserva bucket/path e impide cambiar identidad; los servicios registran el UUID devuelto por la API. La actualización de F8 con referencias existentes y la carrera registro/borrado están probadas. La puerta remota sigue cerrada: faltan login CLI, backup/diff y revisión posterior. [Evidencia y ciclo de vida](checkpoints/STORAGE_OBJECT_IDENTITY.md). No hay backend remoto validado ni nuevas funcionalidades; F3 y las demás fases siguen pendientes.

## Modelo C2

Supabase/PostgreSQL es la única fuente de verdad. Astro consulta únicamente contenido público durante el build, genera HTML/CSS/JavaScript estático y GitHub Actions publica el artefacto en GitHub Pages. Si una compilación falla, Pages conserva la última publicación correcta.

```text
Supabase ──lectura pública/RLS──> Astro build ──artefacto──> GitHub Pages
    ^                                                        │
    └──── JWT + RLS <──── CMS estático /admin <───────────────┘
```

Un solo repositorio contiene el sitio público y el shell administrativo. No existe un servidor Astro en producción ni routing dinámico del lado servidor. Las páginas administrativas editables serán físicas, por ejemplo `/admin/projects/edit/?id=UUID`.

## Límites de F1, F2, F5, F6 y F8

F1 entrega configuración, rutas, clientes Supabase separados, pruebas y documentación. F2 añade tokens visuales, fuentes locales, componentes compartidos, motion progresivo y estilos base del administrador. La pantalla visible es un fixture temporal sin contenido administrable. Estas responsabilidades permanecen para fases autorizadas posteriores:

- F6 ya entrega grants, policies, Auth owner local y contrato de seguridad de Storage sobre F5; Automatic RLS remoto se conserva sin modificaciones.
- F8 ya entrega buckets locales, servicios y biblioteca multimedia aislada, referencias y pipeline de assets estáticos; su incorporación a páginas/CMS corresponde a F3/F4/F7.
- F3/F4: contenido público y rutas internas alimentadas desde Supabase.
- F9: Edge Functions.
- F7: CMS `/admin`.
- F10: analítica.
- F11: Actions y Pages.

## Configuración y secretos

`src/lib/config/public.ts` aplica una allowlist de variables `PUBLIC_*`. La URL y publishable key pueden llegar al navegador; RLS sigue siendo la frontera de datos. `src/lib/config/build.ts` se utiliza en Node para derivar `site` y `base`.

`src/lib/supabase/browser.ts` prepara el cliente futuro del admin con persistencia de sesión y PKCE. `src/lib/supabase/build.ts` crea un cliente de lectura anónima sin persistencia. Ambos usan el transporte acotado de `src/lib/supabase/transport.ts`: Supabase JS 2.115.0 ya evita usar nuevas API keys como Bearer para Edge Functions, pero aún conserva ese fallback en Storage/REST. El guard elimina exclusivamente un Bearer que empiece con `sb_publishable_` o `sb_secret_`; conserva cualquier JWT de usuario. Una prueba de regresión permite retirar el guard cuando el SDK aplique la separación a todos los servicios.

Las Edge Functions no usan este guard como sistema de autenticación. En F9 se implementarán con `@supabase/server`, `withSupabase()` o `createSupabaseContext()` y el modo adecuado:

| Tipo de llamada               | Header                                      | Modo          |
| ----------------------------- | ------------------------------------------- | ------------- |
| Usuario con sesión            | `Authorization: Bearer <user JWT>`          | `user`        |
| Cliente público sin identidad | `apikey: sb_publishable_*`                  | `publishable` |
| Servicio autorizado           | `apikey: sb_secret_*`                       | `secret`      |
| Webhook con firma propia      | firma del proveedor, verificada por handler | `none`        |

El modo `none` no autentica: un callback debe verificar su firma. Un JWT autenticado tampoco implica administración; la autorización owner se mantiene en `admin_profiles`, `private.is_portfolio_admin()` y RLS.

## URLs y GitHub Pages

`PUBLIC_SITE_URL` es la URL pública completa. Los helpers centralizados derivan una base `/` o `/portfolio-alonso/`, agregan barra final a páginas y rechazan URLs externas o traversal. `astro.config.mjs` usa salida estática con formato de directorio.

La base inicial propuesta es `https://alarenas1988.github.io/portfolio-alonso/`. Un dominio propio cambiará la variable sin exigir rutas hardcodeadas. Canonical, sitemap, RSS y robots se terminan en F12.

## Estructura

```text
src/components/{public,admin,shared}/
src/layouts/
src/pages/
src/lib/{config,supabase,auth,analytics,markdown,media,seo,utils}/
src/styles/
src/types/
supabase/migrations/
supabase/functions/
tests/{unit,integration,e2e}/
scripts/
docs/
```

Las carpetas se crean cuando su fase las necesita. Las páginas coordinan; consultas, autorización, Markdown y publicación viven en módulos enfocados. F5 reemplaza el placeholder de DB por tipos generados reproduciblemente desde PostgreSQL local.

## Esquema y frontera de F5/F6

Las siete migraciones de F5 y el seed idempotente reconstruyen 32 tablas de public y tres de private, inicialmente con RLS y denegación por defecto. F6 agrega seis migraciones de autorización sin modificar las originales. Todas las tablas conservan RLS; los grants expresan operaciones y las policies autorizan filas. El esquema completo sigue exclusivamente local, pendiente de revisión antes de cualquier aplicación remota.

El contrato de build es `loadPublicSnapshot(): Promise<PublicSnapshot>`, implementado en `src/lib/content/snapshot.ts`. Una RPC SQL STABLE y SECURITY INVOKER devuelve una lectura consistente, con proyección explícita y filtrado de publicación, fechas, relaciones y media. F6 habilita EXECUTE a anon/authenticated y comprueba que también el owner recibe exclusivamente el snapshot público. El parser valida el contrato antes de presentar datos; una consulta fallida aborta sin fallback privilegiado. Las páginas de F2 conservan su fixture hasta F3.

El catálogo completo, estados, cascades, sincronización de URLs/CV, referencias editoriales, pruebas y comandos de reconstrucción están en [CONTENT.md](CONTENT.md). Los tipos DB incluyen public/private, pero los DTO públicos derivan únicamente campos permitidos. Importar el loader está reservado al build; los módulos generales conservan la prohibición de importar código de build.

## Autorización de F6

Supabase valida el JWT; `private.is_portfolio_admin()` resuelve auth.uid() contra un perfil owner activo. La función privada no recibe UUID ni confía en metadata. authenticated sin ese perfil y owner inactivo tienen únicamente lectura pública. Los perfiles no se crean ni cambian de role/active/id desde la API, tampoco por el owner.

Cada relación pública verifica la visibilidad del padre y de los recursos relacionados. Contacto y media usan proyecciones fijas para excluir campos ocultos e internos; sus tablas originales son administrativas. Tres funciones privadas SECURITY DEFINER, con propietario controlado y search_path vacío, resuelven exclusivamente la comprobación owner y esas dos proyecciones. Las cuatro vistas son SECURITY INVOKER. Los caches de URLs se invalidan al privatizar media o desactivar el CV.

Los datos operacionales permiten lectura owner y escrituras de servicio delimitadas. El navegador solo cambia status de mensajes; no puede falsificar builds ni editar auditoría. Storage tiene cinco policies sobre los cuatro buckets previstos, aún sin crearlos. Sus ACL administradas por Supabase se inventarían expresamente; la autorización de operaciones de su API se prueba mediante RLS.

Auth local desactiva signup global y conserva el proveedor email/password. Los helpers de sesión y owner son auxiliares de UX; la seguridad se prueba directamente en SQL y REST. Recovery define callbacks estáticos con la base de Astro, cuya UI corresponde a F7. La matriz por tabla, grants, funciones y límites de Storage están en [SECURITY.md](SECURITY.md) y [SECURITY_AUDIT.json](SECURITY_AUDIT.json); reconstrucción, bootstrap owner y configuración futura se documentan en [DEPLOYMENT.md](DEPLOYMENT.md).

## Multimedia de F8

Cuatro migraciones aditivas crean los cuatro buckets aprobados y completan el ciclo editorial. media_assets tiene decorative explícito y una FK a storage.objects que protege contra borrados directos de objetos registrados. media_references registra FK y tokens Markdown; technologies admite icon_asset_id/icon_url. Las RPC invoker replace_media_asset y activate_cv verifican owner y conservan la integridad transaccional.

La carga siempre comienza en private. Publicar crea una copia validada con UUID nuevo; reemplazar referencias conserva el archivo anterior. Las cuatro policies finales de Storage deniegan UPDATE/upsert/move de objetos para preservar la inmutabilidad. La metadata editorial sí permite edición owner. Las operaciones parciales devuelven trabajo de limpieza y reportMediaOrphans no elimina automáticamente.

buildSnapshotAssets transforma referencias públicas en un mapa de archivos con hash, dimensiones y variantes AVIF/WebP/PNG, y copia PDF al mismo artefacto. El downloader restringe origen, endpoint, tamaño, timeout y redirects; un asset requerido inválido aborta. MediaImage.astro consume el mapa sin conocer Storage. Esta base está probada con bytes locales reales; la portada de F2 conserva su fixture hasta F3.

MediaPicker.astro y su controlador son reutilizables y reciben un adaptador autenticado. La página de QA vive fuera de src/pages y se inyecta únicamente en Playwright. No se implementó navegación CMS ni publicación C2. El contrato completo y las dependencias del catálogo administrado están en [MEDIA.md](MEDIA.md).

## Calidad

TypeScript usa el preset `strictest`. ESLint prohíbe `any` explícito y evita importar módulos build-only en código general de `src`. Prettier conserva una copia byte por byte del maestro fuera de su alcance.

El artefacto se valida por estructura, base y referencias; luego se analiza en busca de patrones privados. Unit tests ejercitan configuración, URLs, tokens y contraste. Playwright y axe prueban el artefacto a 360, 390, 768, 1024, 1440 y 1920px, incluida la 404, controles, touch, uso sin JavaScript y reduced motion.

Los tokens de F2 son la fuente visual compartida por Tailwind, el frontend y el futuro administrador. El admin reduce blur, glow y movimiento para priorizar densidad y legibilidad. La portada de muestra se reemplaza en F3 y no adelanta contenido público, navegación ni funcionalidades posteriores.
