# Registro de fases

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
