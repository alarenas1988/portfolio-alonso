# Checkpoint backend: inspección previa, despliegue detenido

Fecha: 2026-09-06. Base: `origin/main` en `e8a4750097cbb6a7c85e01ce36cf91c3f38a4185`.
Rama: `chore/supabase-remote-readiness`. Worktree: `.worktrees/supabase-remote-readiness`.
F8 ya estaba integrada mediante PR #5. Se verificaron los ancestros F1/F2/F5/F6/F8, `main` limpio y sincronización `--ff-only`. Este checkpoint no vuelve a integrar F8 ni inicia otra fase.

## Resultado de la puerta de despliegue

**NO APTO PARA PUSH TODAVÍA. No se modificó Supabase remoto.**

La versión PostgreSQL coincide, pero la revisión de Storage mantiene una dependencia bloqueante: `media_assets_storage_object_fk` referencia un índice único administrado que no es la PK. Además faltan autenticación de CLI, volcado restaurable, diff generado y validación final de la corrección. No se considera aprobada la compatibilidad completa por coincidir las versiones.

Se detuvo la aplicación conforme a las condiciones de parada del checkpoint. No se alteró la FK existente en local ni se aplicó una migración correctiva sin validarla. La propuesta siguiente es diseño pendiente, no una garantía ya implementada.

## Proyecto y evidencia previa

Proyecto observado: **portfolio-alonso**, región **sa-east-1 / São Paulo**, plan **Free**. La URL configurada en `.env.local` coincide con el proyecto del dashboard; no se incluyen sus valores ni claves.

| Componente              | Local F8, consultado sin cambios                                                        | Remoto, consultado sin cambios                                 |
| ----------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| PostgreSQL              | 17.6, imagen 17.6.1.165                                                                 | 17.6, imagen 17.6.1.166                                        |
| Supabase CLI            | 2.116.0, fijada en package/lock                                                         | Herramienta de despliegue local; no es la versión del servicio |
| Auth                    | Configuración versionada en config.toml                                                 | 2.196.0                                                        |
| PostgREST               | Stack local existente                                                                   | 14.5                                                           |
| Extensiones instaladas  | pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1 | Mismas extensiones y versiones                                 |
| Historial de aplicación | 17 migraciones versionadas                                                              | `supabase_migrations.schema_migrations` no existe              |
| Tablas de aplicación    | 32 public + 3 private                                                                   | Ninguna; esquema private ausente                               |
| Storage                 | Cuatro buckets locales de F8                                                            | Ningún bucket ni objeto                                        |
| Automatic RLS           | No incorporado por las 17 migraciones                                                   | `ensure_rls` habilitado, `public.rls_auto_enable()`            |

Inventario remoto: esquemas auth, extensions, graphql, graphql_public, information_schema, public, realtime, storage y vault. Auth y Storage pertenecen a sus roles administrados. `storage.objects` tiene RLS habilitado. No existen policies en los esquemas public/private/auth/storage inspeccionados. No existen vistas en los esquemas public/private/auth/storage/graphql_public inspeccionados. La única función de public es la función de evento de Automatic RLS. No hay usuarios Auth.

Storage registra 65 migraciones internas, IDs 0–64; última `fix-search-by-timestamp-sqli`. Estas migraciones y las de Auth pertenecen a la plataforma, no son migraciones pendientes del portfolio. El catálogo completo de extensiones disponibles, columnas de objects, triggers, ACL por defecto y versiones internas se conserva en JSON.

- [Catálogo remoto](remote-preflight-catalog.json): consulta `scripts/audit-remote-readiness.sql` dentro de `BEGIN READ ONLY` y `ROLLBACK`.
- [Detalles administrados](remote-preflight-details.json): consulta `scripts/audit-remote-platform.sql`, también de solo lectura.
- [Ajustes observados en dashboard](remote-preflight-settings.json).
- [API pública, estado previo](remote-preflight-api.json): dos GET, sin escrituras ni fixtures.
- [Inventario de las 17 migraciones](migration-review-inventory.json): SHA-256 del SQL versionado normalizado a LF y eliminaciones DDL identificadas.

Estos archivos son evidencia de comparación, **no un backup restaurable de la base completa**. No contienen filas Auth, contraseñas, claves ni tokens.

## Revisión crítica de Storage

La migración `20260906001400_storage_buckets.sql` crea en nuestra tabla:

```sql
foreign key (storage_bucket, storage_path)
references storage.objects (bucket_id, name)
on delete restrict on update restrict
```

Su objetivo es impedir que la Storage API retire un objeto registrado, incluso si el caller evita los servicios/UI, y coordinar registros/borrados concurrentes mediante integridad referencial. El índice referenciado es `bucketid_objname`, presente con idéntica definición local/remota; la PK administrada es `objects_pkey(id)`.

Supabase permite crear FK hacia tablas administradas, pero distingue esto de garantizar la estabilidad de cualquier índice. Su documentación recomienda usar PK para referencias a tablas administradas y advierte que otros índices/columnas pueden cambiar. Por tanto, la FK compuesta actual es ejecutable hoy, pero **no se acepta como dependencia estable para el primer despliegue**. [Permisos permitidos](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025), [estabilidad de referencias](https://supabase.com/docs/guides/auth/managing-user-data).

| Situación                                                           | Efecto de la FK actual                                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Upgrade o migración interna que sustituye el índice                 | Puede quedar bloqueada por nuestra dependencia; no usar DROP CASCADE para forzarla.                                                              |
| Restauración de metadata editorial sin catálogo Storage equivalente | Puede fallar la carga por ausencia de los objetos referenciados.                                                                                 |
| Borrado vía Storage API                                             | La FK busca bloquear el borrado mientras exista metadata; se requiere volver a probar el comportamiento del servicio real después de corregirla. |
| Restauración solo PostgreSQL                                        | No recupera los bytes retirados de Storage; la FK tampoco prueba que los bytes existan.                                                          |
| Cambios internos de columnas o versionado                           | Pueden invalidar la identidad compuesta asumida por la aplicación.                                                                               |

**Corrección propuesta, pendiente de implementación/revisión:** retirar la dependencia del índice compuesto; conservar las FK editoriales hacia `media_assets` y los triggers de referencias/Markdown; evaluar una protección de eliminación mediante Storage RLS y estado de ciclo de vida propio. Debe bloquear DELETE directo de objetos registrados, mantener rutas inmutables y resolver la carrera entre registro y borrado. Una comprobación de uso únicamente en TypeScript o un simple `NOT EXISTS` sin demostrar concurrencia no bastan. Si se justifica mantener una FK, la alternativa a evaluar es la PK `storage.objects.id`, con el coste y dependencia explícitos y pruebas de restauración.

La corrección no debe alterar la estructura de `storage.objects`, retirar protección para hacer pasar tests, ni añadir una migración posterior que deje aplicar primero la FK rechazada durante el primer push. El historial remoto vacío permite preparar expresamente el SQL inicial antes de desplegar; los entornos locales existentes necesitan su transición reproducible. [Contrato del esquema Storage](https://supabase.com/docs/guides/storage/schema/design).

La creación de buckets mediante SQL está documentada como soportada. El INSERT/ON CONFLICT de 014 solo configura cuatro buckets, pero antes de usarlo se debe repetir la inspección para evitar sobrescribir cambios que aparezcan después de este checkpoint. No existen conflictos de bucket ahora. [Creación de buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

## Revisión estática de las migraciones en orden

Todas tienen transacción propia. La revisión del SQL versionado no sustituye el dry-run/diff ni la reconstrucción final de una corrección.

| Sufijo                     | Revisión y dependencias                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 001 base                   | private, defaults restrictivos, helpers, admin_profiles → auth.users PK; RLS explícito. Sin conflicto de nombres observado.        |
| 002 media_settings         | Media antes de referencias; singletons, CV, configuración/contacto/redes; CHECK, RLS, revocaciones.                                |
| 003 content                | Contenido/taxonomías/perfil; UUID, slugs ASCII, fechas, estados, visibilidad y FK a media.                                         |
| 004 relations              | Hijos y joins después de padres; cascades editoriales; media reutilizable RESTRICT; referencias generadas.                         |
| 005 operations_analytics   | Operación y tres tablas private; UNIQUE NULLS NOT DISTINCT disponible en PG17; historial sin cascades editoriales indiscriminados. |
| 006 integrity              | Triggers de URL/referencias/updated_at, índices FK/parciales; no DDL en tablas administradas.                                      |
| 007 public_snapshot        | Contrato invoker inicial, EXECUTE cerrado hasta F6.                                                                                |
| 008 owner_authorization    | Tres definers private revisados; owner por UUID/perfil active/role; vistas de proyección.                                          |
| 009 content_rls            | SELECT con publicación/visibilidad y padres; escrituras con owner en USING/WITH CHECK; metadata de autor protegida.                |
| 010 private_data_rls       | Lectura privada owner, status de mensajes; escrituras operativas explícitas service_role; vistas invoker.                          |
| 011 public_snapshot_access | Proyecciones públicas bajo RLS, filtro temporal incluso para owner; grants anon/authenticated.                                     |
| 012 public_media_cache     | URLs privadas anuladas, CV visible; UPDATE de caches propios, sin registros preexistentes remotos que recalcular actualmente.      |
| 013 storage_policies       | Assert RLS administrado, grants DML, policies por owner/bucket/ruta. No ALTER de storage.objects.                                  |
| 014 storage_buckets        | Buckets 10 MiB/MIME, UUID inmutable, retirada UPDATE; **FK compuesta bloqueante**.                                                 |
| 015 media_lifecycle        | CHECK media/alt/decorative, CV único parcial, tecnología/Markdown, RPC invoker; SET EXPRESSION requiere PG17 y remoto cumple.      |
| 016 media_public_contract  | Recrea proyección/policies dependientes dentro de transacción; snapshot decorative/iconos/documentos y filtro específico CV.       |
| 017 media_api_integrity    | WHERE singleton para pg-safeupdate; bloqueo adicional de DELETE cuando persiste referencia Markdown.                               |

Se identificaron DROP esperados de una policy UPDATE propia de Storage (014), tres CHECK y un índice propios que se sustituyen (015), y tres policies, una vista y una función propias que se recrean (016). No se encontró DROP TABLE/SCHEMA, TRUNCATE, desactivación RLS ni ALTER TABLE de auth/storage en el SQL versionado. Esto **no significa que exista ya un diff remoto aprobado**.

## SECURITY DEFINER y drift previo

Las tres funciones propias observadas en local pertenecen a postgres y fijan `search_path=''`:

| Función                       | Justificación y acceso                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| private.is_portfolio_admin()  | Lee admin_profiles sin recursión RLS; auth.uid, active y owner. EXECUTE authenticated, sin parámetros controlables de autorización. |
| private.read_public_contact() | Proyección fija y enmascarado de contacto oculto; EXECUTE anon/authenticated a través de vista; sin SQL dinámico.                   |
| private.read_public_media()   | Proyección fija, visibility public, sin created_by; EXECUTE anon/authenticated mediante vista.                                      |

Las RPC get_public_snapshot, replace_media_asset y activate_cv son INVOKER; las dos administrativas comprueban owner explícitamente. La concesión EXECUTE a helpers private no hace de ese esquema una API pública; la configuración remota de schemas expuestos todavía requiere comprobación final.

El remoto añade `public.rls_auto_enable()` SECURITY DEFINER, owner postgres, search_path pg_catalog, retorno event_trigger y trigger ensure_rls habilitado para CREATE TABLE/CREATE TABLE AS/SELECT INTO en public. ACL NULL implica el EXECUTE por defecto de PostgreSQL; no es una RPC ordinaria. Su función/trigger son preexistentes, coinciden con la opción que el usuario indicó haber habilitado y se conservan. No se ha probado todavía su interacción con toda la reconstrucción local ni generado el diff que los preserve.

No se observaron tablas/editorial/policies manuales que colisionen con el portfolio. Automatic RLS y ACL administradas son diferencias preexistentes que deben reconocerse en el diff, no borrarse como objetos ajenos a las migraciones.

## Auth y Storage actuales, sin cambios

- Signup público: **habilitado**; requiere desactivación antes de considerar listo el backend. Email habilitado y confirmación de correo activa; anonymous sign-ins deshabilitado.
- Site URL real: `http://localhost:3000`.
- Redirect URLs reales: lista vacía.
- Owner: no creado; cero usuarios Auth y admin_profiles todavía no existe.
- Storage: sin buckets/policies propias; límite global Free mostrado como 50 MB, transformaciones remotas no habilitadas. El pipeline Sharp local no necesita ese servicio de transformación.

Configuración prevista, todavía **no aplicada**: Site URL `https://alarenas1988.github.io/portfolio-alonso/`; redirects exactos de admin y recovery bajo esa base, más `http://localhost:4321/portfolio-alonso/`, `/admin/` y `/admin/reset-password/` de desarrollo cuando proceda. No añadir wildcards. Las páginas físicas admin/recovery aún pertenecen a trabajo posterior; configurar una URL no crea esas páginas. No enviar invitaciones/recovery hacia una página inexistente.

El bootstrap owner sigue pendiente: el usuario debe elegir correo y establecer contraseña por canal seguro. No se deduce el owner del correo de su cuenta del dashboard ni se inventan credenciales. Después del esquema validado, crear Auth administrativamente y vincular su UUID únicamente en una operación segura; nunca versionarlo.

## Backup, CLI, diff y recuperación

El dashboard confirma que el plan Free no incluye backups restaurables. Antes de modificar remoto es necesario producir un volcado lógico verificable, almacenado fuera de Git con acceso restringido, y conservar configuración Auth/Storage y el inventario previo. Los backups PostgreSQL no contienen bytes de Storage. No se cambió el plan ni se inició una restauración. [Backups de Supabase](https://supabase.com/docs/guides/platform/backups).

`supabase projects list --output json` falla porque no existe access token de CLI. `.env.local` aporta configuración pública, no acceso administrativo. No se extrajeron cookies, tokens de sesión del navegador ni contraseñas. El dashboard permitió solo las consultas de auditoría y lectura de ajustes.

Paso requerido para habilitar el trabajo CLI: ejecutar interactivamente `npx supabase login` desde este worktree usando Node fijado; autenticarse con la cuenta que administra portfolio-alonso. No pegar tokens/contraseñas en la conversación. Luego se podrá enlazar el proyecto identificado, obtener el volcado y generar diff/dry-run. Un posible requerimiento posterior de contraseña DB debe resolverse mediante el prompt seguro, no argumentos/logs.

El help de **2.116.0** confirma que `db push` incluye seed solo con `--include-seed`. También indica que puede actualizar Vault desde config salvo `--skip-vault`; el despliegue futuro de este checkpoint deberá usar `--skip-vault` para mantener el alcance exclusivo de migraciones. No se ejecutó push, dry-run enlazado, seed ni fixtures remotos.

Recuperación prevista: detener al primer fallo, conservar estado/migration history y no volver a ejecutar a ciegas. Cada archivo confirmado puede haber quedado aplicado aunque un archivo posterior falle. Preferir corrección versionada; cualquier restauración/desmontaje debe revisarse contra el backup previo y nunca tocar catálogos administrados por DROP CASCADE. Sin volcado restaurable y ensayo de restauración, la puerta de despliegue permanece cerrada.

## Pruebas y tareas pendientes

GET de Auth settings: 200, confirma signup habilitado. GET de RPC get_public_snapshot con clave pública: 404/PGRST202, función todavía ausente. **No es un test RLS aprobado**: no hay esquema de aplicación desplegado. No se intentaron INSERT/UPDATE/DELETE ni se crearon fixtures remotos.

Pendientes: corrección Storage y pruebas de concurrencia; reconstrucción local vacía con seed, SQL/RLS/Auth/Storage/media/snapshot; diff revisado; backup restaurable; configuración Auth controlada; push; seed si procede; owner elegido; matriz real anon/noowner/inactivo/owner; media temporal con limpieza; tipos remoto/local; drift posterior. Los resultados históricos F8 (605 SQL, 106 Auth, 55 media) permanecen históricos y no se presentan como revalidación final de este checkpoint.

Las validaciones ejecutadas en esta entrega de auditoría se registran en PHASE_LOG. Solo cambian consultas de inspección, evidencia y documentación; no se modificaron migraciones ni código funcional. No hay PR/merge del checkpoint ni fases F3/F4/F7/F9/F10/F11 iniciadas.
