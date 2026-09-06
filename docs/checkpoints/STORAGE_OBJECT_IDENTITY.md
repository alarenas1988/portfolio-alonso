# Corrección de identidad Storage — validación local

Fecha: 2026-09-06. Rama: `chore/supabase-remote-readiness`. Sin despliegue remoto.

## Causa raíz y decisión

La FK de F8 enlazaba `media_assets(storage_bucket,storage_path)` con `storage.objects(bucket_id,name)`. PostgreSQL la admitía gracias al índice UNIQUE administrado `bucketid_objname`, pero ese índice no es la PK y puede cambiar con el servicio. La prueba `storage_identity.test.sql` se ejecutó antes de corregirlo: falló con **1 referencia no-PK; esperado 0**.

La inspección local confirma `storage.objects.id uuid NOT NULL DEFAULT gen_random_uuid()`, PK `objects_pkey(id)`. El catálogo también tiene bucket_id/name text, owner_id text, metadata jsonb, fechas, información de versión y path_tokens generado; `bucketid_objname` continúa siendo UNIQUE. No cambiamos ninguna de esas columnas, índices, constraints ni triggers administrados. [Catálogo inspeccionado y prueba API](local-storage-identity-probe.json).

La estrategia final es una **FK física exclusivamente desde nuestra tabla hacia la PK UUID**, con ON UPDATE RESTRICT y ON DELETE RESTRICT. La alternativa UUID sin FK no se utilizó: la prueba API no mostró incompatibilidad con la FK restrictiva. Supabase recomienda PK para referencias a tablas administradas; esta decisión no presupone estabilidad de otros índices. [Referencia oficial](https://supabase.com/docs/guides/auth/managing-user-data).

## Hipótesis demostrada antes de la migración

`npm run test:storage:identity:local` crea un registro experimental en private con FK a la PK, protegido por RLS y sin grants API. El registro se retira al finalizar. Los archivos se crean, copian, descargan y eliminan exclusivamente mediante Storage API; SQL solo inspecciona Storage y opera sobre registros/tablas propios de prueba.

Nueve comprobaciones demuestran:

1. Upload devuelve un UUID idéntico a storage.objects.id.
2. Una FK restrictiva permite descargar el objeto registrado.
3. Storage API copy a otro bucket crea un UUID diferente y conserva el original.
4. Los bytes copiados deliberadamente al bucket público son legibles.
5. Un upload de reemplazo en otra ruta obtiene un UUID nuevo.
6. DELETE API con referencia activa falla y conserva fila **y bytes**.
7. Después de retirar la referencia propia, DELETE API elimina fila y bytes.
8. Volver a crear la misma ruta después de borrarla obtiene otro UUID.
9. El catálogo estructural de Storage es idéntico antes y después del ensayo.

Por tanto, el UUID identifica una instancia de objeto durante su vida, no un nombre reutilizable ni una familia de versiones. El flujo editorial de publicación descarga/valida y sube una nueva copia; conserva UUID anterior y registra el nuevo. La prueba de la operación copy nativa es adicional y no sustituye validación de publicación.

## Migración 018 y compatibilidad

`20260906001800_storage_object_identity.sql` no modifica las 17 migraciones mergeadas. En una transacción:

- Bloquea nuestra media_assets durante el cambio; la FK anterior sigue protegiendo sus objetos.
- Añade storage_object_id y lo rellena consultando el catálogo existente.
- Exige NOT NULL, UNIQUE e integridad hacia storage.objects.id con RESTRICT; si algún dato no puede resolverse, revierte todo.
- Retira únicamente nuestra FK compuesta después de validar la nueva.
- Añade un trigger INVOKER propio que verifica UUID/bucket/path y mantiene el UUID inmutable. EXECUTE revocado a anon/authenticated; no hay nuevos SECURITY DEFINER.

Los servicios pasan upload.data.id explícitamente. Para compatibilidad con llamadores SQL existentes que omitan la columna, el trigger resuelve un objeto accesible que ya existe, sin inventar un UUID; rechaza ausencia o ambigüedad. Las escrituras authenticated excluidas por owner/autor se rechazan antes de consultar Storage. El trigger respeta RLS y no usa FOR KEY SHARE explícito: ese SELECT requeriría policies UPDATE de Storage, prohibidas por la inmutabilidad. La FK realiza sus propios bloqueos de integridad y evita registrar un objeto eliminado concurrentemente.

El ensayo `node scripts/probe-local-storage-identity.mjs --upgrade-f8` parte de **exactamente 17 migraciones**, crea bytes vía API, registra media legacy con referencias de proyecto y post y aplica `migration up --local`. Sus **13 comprobaciones** incluyen backfill correcto, ubicación/referencias preservadas, bloqueo de borrado con la FK nueva y ausencia de la FK compuesta. [Evidencia del upgrade](local-storage-upgrade.json).

El historial permanece intacto: una reconstrucción reproduce 014 y después 018. El estado final de 18 migraciones no contiene FK hacia columnas Storage no-PK. La aplicación remota de ese historial y los estados intermedios siguen sujetos al diff, backup y puerta de despliegue; este trabajo no autoriza push.

## Eliminación y fallos parciales

La FK RESTRICT impide eliminar Storage mientras sobreviva su metadata registrada, aun cuando el asset todavía no tenga usos editoriales. `media_references`, FK editoriales y el trigger de Markdown bloquean retirar metadata en uso. `deleteMedia` informa referencias y exige revisión vigente.

El orden real compatible con RESTRICT y con F8 es: **desvincular/reemplazar → eliminar metadata no utilizada → Storage API remove**. No se puede borrar primero el objeto y conservar una FK NOT NULL activa hasta el final. No se añadió cascade ni un estado intermedio que debilitara la protección.

Si Storage falla después de retirar metadata, el servicio devuelve cleanup explícito y quedan bytes huérfanos para revisión. No informa éxito total ni intenta restaurar metadata sin poder confirmar la situación. En un reemplazo, el nuevo asset se valida/registra primero; la RPC cambia referencias y conserva el anterior hasta retirarlo de forma explícita.

## Integridad y huérfanos

- Metadata hacia UUID inexistente: rechazada por DB.
- UUID existente con bucket/path equivocado: rechazado.
- Objeto registrado dos veces: UNIQUE lo rechaza.
- Cambio de UUID de un asset existente: permisos/trigger lo rechazan.
- Registro concurrente con DELETE: tres carreras reales API comprueban que no queda metadata registrada sin objeto.
- Objetos API sin metadata: reporte objectsWithoutMetadata, sin limpieza automática.
- Metadata cuyo objeto falta: reporte metadataWithoutObjects.
- Misma ubicación con otro UUID, por ejemplo tras restauración externa: identityMismatches y complete=false.
- Backend inaccesible/error 500: unavailableObjects, sin confundirlo con ausencia confirmada.

Los casos de catálogo/bytes inconsistentes del reporte se simulan mediante fallos de transporte sobre archivos reales. No se falsifican filas persistentes de Storage ni se borran bytes por SQL para provocar esos escenarios. Las pruebas SQL históricas usan filas sintéticas dentro de transacciones con ROLLBACK para verificar constraints/RLS; no representan operaciones físicas de archivos ni se ejecutan en remoto. Los ensayos de ciclo de vida y sus limpiezas usan Storage API.

## Tipos, seguridad y límites futuros

database.ts se regenera desde PostgreSQL local: Row/Insert incorporan storage_object_id y Update lo describe como opcional por el generador; los grants impiden cambiarlo. El DTO público y get_public_snapshot conservan sus proyecciones explícitas y no exponen el UUID interno nuevo. Los DTO administrativos derivan del tipo generado; el reporte de mantenimiento añade identityMismatches. No se introdujo any.

La reconciliación de INSERT con respuesta perdida exige que coincida también el UUID de Storage; una ubicación coincidente con otra identidad devuelve revisión pendiente sin compensación destructiva. Los buckets/policies, formatos, límites, rutas inmutables, validación de bytes y pipeline Sharp permanecen vigentes.

Una FK no demuestra existencia física de bytes ni restaura archivos borrados fuera del flujo autorizado. Los backups/restore requieren coordinar metadata y Storage; el reporte identifica objetos recreados con otra identidad. Administradores de plataforma pueden realizar cambios privilegiados fuera de las policies de aplicación; no se atribuye a RLS protección contra el administrador de la base.

## Entorno y comandos

Stack aislado `portfolio-alonso-readiness-local`: API 57421, DB 57422, shadow 57420, Studio 57423, correo 57424, analytics 57427, inspector 8383. PostgreSQL 17.6; CLI 2.116.0. No se reutilizaron los worktrees anteriores.

```powershell
npm ci
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
npm run db:snapshot:check
npm run test:auth:local
npm run test:media:local
npm run test:storage:identity:local
npm run db:audit
```

El ensayo de actualización es deliberadamente separado: sobre este stack local limpio, `npx supabase db reset --local --version 20260906001700`, seguido de `node scripts/probe-local-storage-identity.mjs --upgrade-f8`. No apuntar pruebas/fixtures a remoto. La entrega final incluye recreación del stack sin backup local y ejecución de las 18 migraciones más seed desde cero; resultados finales en PHASE_LOG.

## Estado remoto y siguiente intervención

No se ejecutó db push ni se modificaron signup, Site URL, redirects, usuarios/owner remotos o archivos remotos. La aprobación de F5/F6/F8 no convierte esta validación local en autorización de despliegue. Tras validar la corrección, si falta autenticación CLI, el usuario debe ejecutar **npx supabase login** y confirmar; nunca pegar access tokens en Git o en la conversación. Después se podrán preparar link, inspección, diff, backup y dry-run, todavía sujetos a la nueva revisión de la puerta de despliegue.

## Inventario de archivos de la corrección

| Responsabilidad              | Archivos                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migración y contrato SQL     | `supabase/migrations/20260906001800_storage_object_identity.sql`, `supabase/tests/storage_identity.test.sql`                                                                                           |
| Entorno aislado              | `supabase/config.toml`, `package.json`, `scripts/audit-local-security.mjs`, `scripts/check-local-snapshot.mjs`                                                                                         |
| Servicios y tipos            | `src/lib/media/upload.ts`, `src/lib/media/lifecycle.ts`, `src/lib/media/orphans.ts`, `src/types/database.ts`                                                                                           |
| Pruebas API y fixture tipado | `scripts/probe-local-storage-identity.mjs`, `scripts/test-local-auth.mjs`, `scripts/test-local-media.mjs`, `tests/fixtures/media-page.astro`                                                           |
| Evidencia                    | `docs/checkpoints/local-storage-identity-probe.json`, `docs/checkpoints/local-storage-upgrade.json`, `docs/SECURITY_AUDIT.json`                                                                        |
| Documentación                | `docs/MEDIA.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/PHASE_LOG.md`, `docs/checkpoints/SUPABASE_REMOTE_READINESS.md`, `docs/checkpoints/STORAGE_OBJECT_IDENTITY.md` |

Son 24 archivos creados/modificados en esta corrección; no hay dependencias nuevas ni cambios a las 17 migraciones previas. Los commits separan reproducción previa (`d15f93d`), migración/servicios (`55734e8`), pruebas de actualización y ciclo de vida (`56785e4`) y esta documentación. No se crea PR ni se hace merge.
