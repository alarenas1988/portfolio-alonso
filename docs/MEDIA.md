# Storage y multimedia — F8

## Estado remoto tras instalar 019 — 2026-09-06

portfolio-public, blog y documents existen como buckets públicos; private es privado. Configuración MIME y límite 10 MiB, cuatro policies SELECT/INSERT/DELETE y FK UUID RESTRICT coinciden con el esquema local aprobado. No hay policy UPDATE/upsert/move. Anon no puede subir un PNG válido ni obtener datos del listado privado. No existen archivos ni metadata remota; [auditoría y estado](checkpoints/INITIAL_DEPLOY.md).

El smoke test remoto con el owner definitivo pasó 48 comprobaciones de Storage/media: PNG sintético privado, identidad UUID, signed URL de 60 segundos, publicación, tres referencias incluyendo Markdown, reemplazo con nuevo UUID y borrado tras desvincular. Storage API rechazó el borrado directo del objeto registrado sin perderlo; anon/noowner/inactivo no administraron objetos. Incluso owner tiene prohibido upsert/move. El reporte detectó un huérfano temporal y terminó vacío tras limpieza. [Prueba real y resultados](checkpoints/initial-deploy/owner-smoke.json).

No quedan archivos ni metadata de prueba. No se subieron CV ni capturas reales. El respaldo lógico no incluye bytes; el ensayo de restauración excluye las dos tablas vacías administradas de Storage Vector según el procedimiento oficial, conservando también el dump completo. Los apartados posteriores conservan el historial local previo a esta instalación; el estado remoto vigente es el de este checkpoint.

## Instalación inicial sin dependencia transitoria

La instalación nueva utiliza la baseline 019 y referencia exclusivamente la PK UUID de Storage. El historial 001–018 se conserva sin cambios en `supabase/legacy-migrations/`; una base F8 existente usa la transición 018 y adopta el historial nuevo solo después de verificar equivalencia. No cambia upload, replace, delete, media_references ni el pipeline. [Instalación y pruebas](checkpoints/INITIAL_BASELINE.md).

## Corrección local de identidad Storage — 2026-09-06

F8 ya está integrada en main. El checkpoint corrige localmente la dependencia del índice administrado no primario: la migración 018 agrega `media_assets.storage_object_id uuid NOT NULL UNIQUE`, con FK RESTRICT hacia `storage.objects.id`. Bucket y path siguen siendo información de aplicación, comprobada al registrar e inmutable. Upload, copia/publicación y reemplazo conservan el UUID devuelto por Storage API; copiar o reemplazar crea otra identidad. No se altera ninguna tabla ni índice administrado. [Decisión, catálogo y pruebas](checkpoints/STORAGE_OBJECT_IDENTITY.md).

El borrado directo de un objeto registrado devuelve error y conserva sus bytes. El servicio bloquea assets en uso; después de desvincular referencias, retira la metadata y llama a Storage API. Si esta última falla, devuelve una tarea de limpieza y el reporte de huérfanos identifica el objeto restante. La auditoría compara UUID además de bucket/path y distingue ausencia, indisponibilidad e identidad diferente; nunca elimina automáticamente. La FK protege catálogo, no sustituye un backup de los bytes. Remoto sigue sin cambios y db push no está autorizado.

El límite global del proyecto Free es 50 MB y no están habilitadas transformaciones remotas. Los límites por bucket de 10 MiB y Sharp durante build siguen siendo el contrato previsto; aún no se aplicaron a remoto. Los backups de PostgreSQL no recuperan bytes de Storage borrados.

F8 se desarrolla exclusivamente en Supabase local, desde origin/main 25c351557d060b7438cb89ae520a96681ae69828 (F1 + F2 + F5 + F6). El PR #4 de F6 está mergeado y todos sus commits están subidos. Ese PR no tenía checks automáticos configurados; su evidencia de validación es la ejecución local registrada en PHASE_LOG.md.

## Entorno reproducible

- Worktree vigente: .worktrees/supabase-initial-baseline; rama: chore/supabase-initial-baseline. Los worktrees anteriores se conservan.
- Docker Desktop 4.89.0, Engine 29.7.2, WSL 2.
- Supabase CLI 2.116.0 fijada; PostgreSQL 17.6, imagen 17.6.1.165.
- Stack portfolio-alonso-baseline-local: API 58421, DB 58422, shadow 58420, Studio 58423, Mailpit 58424, analytics 58427 e inspector 8483.
- Node 24.20.0 y npm 11.19.0. .env.local está ignorado y no se imprimen credenciales.
- Las pruebas Auth/media verifican el endpoint local exacto antes de crear fixtures. Nunca utilizan el proyecto remoto de las variables públicas.

```powershell
$env:Path = 'C:/laragon/www/portfolio/.tools/node-v24.20.0-win-x64;' + $env:Path
Set-Location C:/laragon/www/portfolio/.worktrees/supabase-initial-baseline
npm ci
npm ls --depth=0
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
npm run db:snapshot:check
npm run test:auth:local
npm run test:media:local
npm run db:audit
```

Los wrappers de DB fijan --local y rechazan argumentos extra. La reconstrucción aplica la baseline 019 y el seed original, que no contiene usuarios ni archivos reales. Las 18 migraciones históricas se usan únicamente en el ensayo separado de actualización/equivalencia. Las pruebas SQL se revierten; las pruebas HTTP crean identidades/bytes sintéticos y eliminan sus fixtures al finalizar. No ejecutar estas pruebas simultáneamente sobre el mismo stack.

## Buckets y formatos

| Bucket           | Público | Carpetas                                 | Tipos                      |
| ---------------- | ------- | ---------------------------------------- | -------------------------- |
| portfolio-public | Sí      | projects, technologies, profile, general | JPEG, PNG, WebP, AVIF      |
| blog             | Sí      | posts                                    | JPEG, PNG, WebP, AVIF      |
| documents        | Sí      | cv, general                              | PDF                        |
| private          | No      | temporary, drafts, processing            | JPEG, PNG, WebP, AVIF, PDF |

Cada bucket tiene file_size_limit=10485760 y una allowlist MIME explícita; el límite global local también es 10 MiB. HTML, JavaScript, SVG y ejecutables no son uploads admitidos. Los SVG revisados del código permanecen versionados.

La ruta es carpeta/UUID-v4.extensión normalizada; nunca deriva del filename original. Se permiten nombres editoriales Unicode y repetidos. La extensión JPEG se normaliza a jpg en Storage.

La carga ordinaria crea un objeto en private. Publicar requiere una operación separada que descarga, revalida y crea una copia pública nueva; no mueve ni destruye la copia privada. Cambiar visibility en DB no vuelve privados los bytes públicos: la constraint exige correspondencia entre bucket, visibility y public_url. Las URLs de buckets públicos son públicas aunque RLS oculte metadata. [Modelo de buckets de Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Permisos y validación

Se conservan cuatro policies de F6: lectura pública en rutas aprobadas y SELECT/INSERT/DELETE del owner sobre sus objetos autorizados. Se retira la policy UPDATE de storage.objects para impedir sobrescritura, upsert y move, incluso por el owner. El reemplazo usa nuevos objetos; UPDATE editorial ocurre en media_assets. Anon, authenticated sin owner y owner inactivo no administran archivos.

Las concesiones de la plataforma sobre storage.objects siguen administradas por Supabase. F8 no altera su propietario ni supone que RLS controla operaciones SQL como TRUNCATE. La API no concede una consola SQL a los clientes. El catálogo completo queda en SECURITY_AUDIT.json.

Validación por capas:

1. Bucket: MIME permitido y límite de tamaño.
2. Servicios: filename/extensión, MIME declarado, firma de bytes, tamaño y metadata.
3. Navegador: createImageBitmap comprueba procesabilidad y dimensiones de imágenes; PDF-lib analiza PDF.
4. Build: Sharp decodifica la imagen completa, aplica orientación, limita 40 millones de píxeles y rechaza imágenes animadas o datos corruptos. PDF-lib rechaza documentos corruptos, cifrados, sin páginas, de más de 500 páginas y acciones activas detectadas.
5. PostgreSQL: tipo/tamaño/extensión, dimensiones, privacidad, alt/decorative, FK, UUID de ubicación y revisión.

Alt informativo debe contener 1–500 caracteres. Solo decorative=true permite alt vacío; no se rellena con filename. Los PDF no se marcan decorativos. No se almacenan bytes en PostgreSQL.

Storage no decodifica imágenes por RLS ni valida el contenido real de un PDF. Un owner que evite los servicios puede intentar subir bytes corruptos con un MIME permitido; el build obligatorio los rechaza. No se afirma que exista inspección antivirus o una Edge Function de validación. Sharp utiliza límites y fallo ante datos inválidos conforme a su [contrato de decodificación](https://sharp.pixelplumbing.com/api-constructor/); el parser PDF usa [PDFDocument.load](https://pdf-lib.js.org/docs/api/classes/pdfdocument).

## Metadata, referencias y operaciones

media_assets conserva bucket/path/URL, nombre, MIME, tamaño, dimensiones, alt, decorative, caption, categoría, visibilidad, autor y timestamps. La ubicación y el MIME son inmutables; el navegador solo edita metadata editorial. La migración 018 añade storage_object_id UUID, único y obligatorio, con FK a la PK storage.objects(id): no puede registrarse un objeto inexistente ni eliminarse un objeto registrado mediante Storage. Un trigger propio comprueba que UUID y bucket/path corresponden al mismo objeto. La dependencia previa del índice compuesto se retira; la integración API debe volver a probarse al actualizar Supabase.

media_references usa FK reales para proyectos, posts, imágenes de galería, settings/perfil, documentos y tecnologías. F8 añade technologies.icon_asset_id/icon_url para logos administrables. Los iconos versionados existentes siguen usando icon.

Triggers registran los usos de las FK y de tokens Markdown canónicos:

```markdown
![Descripción informativa](media:10000000-0000-4000-8000-000000000001)
[Documento](media:10000000-0000-4000-8000-000000000002)
```

Las referencias repetidas dentro del mismo campo se deduplican. UUID inexistente o token malformado falla. El renderer/editor futuro debe usar este contrato; no se implementa el renderer Markdown de F4. Un trigger de DELETE comprueba además el Markdown original, evitando que borrar manualmente media_references permita retirar bytes todavía usados.

replace_media_asset es una RPC SECURITY INVOKER, disponible solo a authenticated y con comprobación owner explícita. Bloquea la operación, comprueba updated_at, verifica compatibilidad imagen/PDF y disponibilidad pública, actualiza FK y tokens en una transacción, y rechaza usos pendientes. Conserva metadata y bytes anteriores; retirarlos requiere una acción posterior.

deleteMedia primero informa usos, elimina metadata con id/revisión y después elimina bytes. Las FK son la autoridad final ante referencias concurrentes. Un objeto registrado continúa protegido frente al borrado directo desde Storage. No hay cascade de archivos al eliminar contenido.

## Fallos parciales y huérfanos

- Upload correcto + INSERT fallido: primero consulta si el INSERT llegó a persistirse pese a perder la respuesta; si no, compensa eliminando el objeto. Un resultado desconocido o una compensación fallida devuelve ubicación para revisión.
- Metadata retirada + DELETE de bytes fallido: devuelve cleanup explícito y el objeto aparece sin metadata. No se informa éxito total silenciosamente.
- Reemplazo no confirmado: el archivo anterior permanece. El nuevo queda disponible para revisar/reintentar; nunca se borra automáticamente después de una respuesta ambigua.

reportMediaOrphans produce un reporte, sin eliminar:

- objectsWithoutMetadata: objetos sin registro editorial;
- metadataWithoutObjects: registros cuyo objeto no aparece o devuelve ausencia;
- identityMismatches: misma ubicación con UUID diferente al registrado; complete=false, requiere revisión;
- unavailableObjects: bytes que no se pudieron verificar por otro error; complete=false.

El stack local puede responder 500 cuando falta el archivo físico aunque exista la fila de Storage. Se registra como no verificable, no como prueba concluyente de eliminación. El reporte revisa listas paginadas y descarga archivos de forma secuencial; es mantenimiento explícito y puede consumir hasta 10 MiB por asset. Ante fallos del inventario se aborta, sin ejecutar limpieza. Toda retirada requiere revisar el reporte.

## CV y preview privado

registerDocument registra PDF inactivo. activate_cv serializa activaciones, exige un PDF público, desactiva el CV anterior y activa el elegido dentro de una transacción. El índice parcial permite como máximo un CV activo; los documentos generales tienen type=document y no dependen del interruptor del CV.

El build copia el PDF activo incluido por el snapshot a assets/media/hash.pdf. El enlace final es del mismo origen que Pages. Las copias anteriores se mantienen hasta una retirada explícita.

privatePreview exige owner y crea una signed URL de 60 segundos. Solo sirve para preview administrativo; no se guarda en DB, localStorage ni manifest. El pipeline rechaza private y cualquier URL con query/hash, incluyendo tokens firmados.

## Build autocontenido

buildSnapshotAssets recibe el snapshot público y recopila media_references, documentos y tokens Markdown. buildAssets permite especificar requiredIds/optionalIds explícitos. Un recurso requerido ausente, privado, corrupto, incompatible o no descargable aborta. Opcional significa ausente en el modelo: un asset seleccionado pero corrupto tampoco se omite silenciosamente.

El downloader admite únicamente el origen Supabase configurado, el endpoint público de Storage y buckets/rutas conocidos. Rechaza credenciales en URL, query/hash, traversal, otros orígenes/protocolos y redirects. No envía API keys ni JWT; usa timeout de 10 segundos y máximo de 10 MiB tanto por Content-Length como durante streaming.

Sharp genera AVIF, WebP y PNG de fallback, con anchos 320/640/960/1440 cuando caben y un máximo de 1920, sin ampliar imágenes pequeñas. Se aplica orientación y se eliminan metadatos al recodificar. Cada variante incluye dimensiones.

El mapa relaciona UUID con rutas bajo la base de Astro, por ejemplo /portfolio-alonso/assets/media/hash.webp. MediaImage.astro consume ese mapa y genera picture/srcset, sizes, alt y dimensiones sin conocer Storage. El CV usa la misma resolución por UUID.

Los nombres dependen de SHA-256 de los bytes emitidos. Un rebuild valida de nuevo el origen y reutiliza archivos idénticos sin reescribirlos. El manifest se sustituye solo cuando todos los recursos seleccionados pasan; un fallo conserva el manifest y los assets anteriores. No hay fallback a bytes antiguos cuando la fuente requerida falla.

La conexión a las páginas de contenido se realizará en F3/F4. F8 entrega y prueba el pipeline con snapshot/Storage reales y directorios de artefacto aislados; el build normal conserva la portada fixture de F2. No se implementó publicación C2 ni GitHub Actions.

## Biblioteca aislada

MediaPicker.astro + mountMediaLibrary + createMediaLibrary proporcionan búsqueda/filtro, listado, upload privado, edición alt/caption/decorative, publicación explícita, usos, reemplazo, borrado y preview. La integración futura proporciona el cliente autenticado; no hay navegación CMS, dashboard ni página /admin/media productiva.

Los estados son waiting/uploading/processing/complete/failed. Supabase SDK no proporciona progreso granular para este upload estándar: se usa progreso indeterminado durante transferencia y 100% al completar. Los campos y el archivo seleccionado permanecen ante un fallo recuperable.

La página tests/fixtures/media-page.astro se inyecta solo con MEDIA_TEST_FIXTURE=1, que configura Playwright. No existe esa ruta ni su bundle en el build normal. Su adaptador simula fallos de red para UX; las pruebas de seguridad y servicios usan Supabase real directamente.

## Dependencias y límites de entrega

- sharp 0.35.4 pasa a dependencia directa fijada; Astro ya utilizaba esa misma versión.
- pdf-lib 1.17.1 es nueva y se carga dinámicamente al validar PDF.
- No se añadieron frameworks UI, Edge Functions, servicios externos ni buckets extra.
- F5/F6/F8 siguen sin despliegue remoto. Revisar conjuntamente versión PostgreSQL, policies permisivas existentes, FK a Storage, Auth y Automatic RLS antes de autorizarlo.
- No se iniciaron F3, F4, F7, F9, F10 ni F11. La validación local no certifica un proyecto remoto todavía no modificado.

## Integración CMS F7

/admin/media integra los servicios F8; el selector devuelve IDs de media, nunca signed URLs permanentes. Upload comienza privado, requiere alt o marca decorativa y usa la validación de F8. Los usos bloquean delete y el reemplazo exige otro asset con ruta inmutable. /admin/documents registra PDFs, publica una copia explícita, vincula con control de revisión y activa el CV mediante la RPC existente. El original privado se conserva; una vinculación fallida se informa con la copia identificada en Multimedia. La preview es efímera y no llega al build. [Guía CMS](ADMIN_CMS.md).
