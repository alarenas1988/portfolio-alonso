# Instalación inicial del backend sin la FK compuesta

Rama: `chore/supabase-initial-baseline`. Base: `origin/main` en `c89ed9c0220cfbb088b55138279e4ba14eb54e29`, que integra el checkpoint anterior mediante PR #6. Este trabajo no inicia ninguna fase funcional ni aplica migraciones en remoto.

## Decisión y fuente de verdad

El historial anterior hacía que un primer push ejecutara la FK compuesta de 014 antes de sustituirla mediante 018. Cada archivo confirmaba su propia transacción: una interrupción podía dejar esa dependencia instalada.

La instalación nueva usa únicamente `supabase/migrations/20260906001900_initial_portfolio.sql`, en **una transacción**, con un guard que exige aplicación vacía. No admite un esquema private existente, tablas/vistas/secuencias públicas, funciones públicas ajenas al Automatic RLS observado, buckets ni objetos previos. Conserva la función/event trigger de Automatic RLS sin redefinirlos.

Las 18 migraciones originales se trasladan a `supabase/legacy-migrations/` sin cambiar su contenido. Permanecen en Git y en un manifiesto de hashes. La CLI no recorre ese directorio al ejecutar push/reset. La 018 sigue disponible para actualizar bases F8 existentes.

La baseline se genera determinísticamente mediante `npm run db:baseline:generate` y se verifica con `npm run db:baseline:check`. Cada sección identifica su archivo fuente. El generador retira los BEGIN/COMMIT exteriores y únicamente:

- La creación y comentario de la FK compuesta de 014.
- El bloqueo/backfill de datos legacy de 018, innecesario al exigir base vacía.
- La retirada de la FK compuesta en 018, puesto que nunca se creó.

Se conservan la columna UUID, NOT NULL, UNIQUE, FK RESTRICT hacia `storage.objects.id`, trigger de consistencia, grants, RLS, políticas, funciones y seed separado. El generador falla si cambian hashes o los fragmentos exactos esperados. No cambia la estructura administrada de Storage, no introduce cascade ni debilita autorización.

El SQL generado es un artefacto inicial de revisión, dividido en secciones de las fuentes históricas; no un nuevo esquema mantenido manualmente en paralelo. Después de aprobarlo y desplegarlo, las ampliaciones se harán en migraciones posteriores a 019, sin editar baseline ni archivo histórico.

## Pruebas de instalación y actualización

La prueba de arquitectura falló antes del cambio porque el directorio activo contenía REFERENCES storage.objects(bucket_id,name). Las pruebas nuevas verifican que el artefacto activo no lo contiene, que conserva RESTRICT por UUID y que no altera tablas administradas.

`npm run test:baseline:local` utiliza exclusivamente el stack `portfolio-alonso-baseline-local`, API 58421 y DB 58422. Rechaza targets remotos, utiliza staging ignorado bajo .tools y no cambia los stacks de fases/checkpoints anteriores.

El ensayo:

1. Reconstruye una plataforma local vacía y restaura el respaldo real previo.
2. Compara su catálogo con la inspección remota de solo lectura.
3. Instala un observador DDL temporal local que rechaza toda FK propia hacia columnas no-PK de Storage, incluso si fuera transitoria; demuestra que el observador bloquea un intento negativo.
4. Fuerza un fallo al final de la instalación y verifica rollback completo: no quedan tablas propias, esquema private ni buckets; Automatic RLS permanece.
5. Instala 019 con el observador activo, verifica preservación de Automatic RLS y elimina el instrumental local de prueba.
6. Aplica el seed y comprueba que repetir 019 sobre una aplicación ocupada falla sin cambios.
7. Reconstruye F8 desde el mismo estado previo, crea archivos mediante Storage API y metadata/referencias de proyecto/post, y aplica la 018 archivada: 13 comprobaciones API.
8. Compara ambos catálogos y el contrato del seed; los UUID y timestamps generados del seed se comparan semánticamente, no como identidades ficticiamente iguales.
9. Ensaya la reconciliación del historial local, conservando contenido existente y comprobando que migration up posterior no reaplica el esquema.
10. Reconstruye nuevamente desde vacío por el camino 019, sobre el que se ejecutan las suites SQL/Auth/media.

La comparación incluye schemas/ACL, relaciones/RLS, columnas/defaults, constraints/comentarios, índices, cuerpos/owners/ACL de funciones, vistas, triggers, policies, default privileges, grants Storage, buckets, estructura administrada de objects y Automatic RLS. La evidencia está en [initial-baseline-proof.json](initial-baseline-proof.json).

## Adopción de bases que ya tienen F8

No basta con marcar una baseline como aplicada para ocultar diferencias. El orden obligatorio es:

1. Respaldar datos e historial actuales y confirmar versiones/hashes. Si no es exactamente F8/17 o la corrección/18 conocida, detenerse e investigar.
2. Para F8/17, aplicar exclusivamente 018 desde staging histórico; no recrear la base ni ejecutar la instalación inicial.
3. Comparar catálogo, permisos y comportamiento con la baseline validada. Conservar evidencia del resultado y el historial original.
4. Solo con equivalencia comprobada, reconciliar la tabla de historial mediante los comandos oficiales `migration repair`: retirar del registro activo las versiones 001–018 y registrar 019 como aplicada. Esta operación no deshace ni reproduce su SQL.
5. Verificar contenido sin cambios, historial con 019 y ausencia de pendientes al ejecutar migration up. Una interrupción durante la reconciliación requiere revisar/restaurar el registro respaldado; nunca ejecutar push a ciegas.

El ensayo ejecuta estos comandos **solo con --local** después de comparar el catálogo; guarda el registro anterior en `.tools/legacy-history-before-adoption.json`. La evidencia permanente conserva hashes y fuentes sin datos sensibles. No se ejecuta repair contra el proyecto real: sigue vacío y recibirá 019 como primera migración cuando se autorice.

Este es un cambio explícito en la organización del historial de migraciones, sin rebase, force-push ni reescritura de commits. Los worktrees F5/F6/F8/readiness anteriores se conservan. La [CLI de Supabase](https://supabase.com/docs/reference/cli/supabase-migration-repair) documenta que repair cambia el registro de versiones, no el esquema.

## Ensayo de recuperación

El respaldo reside fuera de Git en `%LOCALAPPDATA%/portfolio-alonso/backups/20260906-predeploy`, con ACL restringida. Se verifican los cuatro hashes del manifiesto antes de leerlo. No se versionan SQL de datos, credenciales ni contenido Auth. En este respaldo no existen usuarios ni objetos del portfolio.

La restauración utiliza roles-retry.sql, schema.sql, data.sql y el suplemento automatic-rls-event.sql. Dos ajustes explícitos adaptan el respaldo a un destino Supabase administrado compatible:

- El GRANT SET de log_min_messages pertenece a la plataforma y postgres no puede repetirlo. Se verifica que supabase_realtime_admin ya tiene ese permiso y se omite únicamente esa sentencia; no se elevan privilegios.
- El template local de CLI deja UPDATE por defecto de secuencias para roles API que no existe en el remoto inspeccionado. Se restaura explícitamente la ACL de origen sobre las secuencias futuras de postgres en public; el catálogo previo debe coincidir con la evidencia remota.

El suplemento conserva ensure_rls, omitido por el dump estándar, y se prueba creando una tabla temporal de ensayo que nace con RLS automáticamente. Ninguna adaptación modifica los archivos originales del respaldo ni se ejecuta en remoto. El procedimiento sigue el [respaldo lógico oficial](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), con sus dependencias de plataforma documentadas.

Este ensayo comprueba el respaldo del proyecto vacío actual. No demuestra recuperación de archivos futuros: los bytes de Storage y la configuración Auth del servicio requieren su propio respaldo/inventario. No implica restauración automática sobre producción.

## Puerta remota

La revisión forward se conserva en [initial-forward-diff.json](initial-forward-diff.json). Compara el catálogo real remoto con el candidato local equivalente, enlaza el SHA-256 del SQL que se aplicaría y exige que la función/event trigger de Automatic RLS, schema public y estructura administrada de Storage permanezcan idénticos. La única diferencia de default privileges de origen es la revocación prevista de permisos de tablas futuras de anon/authenticated; no se alteran los defaults de roles administrados ni secuencias remotas.

El SQL 019 contiene sustituciones internas heredadas de las fuentes (policies, CHECK, índice y proyecciones), todas sobre objetos recién creados dentro de la misma transacción. No elimina objetos preexistentes ni modifica tablas internas. No se utiliza la salida inversa de migra: la revisión en dirección de instalación se hace con catálogo, SQL exacto y ejecución sobre el respaldo restaurado. El timeout anterior del acceso directo del motor de diff no se presenta como resuelto.

La rama queda para revisión. No se ejecuta db push efectivo, seed remoto, migration repair remoto, cambios signup/Site URL/redirects ni bootstrap owner. Tampoco PR/merge automático de esta rama.

El dry-run remoto debe listar **solo 20260906001900_initial_portfolio.sql**, con --skip-vault y sin seed/roles. La instalación no autoriza modificar Automatic RLS. Una auditoría nueva previa al despliegue debe confirmar que el proyecto continúa vacío y que su catálogo administrado coincide; cualquier drift invalida esta revisión.
