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

**Checkpoint completado; baseline y owner remoto verificados.** La puerta previa quedó registrada en `253533e`, las pruebas/evidencia posterior en `374b6ed` y la parada para alta manual en `18f4bf9`. El usuario confirmó después la creación del owner. Inmediatamente antes del despliegue se volvieron a verificar proyecto, enlace, catálogo remoto, PostgreSQL e historial ausente.

`supabase db push --linked --skip-vault --yes` terminó con exit code 0 el 2026-09-06 a las 15:09:35 UTC. Aplicó únicamente 019. El historial real registra 20260906001900, nombre initial_portfolio y 527 sentencias; no aparecen pendientes las fuentes archivadas. No se ejecutó migration repair. [Push](initial-deploy/push.json), [historial inmediatamente posterior](initial-deploy/post-history.json).

La auditoría posterior comprobó 32 tablas public y 3 private, 4 vistas, 256 constraints, 99 índices y 138 policies. Las 14 secciones del catálogo coinciden estructuralmente con local; una comparación inicial por texto JSON detectó diferencias de orden de claves, resueltas usando igualdad estructural sin eliminar campos, valores ni orden de arrays. No hubo cambios SQL. [Catálogo remoto](initial-deploy/post-catalog.json), [drift](initial-deploy/drift.json), [permisos](initial-deploy/security.json).

Las 35 tablas propias tienen RLS. Automatic RLS conserva función, owner, ACL y event trigger. Funciones SECURITY DEFINER propias: private.is_portfolio_admin, private.read_public_contact y private.read_public_media; owner postgres y search_path vacío en las tres. La primera permite EXECUTE a authenticated, no a anon; las proyecciones públicas permiten ejecución a los roles de lectura previstos, sin exponer private como schema API. No se añadieron funciones definer.

Buckets reales: portfolio-public, blog y documents públicos; private privado. Límite 10 MiB en todos. Los dos buckets de imágenes admiten JPEG/PNG/WebP/AVIF, documents PDF, private imágenes y PDF. Policies Storage: portfolio_public_objects SELECT; portfolio_owner_objects_read SELECT; portfolio_owner_objects_insert INSERT; portfolio_owner_objects_delete DELETE. No existe policy UPDATE/upsert/move para el owner. La FK RESTRICT hacia objects.id protege objetos registrados; no se modificó la estructura administrada de Storage.

## Seed y pruebas anónimas

El push no ejecutó seed. Después de informar el alcance se aplicó supabase/seed.sql versionado dentro de una transacción mediante CLI: **21 registros**, un site_settings, un contact_settings vacío, nueve categorías, seis especialidades y cuatro principios. Sin Auth, owner, proyectos, posts, experiencias, métricas ni archivos. Idempotencia verificada localmente. [Seed y hash](initial-deploy/seed.json).

`node scripts/check-remote-anon.mjs --initial-deploy-checkpoint` ejecutó **28 comprobaciones API remotas** con publishable key y sin sesión administrativa. loadPublicSnapshot validó la respuesta real con el DTO existente. Settings/categorías/especialidades/principios/contacto públicos accesibles; INSERT/UPDATE/DELETE editorial y creación de admin_profile denegados por 42501; lecturas privadas denegadas; helper privado no expuesto como RPC ni schema; listado privado sin datos y upload PNG válido rechazado. No persistieron objetos ni filas de prueba. [Resultados](initial-deploy/anon.json).

Las 28 comprobaciones iniciales no pretendían demostrar filtros sobre borradores inexistentes. Esa limitación quedó resuelta en la etapa posterior: las sesiones reales consultaron proyectos publicados/draft, hijos de ambos, posts publicado/draft/futuro y tecnologías visibles/ocultas creados expresamente para la prueba. Todos los fixtures se eliminaron.

## Tipos y reconstrucción posterior

La CLI regeneró tipos desde remoto. La única diferencia textual es Database.__InternalSupabase.PostgrestVersion = '14.5', anotación del servicio que el generador local no emite. SupabaseClient trata esa propiedad como opción de versión del cliente, separada de los schemas. Excluyendo únicamente ese bloque exacto y sus dos comentarios, coinciden los tipos de tablas, relaciones y funciones. Se conserva database.ts generado desde PostgreSQL local; no se cambió código de aplicación ni SQL por una diferencia ambiental. [Comparación y hashes](initial-deploy/types.json).

Después del deploy se reconstruyó localmente desde vacío, restauró el respaldo previo e instaló 019/seed. Se repitieron 613 pruebas SQL, 107 Auth/RLS, 66 Storage/media y 9 PK; lint SQL, tipos y snapshot correctos. Catálogo final idéntico a remoto, fixtures limpios. [Reconstrucción final](initial-deploy/local-post-deploy.json), [validaciones previas](initial-deploy/local-validations-pre-push.json), [últimas validaciones](initial-deploy/local-validations.json).

## Auth y alta segura del owner

Se modificaron únicamente controles soportados de Auth en el dashboard del proyecto verificado. Signup deshabilitado; el endpoint real devuelve HTTP 422 / signup_disabled sin crear usuario. Email/password permanece habilitado, confirmación de email activa, sign-in anónimo y linking manual deshabilitados.

Site URL: `https://alarenas1988.github.io/portfolio-alonso/`.

Redirect URLs exactas, sin comodines:

- `https://alarenas1988.github.io/portfolio-alonso/admin/`
- `https://alarenas1988.github.io/portfolio-alonso/admin/reset-password/`
- `http://localhost:4321/portfolio-alonso/admin/`
- `http://localhost:4321/portfolio-alonso/admin/reset-password/`

Actualizar estas URLs al configurar dominio propio. Las pantallas finales de login/recovery todavía no están implementadas; la allowlist no crea esas páginas. [Configuración y prueba signup](initial-deploy/auth.json).

**Intervención completada por el usuario:** creó personalmente su cuenta en portfolio-alonso → Authentication → Users → Add user → Create new user y confirmó «owner creado». Se comprobó una única cuenta Auth con email confirmado y cero admin_profiles. No se leyó ni cambió su contraseña; no se registra correo, UUID ni credenciales en la evidencia.

Se ejecutó una sola vez [bootstrap-remote-owner.sql](../../scripts/bootstrap-remote-owner.sql), mediante CLI administrativa enlazada. La transacción bloquea admin_profiles, exige exactamente una cuenta Auth confirmada y ningún perfil, selecciona su identidad dentro de PostgreSQL e inserta role='owner', active=true y nombre aprobado. Con claims de esa identidad y rol authenticated, private.is_portfolio_admin() devolvió true y se leyó exactamente un owner activo. El script no es una migración ni se vuelve a ejecutar sobre un owner existente. [Bootstrap sin identidad expuesta](initial-deploy/owner-bootstrap.json).

## Sesiones reales y pruebas remotas finales

`node scripts/check-remote-owner.mjs --initial-deploy-checkpoint` requiere invocación operacional explícita, enlace correcto, historial exclusivamente 019, un único owner y ausencia de contenido editorial previo. No forma parte de npm test ni de un deploy automático. Sus guardas impiden reutilizarlo sobre un portfolio con contenido. No se cambiaron los wrappers que restringen las suites existentes a localhost.

La credencial administrativa existente se obtuvo por CLI autenticada, exclusivamente en memoria. Se usó solo para preparar Auth/fixtures y limpieza, nunca como credencial de las operaciones cuya autorización se probó. Para el owner definitivo se generó un enlace administrativo de sesión, se verificó su token en memoria y se usó el JWT real emitido por Auth. generateLink no envía correo por sí mismo; no se utilizó recovery ni se pidió contraseña. Los dos usuarios temporales noowner/inactivo se crearon por Auth Admin con contraseñas aleatorias en memoria y sesiones email/password reales. [Generación administrativa](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [verificación OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp).

**139 comprobaciones correctas: 91 Auth/RLS/snapshot y 48 Storage/media.** [Resultados detallados](initial-deploy/owner-smoke.json).

| Actor                 | Lectura pública | Draft/futuro/hijo privado | CRUD editorial                   | Datos privados                                    | Administración Storage                                 |
| --------------------- | --------------- | ------------------------- | -------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| anon                  | Permitida       | Sin filas                 | Denegado                         | Denegado                                          | Denegada                                               |
| authenticated noowner | Permitida       | Sin filas                 | Sin filas afectadas / 42501      | Sin filas                                         | Denegada                                               |
| owner inactivo        | Permitida       | Sin filas                 | Sin filas afectadas / 42501      | Sin filas                                         | Denegada                                               |
| owner activo          | Permitida       | Lectura administrativa    | CREATE/UPDATE/DELETE comprobados | Lectura permitida, incluido mensaje temporal real | Upload/list/metadata/publicación/replace/delete seguro |

Las pruebas negativas incluyen UUID conocido, reasignación de FK, manipulación de user_metadata seguida de refresh real, creación de otro owner, cambio de role/active/id, lectura mediante vista y llamada directa a schema/RPC privado. Incluso el owner no puede cambiar sus atributos de autorización ni crear otro owner desde el navegador. Ningún resultado depende de guards de UI.

loadPublicSnapshot validó el DTO para los cuatro roles. Cada snapshot incluyó exactamente un proyecto público, un post publicado en el pasado y una tecnología visible; ninguno incluyó los sentinels privados, draft/futuro, mensaje ni tecnología oculta. Las respuestas fueron estructuralmente iguales tras excluir únicamente generated_at. La lectura administrativa privada se comprobó por separado.

Storage real recibió PNG sintéticos de 8×6 píxeles. Se probaron upload privado, UUID de Storage registrado en metadata, signed preview de 60 segundos, ausencia de descarga pública privada, publicación explícita con otro UUID y bytes públicos correctos. Anon/noowner/inactivo no pudieron listar, descargar, firmar, subir, actualizar, hacer upsert, mover ni eliminar objetos protegidos. También se rechazaron upsert/move del owner.

Un asset tuvo tres referencias: imagen de proyecto y Markdown de proyecto/post. deleteMedia informó uso activo; la llamada directa a Storage API también falló por la FK UUID RESTRICT y el objeto permaneció. replaceMedia trasladó las tres referencias a un UUID nuevo conservando el anterior hasta retirarlo. Después de desvincular, el borrado controlado retiró metadata y bytes correctamente. Metadata con un UUID Storage inexistente falló por 23503; un objeto sin metadata apareció en el reporte de huérfanos y se eliminó explícitamente. Snapshot media devolvió solo el asset público referenciado, sin signed URLs.

La limpieza dirigida eliminó proyectos/posts/tecnologías/mensaje/referencias/media/objetos y las dos cuentas Auth temporales. Se cerró solamente la sesión de prueba del owner usando scope='local', preservando sus otras sesiones. El refresh token se revoca; un JWT ya emitido expira según su plazo normal. Ningún token o signed URL se persistió. El manifiesto de recuperación local ignorado contiene solo identidades de fixtures y rutas, sin identidad del owner ni credenciales. [Semántica de signout](https://supabase.com/docs/guides/auth/signout).

## Estado final y límites

El [estado final](initial-deploy/final-state.json) confirma un Auth user definitivo, un admin_profile owner activo, 21 filas base y cero fixtures editoriales, mensajes, referencias, metadata u objetos Storage. Las 14 secciones de catálogo siguen coincidiendo con local, 35 tablas con RLS, tres definer propias seguras, Automatic RLS intacto e historial exclusivamente 019. El [estado anterior a la intervención](initial-deploy/owner-handoff.json) y auth.json se conservan como evidencia histórica; su conteo anterior de cero owners ya no representa el estado final.

No hay migraciones correctivas, cambios de código de aplicación, dependencias nuevas ni una segunda ejecución del push. La reconstrucción completa posterior al despliegue y sus suites locales siguen siendo válidas: el bootstrap y los fixtures no modificaron el esquema. Los scripts y documentos finales se verifican con formato, lint, typecheck, tests, build y controles estáticos/secretos. No se añade UI en este checkpoint; E2E no requiere nueva ejecución por estos cambios operacionales.

En la continuación se repitieron format:check, lint, typecheck (59 archivos, cero diagnósticos), check:secrets (ocho artefactos) y git diff --check. Una comprobación adicional confirmó que las credenciales existentes y la identidad del owner no aparecen en 200 archivos del repositorio/build. Las suites completas anteriores corresponden al mismo baseline y código de aplicación; no se presentan como nuevas ejecuciones después del bootstrap. [Validación de esta continuación](initial-deploy/owner-validations.json).

Commits de operación: `253533e` puerta previa; `374b6ed` verificación posterior y anon; `18f4bf9` alta manual pendiente; `f977ca6` bootstrap seguro; `543a0c2` matriz remota y media. El cierre documental se registra con `docs: close controlled Supabase deployment checkpoint`. [Inventario de archivos de toda la rama](initial-deploy/files.json). Ningún archivo de aplicación ni migración se modificó.

Quedan como límites conocidos las pantallas futuras de login/recovery, actualizar URLs cuando exista dominio propio y gestionar backups de bytes además del respaldo lógico. No se dispone aquí de restauración gestionada del plan Free. Estas limitaciones no se sustituyen por nuevas funcionalidades.

No se inició F3/F4/F7/F9/F10/F11/F12/F13/F14. No hay PR ni merge de esta rama. Sin CV, capturas ni contenido final; migraciones, estructura administrada Storage y Automatic RLS conservados.
