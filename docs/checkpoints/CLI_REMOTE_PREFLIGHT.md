# Inspección remota tras autenticar CLI

Fecha: 2026-09-06. Rama `chore/supabase-remote-readiness`. Base origin/main `e8a4750097cbb6a7c85e01ce36cf91c3f38a4185`. Sin despliegue efectivo, PR, merge ni nuevas fases.

## Login, enlace y catálogo

El usuario completó login interactivamente. PowerShell requiere `npx.cmd` para evitar la resolución de npx.ps1 bloqueada por ExecutionPolicy; no fue necesario cambiar esa política. Supabase CLI 2.116.0 confirmó la cuenta autenticada y el proyecto configurado en .env.local. No se registran claves, enlaces de login ni códigos de verificación.

`supabase link` terminó correctamente. Proyecto portfolio-alonso, sa-east-1, ACTIVE_HEALTHY, PostgreSQL 17.6 (imagen 17.6.1.166). El enlace se conserva en el cache ignorado de CLI. La CLI gestiona su rol técnico de conexión; no se crearon usuarios Auth ni perfiles owner y no se cambiaron credenciales del producto.

Se ejecutaron los dos scripts de auditoría existentes mediante `db query --linked`, dentro de transacciones READ ONLY. El catálogo coincide con la inspección previa: cero tablas propias, buckets, objetos y usuarios Auth; no existe historial de migraciones del portfolio. Automatic RLS sigue activo mediante ensure_rls y public.rls_auto_enable(). No se modificaron signup, Site URL, redirects ni settings remotos.

- [Catálogo CLI](remote-cli-catalog.json).
- [Plataforma CLI](remote-cli-platform.json).
- [Comparación después de la simulación](remote-after-dry-run.json).

## Respaldo lógico

Se obtuvieron roles, esquema y datos con `db dump --linked`; el primer intento de roles falló y el reintento terminó correctamente. La copia válida usa roles-retry.sql, schema.sql y data.sql. El archivo roles.sql vacío del intento fallido queda explícitamente excluido.

Ubicación fuera de Git: `%LOCALAPPDATA%/portfolio-alonso/backups/20260906-predeploy`. ACL restringida al usuario Windows actual, SYSTEM y Administrators. El [manifiesto](remote-backup-manifest.json) conserva tamaños y hashes, no contenidos sensibles.

El dump de esquema incluye la función de Automatic RLS pero omite su event trigger. Se preparó automatic-rls-event.sql como suplemento explícito de recuperación; no se ejecutó en remoto. La restauración requiere un destino Supabase compatible y **todavía no fue ensayada**. Los dumps no incluyen los bytes Storage ni la configuración Auth del servicio. Por tanto, existe respaldo lógico, pero no se declara superada la validación de recuperación.

## Diff y simulación

La comparación explícita `db diff --from linked --to migrations --schema public,private` falló por timeout hacia la conexión directa PostgreSQL. El acceso de Management API y los dumps por la ruta de conexión de CLI sí funcionaron.

La alternativa `db diff --linked --use-migra --schema public,private` terminó. Su dirección es **migraciones hacia remoto**, inversa al despliegue inicial: propone retirar las 35 tablas propias ausentes en remoto e incorporar la función preexistente de Automatic RLS. Los DROP de ese documento son resultado de esa dirección, no SQL autorizado para ejecutar. No se aplicó ni guardó como migración. El SQL permanece fuera de Git; el [resumen](remote-diff-review.json) registra dirección, hash y límites. El filtro public/private tampoco constituye una revisión completa del esquema administrado Storage ni de sus filas de buckets.

Se ejecutó únicamente `db push --linked --dry-run --skip-vault`, conforme a la autorización de simulación posterior al login. Terminó correctamente y listó [18 migraciones pendientes](remote-dry-run.json). No incluyó seed, roles ni actualización de Vault. No equivale a ejecutar db push efectivo ni a aprobar el SQL generado por diff.

## Punto de parada: orden inicial de las migraciones

La corrección local 018 mantiene íntegro el historial de F8, como se solicitó. La simulación prueba que un primer push de ese historial ejecutaría **014 antes de 018**: 014 introduciría temporalmente media_assets_storage_object_fk hacia storage.objects(bucket_id,name), y 018 la retiraría al instalar la referencia por PK UUID.

El estado final es correcto y está probado, pero ese estado intermedio contradice la condición de no desplegar la dependencia rechazada. Además cada migración tiene su propia transacción; un fallo entre ambas podría dejar la FK compuesta instalada. No se forzó despliegue ni se editó la migración mergeada para ocultar el problema.

Se requiere acordar una estrategia versionada de instalación inicial que no cree esa FK, conservando la transición 018 para bases F8 existentes. Una opción para revisar es una baseline de instalación inicial, con correspondencia verificable a las 18 migraciones y procedimiento explícito de historial. No se creó esa baseline, no se ejecutó migration repair ni se reescribieron commits sin resolver antes esta decisión.

La puerta sigue cerrada también por el ensayo de recuperación pendiente y la revisión del diff en dirección de despliegue que preserve Automatic RLS. Se detiene antes de cualquier aplicación; no se modifica Auth remoto ni owner. F3/F4/F7/F9/F10/F11 no iniciadas.

## Validación de esta actualización

Se añaden evidencia de lectura y documentación; no cambia código funcional, migrations, seed, dependencias ni UI. El enlace creó linked-project.json en el cache ignorado por Git: se excluye `supabase/.temp/` de Prettier para no formatear archivos administrados por CLI. Las 612 pruebas SQL, 107 Auth, 66 media y 84 unitarias de la corrección local siguen registradas como resultados de esa entrega, sin presentarlas como pruebas remotas nuevas.
