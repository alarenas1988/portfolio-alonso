# F11 — Publicación C2: implementación y puerta de activación

Estado actual: **F11 implementada y verificada: Pages operativo, publicación CMS exitosa y cancelación recuperada**. Los bloqueos descritos abajo son historial de la implementación. Fecha local 2026-09-06, America/Santiago. La inspección inicial entre 2026-09-07 00:17 y 00:19 UTC se conserva a continuación como historial. El usuario confirmó posteriormente el secret; su presencia fue verificada sin leer su valor. La configuración posterior se registra al final de este documento.

## Base y aislamiento

- `origin/main`: `8bb9815d869064621254d4ccbfe087b1e4962b4d`, merge de F10B mediante PR #14.
- Main se comprobó limpio y se sincronizó mediante fetch/fast-forward. Cero commits locales pendientes antes de crear la rama.
- Rama `feat/f11-c2-deployment`; worktree `C:/laragon/www/portfolio/.worktrees/f11-c2-deployment`, creado desde origin/main.
- No se reutilizan los worktrees de F7/F10B. Las referencias de sus fases se leen desde el nuevo checkout.

## Auditoría inicial sin cambios remotos

[GitHub](f11/github-initial.json) y [Supabase](f11/supabase-initial.json) contienen únicamente inventario permitido; no valores de variables/secrets, credenciales ni identificadores de sesión.

| Elemento                     | Estado observado                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositorio                  | `alarenas1988/portfolio-alonso`, público, default branch `main`                                                                                          |
| Cuenta GitHub                | La sesión por defecto de gh es `alarenas-slepac`; la credencial configurada de Git autentica `alarenas1988`, con admin/maintain/push confirmados por API |
| Pages                        | `has_pages=false`; GET Pages devuelve 404 con cuenta administradora: no habilitado                                                                       |
| Actions                      | Habilitado; sin workflows; permisos por defecto read; no puede aprobar PR desde el token del workflow                                                    |
| Environments                 | Ninguno                                                                                                                                                  |
| Variables y secretos Actions | Ninguno                                                                                                                                                  |
| Protección main / rulesets   | Sin protección tradicional configurada (404), lista de rulesets vacía                                                                                    |
| Proyecto Supabase            | `portfolio-alonso`, `sa-east-1`, ACTIVE_HEALTHY                                                                                                          |
| CLI Supabase                 | 2.116.0, autenticada; inspección con project-ref derivado de la configuración pública y validado contra el proyecto aprobado                             |
| Edge Functions remotas       | `contact-submit` v3 ACTIVE; `track-event` v1 ACTIVE                                                                                                      |
| Publicación remota           | `publish-site` y `build-status` todavía no desplegadas                                                                                                   |
| PAT en Edge                  | `GITHUB_FINE_GRAINED_TOKEN` ausente                                                                                                                      |
| HMAC callback                | `BUILD_CALLBACK_HMAC_SECRET` ausente en Supabase y en Actions                                                                                            |

No se modificó Pages, configuración Actions, variables, secrets, Edge, Auth, owner, Storage, RLS, base de datos ni contenido remoto. No se enviaron dispatch/callbacks ni fixtures. La credencial de Git se utilizó solo en memoria para llamadas GET; no se exportó a Supabase ni a archivos. No se cambió la cuenta global de gh.

## Contratos existentes revisados

Se revisaron el plan F11 y decisiones D07/D08, el maestro §§16/18/35, Deployment/Architecture/Security, documentación F7/F8/F9/F10/F10B y los handlers/configuración versionados.

- F9 ya usa `GITHUB_FINE_GRAINED_TOKEN`, `GITHUB_REPOSITORY_OWNER`, `GITHUB_REPOSITORY_NAME` y `BUILD_CALLBACK_HMAC_SECRET`. Se conservan estos nombres, aunque el plan histórico abreviaba el HMAC como BUILD_CALLBACK_SECRET y el prompt proponía GITHUB_DISPATCH_TOKEN.
- Dispatch: `portfolio_publish`, payload únicamente `build_id`, repositorio del servidor, timeout de ocho segundos, sin retry ciego. La ausencia de token devuelve configuración no disponible antes de crear queued.
- Callback: HMAC, timestamp/ventana, run/intento/SHA/inicio y transiciones en RPC; ejecución autenticada por servicio. Solo building/success/failed.
- El CMS todavía devuelve estado pendiente si no está configurado publish-site; requiere seguimiento moderado y presentación del resultado real.
- F8 ya integra el snapshot y sus assets públicos en la generación estática; no hace falta un pipeline paralelo. Node fijado en `.nvmrc`: 24.20.0.
- Se deben completar workflows CI/deploy/reconciliación, configuración de plataforma, activación Edge/CMS y pruebas reales. No se implementaron durante esta inspección.
- Reconciliación y timeout ambiguo de dispatch requieren revisión específica antes de activar publicación; no se declara resuelta esa integración por disponer de handlers locales.

## Acción inicial del usuario — ya realizada

La instrucción F11 §17 exige detenerse si falta el token. No se sustituye por la credencial amplia usada por Git/gh.

1. En GitHub, con la cuenta `alarenas1988`: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Nombre sugerido `portfolio-alonso-c2`, vencimiento limitado.
2. Resource owner: `alarenas1988`. Repository access: **Only select repositories**, únicamente `portfolio-alonso`.
3. Repository permissions: **Contents: Read and write** para repository_dispatch; **Actions: Read-only** para consultar ejecuciones en la reconciliación prevista por el plan. Metadata read-only es implícito. Sin permisos de administración, secrets ni edición de workflows.
4. Generar y guardar directamente en el dashboard Supabase del proyecto `portfolio-alonso` → Edge Functions → Secrets, con nombre **`GITHUB_FINE_GRAINED_TOKEN`**. No enviar el valor al chat ni guardarlo en el repositorio.
5. Confirmar únicamente que el secret quedó configurado. Después se comprobará su presencia y se continuará en esta misma rama. La presencia no demuestra por sí sola que el token sea válido o tenga el alcance correcto.

El HMAC compartido se preparará posteriormente de forma coordinada entre Edge y Actions, sin pedir al usuario que lo pegue en el chat. No es necesario configurar Pages manualmente: el acceso administrativo observado permite hacerlo después de reanudar.

Permisos contrastados con fuentes primarias: [creación de fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [Repository Dispatch exige Contents write](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event), [consulta de workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run) y [secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets).

## Controles y continuación

- `npm ci`: 460 paquetes instalados, cero vulnerabilidades. Solo las dos variables públicas aprobadas se copiaron a `.env.local` ignorado; valores no mostrados.
- Este checkpoint documental conserva la evidencia antes de pedir la credencial. No existen cambios funcionales que justificarían ejecutar todavía la matriz completa F11.
- No se ha habilitado Pages, no hay CI remoto ni deployment real, y no se afirma aceptación del circuito C2.
- La prohibición de push/PR/merge sigue vigente. Los workflows de Actions necesitan llegar a GitHub y repository_dispatch exige presencia en la rama predeterminada; la validación remota completa requerirá resolver esa autorización cuando exista una implementación local concreta y revisable. No se elude escribiendo workflows por API.
- No se iniciaron F12/F13/F14. No push/PR/merge ni cambios de historia.

## Reanudación e implementación

El usuario confirmó `GITHUB_FINE_GRAINED_TOKEN`. Se verificó su presencia; alcance/vigencia se demostrarán con el consumidor Edge, sin descargar el secret. Se mantuvo la rama y el SHA base anteriores. La plataforma muestra contact-submit v4 y track-event v2 tras configurar secrets; esta rama no redeployó esas funciones.

| Área            | Resultado preparado                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI              | PR/push main/manual; Node 24.20.0; gates npm, Edge unit, build fixture, static/admin/secrets, E2E 390/1440                                         |
| Pages           | Push main, `portfolio_publish`, manual; snapshot público/RLS y F8; artefacto dist; Actions oficiales; environment github-pages                     |
| Permisos        | Contents read; solo deploy agrega Pages write/id-token write; SHA de acciones fijado; sin secrets privilegiados de Supabase                        |
| Código aprobado | Checkout SHA main asociado al evento; sin ref del payload; nueva comprobación de main antes del deploy                                             |
| Dispatch        | Owner JWT, validación DB vigente, payload `{build_id}`, timeout de 8 s sin retry ciego                                                             |
| Timeout ambiguo | 202 queued/pending_verification; no marca fallido un evento que GitHub pudo aceptar                                                                |
| Callback        | HMAC/timestamp de F9, ahora observación verificada del run y deployment; building y resultado terminal correlacionados                             |
| Success         | Requiere job Pages correcto y metadata pública del environment con URL exacta/run; no basta Astro build                                            |
| Failed          | Recupera cancelación, timeout, fallo de build/deploy; mensaje acotado, sin logs completos                                                          |
| Concurrency     | Un workflow activo; no cancelar el deployment en curso. El pendiente puede ser sustituido; reconciliación recupera su estado                       |
| Reconciliación  | Workflow tras fin de Pages + cron GitHub cada 15 min; lote de 20; sin run por más de una hora solo falla tras consulta completa correcta           |
| CMS             | Estados independientes de guardado; UUID conservado para retry idéntico, UUID nuevo ante cambios editoriales; polling 5 s solo activo y cancelable |
| Recuperación    | Reintentar build fallido con solicitud nueva; workflow_dispatch main sin build_id para código; no SQL manual de estados                            |
| Health          | Home, índices, contacto, admin/login, recovery, CSS/JS/fonts/media y 404; smoke Playwright productivo preparado con DNT/GPC                        |

Las tres acciones propias Node de callback/health no requieren instalar dependencias ni Supabase CLI. El build nunca recibe PAT, HMAC de Analytics, JWT owner o service role. El HMAC del callback se limita al paso consumidor. No se cachean snapshot/media/dist. Artifacts Pages conservados un día. No hay rama gh-pages, dominio propio, SPA fallback, PWA, migraciones ni Edge deploy en Actions.

## Gap demostrado y migración 024

021 devolvía cualquier queued/building existente para un request UUID diferente. Si el workflow anterior ya había leído el snapshot, una edición nueva podía quedar sin rebuild y aparentar éxito. La prueba previa falló en cuatro de once comprobaciones: cooldown, nuevo dispatch, durabilidad del request nuevo e identidad distinta.

`20260907002400_publication_freshness.sql` reemplaza solo `edge_request_build`. Mantiene owner activo, SECURITY INVOKER, `search_path` vacío, ownership/ACL, bloqueo advisory e idempotencia exacta; conserva cooldown de 30 s para solicitudes distintas y retira la reutilización de un snapshot en curso. No cambia tablas, índices, RLS, grants, Auth ni Storage. Las once pruebas pasan después.

El editor compara la intención editorial en memoria (campos/relaciones, sin enviarlos a GitHub). Un retry con los mismos datos conserva request UUID; cambios nuevos requieren otra solicitud. El historial y el polling del CMS no sustituyen la seguridad de DB/Edge.

Upgrade local 023→024 comprobó que la fila queued completa y los permisos se conservan. Después se eliminaron únicamente los volúmenes del stack de pruebas expresamente validado y se reconstruyeron 019–024/seed desde cero. No quedaron fixtures del upgrade. Tipos regenerados/check sin diferencias funcionales. 019–023 permanecen intactas.

## Evidencia local y remota previa

| Control                | Resultado                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Reconstrucción/upgrade | Seis migraciones activas, seed idempotente; pending build preservado en upgrade                                 |
| SQL                    | 798 pruebas, 10 archivos; db lint sin warnings                                                                  |
| Auth/RLS HTTP          | 107 comprobaciones contra Auth/PostgREST local; fixtures eliminados                                             |
| Edge HTTP existente    | 79 comprobaciones contra Runtime/DB reales                                                                      |
| Publicación HTTP/DB    | 13 comprobaciones: HMAC, transiciones, duplicados, cancelación y CAS de expiración                              |
| Tipos/snapshot         | PostgreSQL local y remoto coinciden; contrato público/seed correcto                                             |
| Unitarias Node         | 188 aprobadas                                                                                                   |
| Edge unitarias         | 119 aprobadas; cuatro entrypoints comprobados por Deno                                                          |
| E2E público            | 67 aprobadas, 7 omisiones previstas por breakpoint; 390/1440, no-JS, reduced motion, navegación y accesibilidad |
| E2E Admin relevante    | 7 aprobadas: roles/deep links/recovery/logout, edición/relaciones/concurrencia y tres flujos de publicación     |
| Build público real     | 31 páginas, 25 rutas admin, sin details ficticios; base `/portfolio-alonso/`                                    |
| Artefacto              | check:static, check:admin:static, check:secrets; 381 archivos, cero canarios privados                           |
| Fallos de build        | Cinco escenarios: completo/vacío correctos, lectura/contrato/media requerida fallan                             |
| Workflow local         | actionlint 1.7.12 y pruebas de contratos; no equivale a CI real                                                 |

La pantalla de publicación se inspeccionó mediante capturas locales a 390/1440; se reutilizó el toolbar existente para separar las acciones sin rediseñar el CMS. Axe no encontró violaciones. Las capturas son fixtures locales, no evidencia de un deployment real.

Preflight remoto de solo lectura: PostgreSQL 17.6, historial 019–023, 35 tablas RLS, 138 policies y Automatic RLS activo. Coinciden columnas, constraints, índices, vistas, triggers, ACL, cron y funciones excepto el cuerpo revisado de la RPC 024; se verificó que el cuerpo remoto aún corresponde exactamente a 021. Tipos iguales. Dry-run: **solo 024, sin seed ni roles**. El texto CLI “Finished supabase db push” pertenece al resultado `dryRun:true`; no se aplicó ninguna migración.

CI utiliza una selección de dos breakpoints (aproximadamente dos minutos localmente); no elimina la matriz completa ni las pruebas de DB/Auth, que requieren Docker y quedan para checkpoints. El harness de cinco builds ahora deshabilita Analytics y admite únicamente los dos atributos públicos del formulario F9; continúa rechazando referencias remotas de media. El harness de upgrade F7 admite migraciones posteriores sin perder su comprobación 022→023.

## Diferencias, límites y aceptación pendiente

- No hay tablas/RPC adicionales, nuevo parser, pipeline de media ni dependencias npm. La migración correctiva es necesaria por evidencia de contenido desactualizado.
- Push main/workflow_dispatch no inventan filas site_builds: el historial de esa tabla representa solicitudes CMS, según la opción autorizada en F11 §29. Es una precisión respecto del plan histórico que contemplaba registrar todos los runs.
- El callback explícito firmado de F9 se conserva para compatibilidad. Los workflows F11 usan `observe`, y el servidor verifica GitHub; ningún callback del navegador está permitido.
- Cron de GitHub puede retrasarse/desactivarse por inactividad; un fallo de API/secreto/PAT no produce éxito/fallo ficticio y necesita recuperación operativa. Una consulta truncada no demuestra abandono.
- Un fallo de build conserva Pages anterior. Si el deploy ya ocurrió pero falla health, se informa fallo y no se promete rollback automático.
- El intento/SHA de una solicitud ya correlacionada son inmutables; para retry usar una solicitud CMS nueva, no rerun arbitrario de un intento previo.
- No se utiliza un snapshot hash ficticio: el campo existente sigue opcional; Actions correlaciona SHA/run/deployment y F8 genera manifiestos/hash de assets.
- CI real/PR, Pages artifact/deploy, URL pública, login owner en Pages, contacto/Analytics productivos y circuito CMS→Pages→success todavía requieren integración. Los tests locales/mocks no se presentan como esas evidencias.
- La instrucción F11 §87 dice “No hagas automáticamente: push; PR; merge”. Primero se entrega la implementación con commits y controles; se necesita autorización explícita para integrar los workflows y continuar la aceptación real. No se elude mediante API.
- Sin F12/F13/F14, cambios de contenido permanente, owner, Auth, Storage o Analytics.

## Evidencia y commits locales

[Validaciones](f11/local-validation.json), [upgrade/reconstrucción](f11/upgrade.json) y [preflight remoto](f11/preflight.json) contienen resultados reproducibles sin credenciales. Las capturas quedan en `.tools/f11/screenshots/` ignorado. No se utilizan capturas como backup.

- `dc11cc2`: inspección inicial y bloqueo por credencial.
- `a36491a`: CI, Pages, reconciliación y helpers de workflow/health.
- `e6f303d`: observación GitHub, timeout, migración 024 y pruebas SQL/HTTP.
- `773cdf0`: estado de publicación CMS, intención editorial y pruebas de navegador.

La documentación, scripts de operador y evidencia de configuración se conservan en commits separados. No push, PR ni merge de esta rama.

## Configuración de plataforma realizada

Verificación independiente a las **2026-09-07 01:34 UTC** ([evidencia](f11/platform-configured.json)):

- GitHub: cuenta administradora `alarenas1988`; Pages `build_type=workflow`; URL prevista `https://alarenas1988.github.io/portfolio-alonso/`. Environment `github-pages`, única regla de deployment para rama `main`. Sin reglas que bloqueen commits/PR del mantenedor.
- Variables `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY` comprobadas contra configuración local pública; valores no documentados. `BUILD_CALLBACK_HMAC_SECRET` creado de forma coordinada en Actions/Edge; nombres/presencia comprobados sin descargar valores. El PAT configurado por el usuario se conservó sin rotación.
- GitHub todavía tiene **cero workflows**, cero evidencia de CI/Pages deployment; `status` de Pages es null. Configurar Pages no publica el sitio por sí solo.
- Supabase: historial todavía **019–023**, sin db push efectivo, seed, fixtures o escrituras de aplicación remotas. No cambios de Auth, owner, Storage, contenido ni Analytics. `publish-site`/`build-status` permanecen sin desplegar hasta que exista su workflow receptor en main.
- Configurar el HMAC provocó el incremento de versiones de plataforma a contact-submit **v5** y track-event **v3**, ambas ACTIVE. No se ejecutó deploy de su código. No se declara probada una firma remota: la prueba de consumidor sigue pendiente.
- Archivo temporal restringido del HMAC eliminado; ninguna credencial queda en Git, evidencia o output público.

Pendiente de autorización: subir esta rama, abrir PR, verificar CI y hacer merge; después completar la activación controlada de 024/Edge y la aceptación real CMS→GitHub→Pages. La puerta de backend se revalidará inmediatamente antes de aplicar 024, incluyendo respaldo actualizado. F11 no queda cerrada hasta esas pruebas.

## Activación real y bloqueo observado — 2026-09-07 UTC

El usuario autorizó expresamente commit, push, PR y merge. [PR #15](https://github.com/alarenas1988/portfolio-alonso/pull/15) se integró mediante merge commit `bd2ef40702420b85eecae91d2aa4604642b8984a`, sin reescribir historial. La rama y main local se sincronizaron por fast-forward. Las secciones anteriores conservan la inspección previa.

| Control                     | Evidencia real                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI en PR                    | [34074041466](https://github.com/alarenas1988/portfolio-alonso/actions/runs/34074041466): success                                                       |
| CI en main                  | [34074215121](https://github.com/alarenas1988/portfolio-alonso/actions/runs/34074215121): success                                                       |
| Pages desde main            | [34074215118](https://github.com/alarenas1988/portfolio-alonso/actions/runs/34074215118): success; artifact github-pages `10001496988`, 2,267,083 bytes |
| Reconciliación workflow_run | [34074298371](https://github.com/alarenas1988/portfolio-alonso/actions/runs/34074298371): success, sin solicitudes activas en ese momento               |
| URL                         | https://alarenas1988.github.io/portfolio-alonso/                                                                                                        |
| Backend                     | Dry-run solo024; aplicación efectiva024; historial019–024; sin seed                                                                                     |
| Post-deploy                 | Catálogo/tipos iguales, sin migraciones pendientes; 35 tablas con RLS/138 policies, Automatic RLS conservado                                            |
| Edge                        | build-status v1; publish-site v2; contact-submit v5 y track-event v3 conservados                                                                        |

Antes de024 se capturó backup lógico privado (roles/schema/data) con ACL restringida fuera de Git. El manifiesto local `.tools/f11/backup-manifest.json` registra hashes y ubicación. No se presenta como restauración gestionada Free, no incluye bytes Storage y esta captura no fue restaurada independientemente. No se alteraron Auth, owner, buckets, RLS ni contenido editorial.

**Producción pública:** health HTTP de Home, proyectos, blog, sobre mí, contacto, login, recovery y 404; doce assets válidos. Dieciséis E2E (390/1440) aprobados; axe Home/login sin infracciones; DNT/GPC sin eventos. Capturas Home/login y Home con reduced-motion inspeccionadas. El contenido revela secciones al entrar al viewport; una captura larga sin scroll no demuestra falta de datos.

**Contacto/Analytics desde Pages:** dieciséis controles específicos aprobados: cuatro page_views y un envío real del formulario, exactamente una conversión server-side, cero correos salientes. Mensaje/eventos fixture eliminados por sus UUID exactos; agregados recalculados desde el tráfico restante. No se modificó configuración ni código de intake. Las redes/CV no configuradas no se inventaron para la prueba.

**Owner/CMS:** se accedió al Admin de producción con una sesión Auth temporal del owner existente obtenida administrativamente sin enviar correo ni cambiar contraseña. Anon y noowner con metadata owner falsificada no pueden publicar. Se cerraron las sesiones de prueba y eliminaron los usuarios noowner; no se creó otro owner. No se automatizó la contraseña definitiva.

**Bloqueo de dispatch:** la acción CMS llegó a publish-site y creó registros reales, pero GitHub rechazó dispatch con HTTP403. El log seguro de Supabase a las02:02:46UTC confirmó `{function:publish-site,upstream:github,status:403}`. Las solicitudes quedaron failed/dispatch_failed; no hay builds eternamente activos ni workflow CMS iniciado. Se conservan cuatro registros de fallo como historial operacional. No se afirma haber completado CMS→building→Pages→success, cancelación/superseded remotos o callback success para una solicitud CMS. Las pruebas locales de estas rutas permanecen aprobadas.

Se añadió User-Agent explícito al adaptador (requerido por [GitHub](https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api)) y diagnóstico exclusivo del status upstream, con prueba de regresión. Esto no resolvió el403; por tanto no se atribuye el rechazo a ese header. El cuerpo/respuesta/header de GitHub y el PAT nunca se imprimen. Las119 pruebas Edge y check de los cuatro entrypoints pasan. El smoke CMS consulta la reserva por request UUID para no depender de leer tardíamente un response de Chromium tras navegación.

**Acción requerida:** revisar en GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens el token correspondiente a GITHUB_FINE_GRAINED_TOKEN: resource owner alarenas1988, acceso únicamente a portfolio-alonso, Contents Read and write ([requisito oficial de repository_dispatch](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)), Actions Read-only para observar runs/jobs. Confirmar vigencia y aprobación. Si es necesario reemplazarlo, guardar el valor directamente en Supabase Edge Functions Secrets con el mismo nombre, nunca en chat/Git. No se sustituye por la credencial del operador. El403 no demuestra por sí solo cuál configuración concreta falta; requiere revisar el token.

La integración y deployment por código quedan verificados. F11 permanece abierta hasta corregir el acceso y demostrar el recorrido CMS completo. F12/F13/F14 no fueron iniciadas.

Evidencia seleccionada: [activación](f11/activation.json), [push DB](f11/db-deploy.json), [intake Pages](f11/pages-intake.json). Los logs y capturas de operación permanecen ignorados en .tools/f11.

## Permiso corregido y consulta del HEAD — 2026-09-07 UTC

El usuario confirmó Contents Read and write. GitHub aceptó repository_dispatch y el callback owner/HMAC funcionó. Se observó un deployment CMS exitoso (run34076613726) y, en el smoke posterior (run34076748680), fallo de la comprobación remota de main antes de publicar Pages. Se confirmó que ambos usaban el mismo SHA1195aba7 todavía actual. El último deployment correcto se conservó y el callback registró failed/deploy_failed. El error seguro previo no conservaba el status de la consulta de main, por lo que no se atribuye con certeza a rate limiting.

La consulta de main era anónima; esos requests comparten una cuota por IP. Se cambia únicamente ese paso a autenticación mediante el GITHUB_TOKEN efímero del job, recomendado por [GitHub](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api). No se crea secret, no se amplían permisos y no se usa el PAT Supabase en Actions. El token se pasa exclusivamente al paso Confirm current main; no entra al build público ni al health de Pages. Se mantienen destino fijo, timeout, prohibición de redirects y comparación estricta del SHA. Un HTTP fallido se informa por status sin imprimir cuerpo ni headers; la consulta falla de forma cerrada. Nueva prueba verifica header, destino, redirects y ausencia de token en errores.

## Cierre de aceptación F11

[PR #16](https://github.com/alarenas1988/portfolio-alonso/pull/16) integró diagnóstico/evidencia en1195aba7. [PR #17](https://github.com/alarenas1988/portfolio-alonso/pull/17) integró la consulta autenticada de main en `ca25934adbdad1eb1283b7f235fe0e43873af2e7`; [CI34077113205](https://github.com/alarenas1988/portfolio-alonso/actions/runs/34077113205) y deployment por código34077258994 aprobaron.

La corrección de Contents por el usuario resolvió el403. No se volvió a generar ni leer el PAT. [Publicación CMS34077290325](https://github.com/alarenas1988/portfolio-alonso/actions/runs/34077290325) completó queued→building→success en136s, incluyendo espera por el deployment de código. El CMS mostró Sitio actualizado y el servidor verificó job, paso Pages y deployment real. Se repitió el mismo request UUID y existe un solo workflow. Evidencia: [CMS success](f11/cms-success-verified.json).

[Cancelación34077743526](https://github.com/alarenas1988/portfolio-alonso/actions/runs/34077743526): se canceló únicamente la solicitud creada por el smoke, antes de Pages. GitHub canceló el run en11s; después se registró failed/cancelled mediante reconciliación, sin deployment_id ni modificación del sitio anterior. La recuperación automática y la alerta CMS se verificaron realmente;13 controles remotos aprobados. Evidencia: [CMS cancellation](f11/cms-cancel-production.json). También hubo una cancelación previa34077590873 cuya transición backend pasó; el selector de la prueba esperaba status en vez de alert. Se corrigió el harness, sin cambiar el comportamiento accesible de la aplicación.

La primera prueba combinada completó publicación normal y falló después en la lectura de correlación de la segunda solicitud. El harness ahora registra request_id/HTTP sin headers, reintenta únicamente la lectura de forma acotada y permite ejecutar la cancelación de forma independiente. No se reenvía automáticamente un POST para recuperar una lectura. El resultado positivo normal se conserva mediante fila DB, run/deployment GitHub y captura del CMS.

Se separaron Ver sitio/Ver ejecución/Reintentar mediante cms-toolbar existente, detectado al inspeccionar la captura de producción. Tres E2E locales de publicación pasan: respuesta perdida/idempotencia/doble click/polling, fallo con role=alert/salida del módulo e intención editorial nueva. Capturas390/1440 revisadas y axe sin infracciones. No se creó CSS ni un diseño alternativo.

Health posterior a cancelación: ocho rutas y doce assets correctos. Contacto/Analytics conservan la evidencia anterior de Pages:16 controles, cuatro page_views y una conversión server-side, fixtures exactos eliminados. Las sesiones/usuarios Auth temporales se cerraron/eliminaron; owner, password, Auth config, RLS y Storage no cambiaron. Los site_builds reales, incluidos fallos, se conservan como historial. [Estado de cierre](f11/closure.json).

### Entrega solicitada

| #   | Punto             | Resultado                                                                                                                                                                                                                                                                                    |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SHA base          | 8bb9815d869064621254d4ccbfe087b1e4962b4d, main con F10B                                                                                                                                                                                                                                      |
| 2   | Rama/worktree     | feat/f11-c2-deployment; .worktrees/f11-c2-deployment                                                                                                                                                                                                                                         |
| 3   | Pages inicial     | Deshabilitado antes de F11                                                                                                                                                                                                                                                                   |
| 4   | Actions inicial   | Sin workflows                                                                                                                                                                                                                                                                                |
| 5   | Workflows         | ci.yml, deploy-pages.yml, reconcile-builds.yml; oficiales fijadas por SHA                                                                                                                                                                                                                    |
| 6   | Triggers          | PR/pushmain CI; pushmain, portfolio_publish y manual Pages; workflow_run, cron y manual reconciliación                                                                                                                                                                                       |
| 7   | Node              | 24.20.0 desde .nvmrc; npm11.19.0                                                                                                                                                                                                                                                             |
| 8   | Permisos          | contents read; deploy agrega pages write/id-token write; nunca write-all                                                                                                                                                                                                                     |
| 9   | Variables GitHub  | PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY; valores no documentados                                                                                                                                                                                                                |
| 10  | Secrets GitHub    | BUILD_CALLBACK_HMAC_SECRET; GITHUB_TOKEN efímero solo en consulta de main                                                                                                                                                                                                                    |
| 11  | Secrets Supabase  | GITHUB_FINE_GRAINED_TOKEN, BUILD_CALLBACK_HMAC_SECRET para C2; los de intake no se alteraron                                                                                                                                                                                                 |
| 12  | PAT               | Operativo: Contents read/write, Actions read, Metadata read; usuario confirmó permisos                                                                                                                                                                                                       |
| 13  | Pages             | GitHub Actions; environment github-pages limitado a main                                                                                                                                                                                                                                     |
| 14  | URL               | https://alarenas1988.github.io/portfolio-alonso/                                                                                                                                                                                                                                             |
| 15  | CI real           | PR15/16/17 y sus merges pasaron;189 unit en revisión final                                                                                                                                                                                                                                   |
| 16  | Deployment real   | Código y CMS exitosos; ver runs enlazados                                                                                                                                                                                                                                                    |
| 17  | Artifact          | github-pages oficial, dist, retención1día; artifact inicial10001496988                                                                                                                                                                                                                       |
| 18  | Media F8          | Snapshot público→assets inmutables→dist; sin cache de snapshot/dist ni archivos PC                                                                                                                                                                                                           |
| 19  | Rutas             | Home/proyectos/blog/sobre-mi/contacto/login/recovery/404 verificadas                                                                                                                                                                                                                         |
| 20  | Admin producción  | Páginas físicas, noindex y datos solo tras Auth                                                                                                                                                                                                                                              |
| 21  | Owner producción  | Sesión Auth real temporal del owner existente; contraseña definitiva no automatizada ni cambiada                                                                                                                                                                                             |
| 22  | Contacto          | Envío real desde Pages, una recepción, no email saliente, fixture eliminado                                                                                                                                                                                                                  |
| 23  | Analytics         | Cuatro page_views y conversión real; DNT/GPC respetados, fixtures eliminados                                                                                                                                                                                                                 |
| 24  | publish-site      | Remoto ACTIVE v2, owner-only e idempotente                                                                                                                                                                                                                                                   |
| 25  | Dispatch          | Real aceptado; payload mínimo build_id, código exclusivamente main                                                                                                                                                                                                                           |
| 26  | Queued            | Observado para solicitud CMS                                                                                                                                                                                                                                                                 |
| 27  | Building          | Observado mediante callback firmado y GitHub real                                                                                                                                                                                                                                            |
| 28  | Success           | Solo tras job/paso Pages y deployment confirmado; reflejado en CMS                                                                                                                                                                                                                           |
| 29  | Failed            | Cancelación remota y fallo de consulta main registrados sin tocar Pages anterior                                                                                                                                                                                                             |
| 30  | Idempotencia      | Mismo request UUID, mismo build y un solo workflow; cooldown conservado                                                                                                                                                                                                                      |
| 31  | Concurrency       | Deployment activo termina; siguiente en cola; ejecución secuencial observada                                                                                                                                                                                                                 |
| 32  | Reconciliación    | workflow_run comprobado; */15 y manual configurados; pérdida/timeout/truncamiento/superseded cubiertos localmente                                                                                                                                                                            |
| 33  | CMS acceptance    | Recorrido completo real con owner, sin contenido editorial inventado                                                                                                                                                                                                                         |
| 34  | Tiempo            | 136s desde solicitud, incluyendo cola; cancelación11s en GitHub, estado reconciliado después                                                                                                                                                                                                 |
| 35  | Health            | Ocho rutas y doce assets tras deployment/cancelación                                                                                                                                                                                                                                         |
| 36  | 404               | HTTP404 real y contenido estático correcto; sin fallbackSPA                                                                                                                                                                                                                                  |
| 37  | Seguridad         | RLS35tablas/138policies; anon/noowner denegados; owner inactivo cubierto local; HMAC adversarial remoto denegado                                                                                                                                                                             |
| 38  | Secretos          | 381artefactos escaneados; sin password/JWT/PAT/HMAC en dist o Git                                                                                                                                                                                                                            |
| 39  | E2E producción    | 16mobile/desktop; smoke CMS real y13controles cancelación                                                                                                                                                                                                                                    |
| 40  | Accesibilidad     | axeHome/login; CMS390/1440 local, role alert en errores, capturas inspeccionadas                                                                                                                                                                                                             |
| 41  | Regresión         | npmci/ls/audit0/format/lint/typecheck/test/build/static/secrets;798SQL,119Edge,107AuthHTTP,79EdgeHTTP,13publishingHTTP;67publicE2E y pruebas Admin relevantes                                                                                                                                |
| 42  | Archivos          | Ver changed-files.txt y commits; workflows, helpers, CMS publicación,024, pruebas y documentación                                                                                                                                                                                            |
| 43  | Dependencias      | Ninguna nueva dependencia npm de aplicación/Analytics; Actions oficiales y actionlint1.7.12 de validación                                                                                                                                                                                    |
| 44  | Commits           | Historial de rama con commits pequeños; integracionesPR15/16/17; evidencia de cierre en commit separado                                                                                                                                                                                      |
| 45  | Desviaciones      | 024mínima justificada; deploy de código sin filas artificiales site_builds; Authowner por sesión temporal segura; ajustes de harness documentados                                                                                                                                            |
| 46  | Riesgos           | Cron GitHub puede demorarse: ningún schedule automático observado en esta sesión; workflow_run real probado y recuperación manual disponible. No se garantiza SLA. PAT tiene expiración; backup lógico capturado no restaurado independientemente. Sin CV/media/editorial real adicional aún |
| 47  | Fases posteriores | F12/F13/F14 NO iniciadas                                                                                                                                                                                                                                                                     |

F11 queda funcionalmente verificada. El primer disparo por schedule no se presenta como observado; esto no sustituye la evidencia automática real de workflow_run. No se prometen rollback automático post-deploy ni publicación si las verificaciones fallan.
