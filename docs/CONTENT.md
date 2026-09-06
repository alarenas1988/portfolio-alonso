# Contenido y esquema F5

Estado: implementación local de F5; acceso de clientes cerrado hasta F6. PostgreSQL es la fuente única de verdad. No se han aplicado migraciones al proyecto remoto ni cambiado Automatic RLS.

## Entorno y reconstrucción

- Docker Desktop 4.89.0; motor 29.7.2; backend WSL 2 operativo.
- Node 24.20.0 y npm 11.19.0 (runtime existente en `.tools/node-v24.20.0-win-x64` del checkout principal).
- Supabase CLI **2.116.0**, dependencia exacta y lockfile. PostgreSQL **17.6**, imagen `supabase/postgres:17.6.1.165`, major 17 en configuración.
- Proyecto local `portfolio-alonso-local`; API `http://127.0.0.1:54321`; PostgreSQL en `127.0.0.1:54322`; Studio en `http://127.0.0.1:54323`.
- `.env.local` existe e ignora Git. Contiene `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY`; sus valores no se copian a documentación ni a fixtures.
- Extensiones base observadas: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`. pgTAP y plpgsql_check se utilizan al probar/lintar mediante CLI; no se añaden servicios externos.
- El arranque estándar de Supabase inicia sus servicios locales; no se han creado buckets, funciones Edge ni configuración de Storage de la aplicación.

Desde el worktree de F5, con el runtime fijado disponible en PATH:

```powershell
npm ci
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
npm run db:types:check
npm run db:snapshot:check
```

En esta máquina, si Node no está en PATH, habilitarlo solo para la terminal actual:

```powershell
$env:Path = 'C:/laragon/www/portfolio/.tools/node-v24.20.0-win-x64;' + $env:Path
Set-Location C:/laragon/www/portfolio/.worktrees/f5-supabase-schema
```

Los wrappers fijan `--local`, rechazan argumentos adicionales y no admiten `--linked`, `--db-url` ni referencias remotas. `db:reset` borra/reconstruye exclusivamente los datos locales de desarrollo; el seed se aplica al terminar. `db:start` omite las credenciales que CLI imprime al iniciar. La generación de tipos escribe UTF-8 y aplica Prettier de forma reproducible; `db:types:check` detecta drift sin escribir. El chequeo del snapshot usa únicamente el contenedor local fijo y verifica el contrato real y la idempotencia del seed.

Los comandos corresponden al [flujo local oficial de Supabase](https://supabase.com/docs/guides/local-development/cli-workflows) y su [referencia CLI](https://supabase.com/docs/reference/cli/supabase-init). No ejecutar `supabase db push` antes de F6 y autorización explícita. La versión PostgreSQL remota no se ha consultado: se verificará antes de cualquier aplicación remota.

## Migraciones

| Archivo en supabase/migrations            | Responsabilidad                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `20260906000100_base.sql`                 | Esquema private, permisos iniciales, helpers, perfil y owner activo único |
| `20260906000200_media_settings.sql`       | Assets, documentos, settings, contacto y redes                            |
| `20260906000300_content.sql`              | Proyectos, blog, tecnologías, experiencia y perfil                        |
| `20260906000400_relations.sql`            | Hijos editoriales, joins y referencias de media                           |
| `20260906000500_operations_analytics.sql` | Contactos recibidos, eventos, agregados, auditoría y builds               |
| `20260906000600_integrity.sql`            | URLs derivadas, CV, referencias automáticas, timestamps e índices FK      |
| `20260906000700_public_snapshot.sql`      | RPC de snapshot público con proyección explícita                          |

Cada migración se aplica en una transacción. Se reconstruyen en orden desde cero; no se pretende ejecutar manualmente dos veces un CREATE TABLE. El seed sí es idempotente y no sobrescribe ediciones existentes.

## Inventario y RLS

Las **32 tablas public** nacen con RLS habilitado dentro de su transacción de creación y `REVOKE ALL` para PUBLIC/anon/authenticated. No se instalan policies ni grants de cliente en F5. La configuración local desactiva la exposición automática de tablas nuevas. Esto complementa, sin reemplazar, Automatic RLS del proyecto remoto.

| Tabla public              | RLS | Acceso anon/authenticated en F5 |
| ------------------------- | --- | ------------------------------- |
| `site_settings`           | Sí  | Denegado                        |
| `contact_settings`        | Sí  | Denegado                        |
| `social_links`            | Sí  | Denegado                        |
| `projects`                | Sí  | Denegado                        |
| `project_features`        | Sí  | Denegado                        |
| `project_images`          | Sí  | Denegado                        |
| `project_metrics`         | Sí  | Denegado                        |
| `project_challenges`      | Sí  | Denegado                        |
| `project_technologies`    | Sí  | Denegado                        |
| `posts`                   | Sí  | Denegado                        |
| `post_categories`         | Sí  | Denegado                        |
| `post_category_relations` | Sí  | Denegado                        |
| `tags`                    | Sí  | Denegado                        |
| `post_tags`               | Sí  | Denegado                        |
| `experiences`             | Sí  | Denegado                        |
| `experience_highlights`   | Sí  | Denegado                        |
| `experience_projects`     | Sí  | Denegado                        |
| `experience_technologies` | Sí  | Denegado                        |
| `technologies`            | Sí  | Denegado                        |
| `specialties`             | Sí  | Denegado                        |
| `work_principles`         | Sí  | Denegado                        |
| `impact_metrics`          | Sí  | Denegado                        |
| `media_assets`            | Sí  | Denegado                        |
| `media_references`        | Sí  | Denegado                        |
| `documents`               | Sí  | Denegado                        |
| `admin_profiles`          | Sí  | Denegado                        |
| `contact_messages`        | Sí  | Denegado                        |
| `analytics_events`        | Sí  | Denegado                        |
| `analytics_daily`         | Sí  | Denegado                        |
| `analytics_daily_content` | Sí  | Denegado                        |
| `admin_activity`          | Sí  | Denegado                        |
| `site_builds`             | Sí  | Denegado                        |

Además, `private.analytics_daily_dimensions`, `private.analytics_daily_sessions` y `private.rate_limit_buckets` tienen RLS y permisos de cliente revocados. El esquema private queda fuera de la API. `auth.users` pertenece a Supabase; las migraciones no modifican su estructura ni crean usuarios.

## Tipos, estados e integridad

Identidades principales UUID; joins con PK compuesta; agregados diarios con claves naturales. Sesiones diarias incluyen UUID técnico y unicidad `NULLS NOT DISTINCT` para impedir duplicados del ámbito site sin content_id. Todas las FK tienen índice cuyo prefijo cubre la FK. Los instantes son timestamptz, los períodos date y los valores de métricas text; números como `+15`, `24/7` o `-70%` son valores posibles, nunca logros sembrados.

CHECK sobre text conserva estados mantenibles sin recrear enums PostgreSQL:

| Recurso                 | Estados / valores                                              |
| ----------------------- | -------------------------------------------------------------- |
| projects.status         | concept, development, production, completed, archived          |
| projects.published      | Boolean independiente; exige published_at                      |
| posts.status            | draft, published, archived; published exige published_at       |
| contact_messages.status | new, read, replied, archived                                   |
| notification_status     | pending, sent, failed, disabled                                |
| site_builds.status      | queued, building, success, failed                              |
| media_assets.visibility | private, public                                                |
| media_assets.category   | project, blog, profile, document, general                      |
| admin_profiles.role     | owner; como máximo uno activo                                  |
| documents.type          | cv; como máximo uno activo                                     |
| robots_policy           | index,follow; noindex,follow; noindex,nofollow; index,nofollow |

Slugs únicos por recurso, de 1–120 caracteres, con patrón ASCII `^[a-z0-9]+(-[a-z0-9]+)*$`. Los UUID singleton conservan identidad estable y una columna true única limita settings/contact a una fila; el seed crea esa fila. No se impide temporalmente su ausencia al reconstruir.

Órdenes y contadores no negativos; reading_time y popular_rank positivos cuando existen. Fechas de experiencia ordenadas, current incompatible con end_date. La timezone se valida contra el catálogo PostgreSQL. URLs externas requieren HTTPS; renderizado/sanitización de Markdown se mantiene para F4/F8. Contacto exige email/número para hacerlos visibles y limita tamaños de mensajes. Timestamps updated_at avanzan incluso dentro de una misma transacción.

Un build building exige inicio; success exige inicio, fin, run/intento y deployment_id; failed exige fin y razón, y puede representar un fallo antes de iniciar. Un estado no terminal no admite completed_at. Se comprueban fechas y reintentos sin autorreferencia. La confirmación real con GitHub y la máquina de transiciones corresponden a F9/F11.

## Relaciones y borrado

- Proyectos → funcionalidades, galería, métricas, desafíos y joins: CASCADE editorial.
- Posts → categorías/tags mediante joins: CASCADE desde post; RESTRICT desde categorías/tags reutilizables.
- Experiencias → highlights y joins: CASCADE. El join experience_projects desaparece al eliminar cualquiera de sus padres.
- Tecnologías reutilizables: RESTRICT mientras existan joins.
- media_assets → todas las FK editoriales/documentos/referencias: RESTRICT. Borrar un proyecto elimina sus referencias, nunca el asset compartido.
- media_references tiene FK reales opcionales a project/post/settings/project_image/document y CHECK de exactamente un padre. entity_type/entity_id son derivados; UNIQUE(asset_id, entity_type, entity_id, field). Los usos Markdown se registran explícitamente; los usos de FK directas se sincronizan por trigger.
- auth.users → admin_profiles → created_by/admin_activity: RESTRICT para preservar identidad y auditoría.
- analytics_events conserva el evento al borrar contenido: SET NULL únicamente en sus FK de contenido.
- Los IDs históricos de analytics_daily_content, analytics_daily_sessions, admin_activity y site_builds no son joins vivos y no tienen cascade editorial.
- site_builds.retry_of conserva el build anterior mediante RESTRICT.

URLs y rutas de galería/documentos se derivan de media_assets por triggers. La ubicación/MIME del asset es inmutable: un reemplazo crea otro asset y reasigna la FK. Documentos CV exigen PDF; imágenes editoriales exigen MIME image/*. No hay una segunda fuente editable para cv_url: se recalcula desde el documento activo al modificar settings o documentos. La visibilidad y cv_enabled vuelven a comprobarse en el snapshot.

Las escrituras de contenido y sus relaciones deben agruparse en una transacción PostgreSQL para que también sean atómicos los triggers y referencias. F5 proporciona esta integridad; las RPC de edición autorizada con control de revisión pertenecen a la integración F6/F7 y no se expone una API de escritura antes de sus policies.

## Snapshot público v1

`public.get_public_snapshot()` usa una única sentencia SQL, STABLE, SECURITY INVOKER y search_path vacío. No existe SECURITY DEFINER ni fallback privilegiado. EXECUTE está revocado a los clientes hasta F6.

`loadPublicSnapshot(): Promise<PublicSnapshot>` utiliza el cliente anónimo de build y exactamente una RPC. Admite inyectar un cliente para pruebas. Los fallos de RPC/esquema abortan mediante excepción, sin devolver contenido alternativo ni revelar mensajes internos del servidor.

La respuesta contiene schema_version, generated_at, settings/contact singulares y colecciones normalizadas por recurso. Los hijos mantienen FK para agruparlos en DTO de página en F3/F4. Se conservan órdenes deterministas:

- Proyectos publicados, no archivados y con fecha no futura; hijos de esos proyectos.
- Posts publicados y no futuros; relaciones con categorías visibles y tags usados en posts públicos.
- Experiencia/tecnologías/redes/especialidades/principios/métricas visibles; joins filtrados por ambos extremos.
- Email/WhatsApp y sus textos solo cuando su bandera permite mostrarlos.
- Imágenes y documentos solo con media pública; el CV además requiere estar activo y habilitado en contacto.
- Assets/referencias únicamente usados por entidades presentes en el snapshot. Assets públicos huérfanos y galería privada se excluyen.
- No incluye owner, created_by, rutas internas de Storage, mensajes, eventos privados, builds, auditoría o borradores.

Las CTE seleccionan columnas explícitas antes de serializar; añadir una columna SQL no la publica automáticamente. `src/types/database.ts` se genera desde public/private. `src/types/content.ts` deriva tipos con Pick; `snapshot-contract.ts` y `parse-snapshot.ts` validan todas las colecciones y campos, UUID/fechas/enteros seguros, y rechazan columnas adicionales.

## Seed y pruebas

`supabase/seed.sql` contiene solamente identidad AL/Alonso Larenas, claim y textos base aprobados, seis especialidades, nueve categorías y cuatro principios. Contacto/disponibilidad deshabilitados, sin datos de contacto. Sin usuarios, claves, owner UUID, proyectos, posts, trayectoria ni estadísticas.

Los fixtures SQL están separados del seed productivo en `supabase/tests/schema.test.sql`, dentro de BEGIN/ROLLBACK. Incluyen identidades Auth efímeras, datos públicos/privados y permisos temporales de prueba; nada persiste. Se prueban RLS/grants cerrados, PK/FK/UNIQUE/CHECK, slugs, singleton, owner, CV, tipos de media, cascades, fechas, estados, timestamps, idempotencia y snapshot sin datos privados.

Las pruebas TypeScript cubren contrato, columnas privadas, errores HTTP, una sola RPC y ausencia de fallback privilegiado. El transporte HTTP se simula en esas unitarias; `db:snapshot:check` contrasta el parser con PostgreSQL real y repite el seed en rollback.

## Límites y pendientes por fase

- F6: policies/grants, owner real, Auth y autorización de RPC/Storage; sin esto el snapshot no es consumible por anon mediante la API.
- F3/F4: conectar las páginas al loader, DTO de presentación por página y sanitización Markdown. El build actual sigue validando el fixture aprobado de F2.
- F8: registrar los enlaces de Markdown, validar los bytes/MIME reales, publicar/copiar archivos y controlar sus URLs. Las FK de referencias ya protegen usos registrados; F5 no analiza texto Markdown para descubrir enlaces.
- F9/F10/F11: ejecución atómica de rate limits, HMAC/retención/agregación de eventos, tracking, notificaciones, validación externa de builds y reconciliación. F5 entrega únicamente las estructuras.
- PostgreSQL remoto y políticas reales pendientes de verificación antes de desplegar; Automatic RLS permanece sin cambios.
