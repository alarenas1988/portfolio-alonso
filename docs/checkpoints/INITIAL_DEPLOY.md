# Primer despliegue controlado de Supabase

Fecha: 2026-09-06. Rama `chore/supabase-initial-deploy`, worktree nuevo desde `origin/main` **d3b5d0f671aa783c09d59760a68b466aded5662f**. Contiene F1/F2/F5/F6/F8 y el baseline aprobado mediante PR #7. Este checkpoint no inicia otra fase funcional.

## Puerta previa

- Proyecto confirmado por CLI y `.env.local`: portfolio-alonso, sa-east-1, ACTIVE_HEALTHY; valores de conexión omitidos. CLI 2.116.0 autenticada y enlace comprobado en el nuevo worktree.
- PostgreSQL remoto 17.6, imagen 17.6.1.166. Catálogo de aplicación, Storage y Automatic RLS idéntico al checkpoint aprobado; historial de aplicación ausente, cero tablas propias/buckets/objetos/usuarios Auth.
- Auth previo: signup habilitado, email/password habilitado, confirmación de email activa, sign-in anónimo y linking manual deshabilitados. Site URL `http://localhost:3000`; redirects vacíos.
- SQL activo: únicamente `20260906001900_initial_portfolio.sql`, SHA-256 `e9de91bbee5851c12d898269584c25782846d2a9f2fb949d5ded4fc72b78e0c9`. Comparación completa con el generador y las fuentes archivadas: idéntico al SQL aprobado.
- Dry-run final `supabase db push --linked --dry-run --skip-vault`: solo 019; sin seed, roles ni Vault. Revisión forward sobre el respaldo restaurado: ningún objeto preexistente eliminado, sin ALTER estructural de tablas auth/storage, sin FK compuesta ni desactivación de RLS. Las sustituciones internas afectan objetos recién creados dentro de la transacción de 019.

## Respaldo y recuperación

Respaldo nuevo fuera de Git en `%LOCALAPPDATA%/portfolio-alonso/backups/20260906-initial-deploy`, accesible únicamente por el usuario Windows actual, SYSTEM y Administrators. El [manifiesto](initial-deploy/backup-manifest.json) registra tamaños, hashes y ensayo real, sin secretos.

Se conservaron roles.sql, schema.sql, data.sql completo, data-restorable.sql y automatic-rls-event.sql. Este último conserva el event trigger que el dump estándar omite. La configuración Auth y el inventario de Storage se registran por separado. No hay historial de aplicación previo que respaldar.

El primer ensayo del dump completo falló por `permission denied for table buckets_vectors` y revirtió toda su transacción local. Se conservó el error y el dump original. La variante restaurable usa las exclusiones oficiales `--exclude storage.buckets_vectors --exclude storage.vector_indexes`; ambas tablas están vacías, existían en la inspección anterior y no pertenecen al portfolio. No se cambiaron sus permisos ni estructuras. [Procedimiento oficial de Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

La restauración posterior se ensayó desde plataforma local vacía con roles, esquema, datos restaurables y suplemento Automatic RLS. Se verificó previamente el permiso administrado de log_min_messages y se alinearon los defaults de secuencias del template local con el origen, como en el checkpoint aprobado. El catálogo completo coincidió con el remoto; una tabla canaria creada dentro de una transacción revertida confirmó Automatic RLS. Después se instaló 019 y el seed local.

El plan Free no ofrece aquí una restauración gestionada disponible. El respaldo lógico requiere un destino Supabase compatible y una intervención administrativa; los bytes futuros de Storage y la configuración Auth del servicio requieren respaldo propio. No se presenta el inventario como sustituto del dump. [Backups de Supabase](https://supabase.com/docs/guides/platform/backups).

Si 019 falla, conservar el error completo y consultar historial/catálogo antes de decidir recuperación; no reparar el historial manualmente ni repetir fixes ad-hoc. Para volver al estado previo después de una instalación confirmada, usar el respaldo ensayado y configuración registrada en un destino compatible bajo un procedimiento de recuperación revisado. No se autoriza un DROP masivo de producción como rollback automático.

## Validación inmediata local

Se reconstruyó el stack loopback `portfolio-alonso-baseline-local` desde este worktree actualizado, sin desarrollar desde worktrees anteriores. API 58421 y DB 58422. Se restauró el respaldo previo y se aplicaron exclusivamente 019 y el seed autorizado. Todos los fixtures quedaron eliminados.

- 613 pruebas SQL, 107 comprobaciones Auth/RLS, 66 Storage/media, 9 comprobaciones PK/Storage y 87 pruebas unitarias correctas.
- db lint sin errores; tipos locales idénticos a `src/types/database.ts`; snapshot real compatible con DTO y seed idempotente.
- npm ci: 407 paquetes; npm ls y npm audit --audit-level=high correctos, cero vulnerabilidades. Lint, typecheck, build, salida estática y escaneo de secretos correctos.
- Auditoría: 32 tablas public y 3 private, todas con RLS; 138 policies y tres funciones SECURITY DEFINER propias. Automatic RLS de plataforma se conserva y audita por separado.

Evidencia: [validaciones](initial-deploy/local-validations.json), [revisión forward](initial-deploy/forward-review.json), [dry-run](initial-deploy/dry-run.json), [catálogo previo](initial-deploy/pre-catalog.json), [inventario](initial-deploy/pre-inventory.json), [plataforma](initial-deploy/pre-platform.json) y [Auth previo](initial-deploy/pre-auth.json).

## Estado de ejecución

La aplicación efectiva se registra aquí después de comprobar nuevamente el proyecto y el estado remoto. Seed, configuración Auth, owner y pruebas posteriores se documentarán con sus resultados reales. No hay PR ni merge automático de esta rama.
