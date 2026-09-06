# CMS administrativo — F7

Trabajo aislado en `feat/f7-admin-cms`, desde `origin/main` `5f0e42910983dfbf14c919769d2c057c7811625e` (F10, PR #12). F7 no configura GitHub Pages ni inicia F10B/F11/F12/F13/F14.

## Rutas y carga

Astro genera páginas físicas bajo la base configurada. `/admin/`, `login/`, `reset-password/`, `projects/`, `projects/new/`, `projects/edit/`, `posts/`, `posts/new/`, `posts/edit/`, `experience/`, `technologies/`, `specialties/`, `principles/`, `impact/`, `media/`, `documents/`, `messages/`, `analytics/`, `contact/`, `social/`, `seo/`, `settings/`, `builds/`, `categories/` y `tags/`.

Los editores por enlace usan `?id=UUID`. Un identificador inválido se rechaza antes de consultar; uno inexistente muestra un estado administrativo vacío. El retorno tras login acepta exclusivamente rutas físicas del Admin y un UUID editorial válido; descarta parámetros adicionales y destinos externos.

El HTML contiene únicamente el shell, textos de interfaz y metadata `noindex,nofollow`. No obtiene datos privados durante el build. Los módulos TypeScript cargan después de verificar Auth; editor, biblioteca y Analytics se importan según la ruta. No hay framework de UI adicional. El sitio público conserva sus layouts y componentes.

## Auth y permisos

La seguridad sigue en JWT, `admin_profiles`, grants/RLS y autorización Edge. `resolveAdminAccess()` llama `auth.getUser()` y lee el perfil de esa identidad a través de RLS. No confía en metadata, email, localStorage ni flags de interfaz. F6 oculta los perfiles ausentes/inactivos a sus propios usuarios; ambos reciben el mismo estado seguro de acceso denegado. Se distingue de sesión anónima, owner activo y error de conectividad.

El SDK oficial mantiene y refresca la sesión. No se persisten caches de mensajes, Analytics, roles ni borradores. Al cerrar sesión se retira el contenido privado del DOM, se revoca la sesión actual y se navega a login. Ante expiración, el editor queda oculto y sus cambios permanecen en memoria de la pestaña; se puede reautenticar en otra pestaña y reintentar. Un cambio de identidad descarta el estado anterior. Las peticiones del cliente administrativo tienen un límite de 15 segundos.

Recovery usa el contrato PKCE de F6: solicitud por `resetPasswordForEmail`, callback físico verificado, `exchangeCodeForSession`, comprobación owner y `updateUser`. El código se retira de la URL antes de continuar. El enlace debe abrirse en el mismo navegador que realizó la solicitud. No hay signup ni formulario de alta. [Recovery Supabase](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

Las URLs remotas aprobadas continúan bajo `https://alarenas1988.github.io/portfolio-alonso/admin/` y `admin/reset-password/`; desarrollo de recovery utiliza `http://localhost:4321/portfolio-alonso/admin/reset-password/`. No cambiar Auth remoto para acomodar puertos temporales de testing.

## Edición y persistencia

`src/lib/admin/resources.ts` define campos tipados contra los tipos generados del esquema. Cada dato sigue almacenándose en sus columnas y tablas relacionales; no hay tablas JSON genéricas. Los listados de contenido consultan 20 registros por página, con búsqueda y orden. Los selectores acotan resultados y permiten búsqueda.

Proyectos y posts usan páginas físicas de creación/edición. General, Contenido, SEO y Relaciones organizan los campos opcionales. Experiencia utiliza el mismo control de campos con sus relaciones específicas. Las tecnologías, especialidades, principios, métricas textuales, categorías, tags y redes usan formularios según su esquema. Settings y contacto editan los singletons existentes; SEO expone los campos globales y de cada recurso. Las URLs administrables se validan como HTTPS sin credenciales.

La migración aditiva `20260906002300_admin_editorial_transactions.sql` agrega `save_project`, `save_post` y `save_experience`. Son `SECURITY INVOKER`, con `search_path` vacío, EXECUTE solo authenticated y comprobación owner explícita. Cada RPC bloquea la fila, compara `updated_at`, escribe una allowlist de columnas y sustituye las relaciones presentes en el payload dentro de la misma transacción. La validación de FK/CHECK/UNIQUE sigue en PostgreSQL. Un error en un hijo revierte también el padre. Los IDs de hijos existentes no pueden trasladarse a otro padre. El payload JSON es únicamente el transporte acotado de la RPC.

Los cambios directos en tablas hijas también actualizan la revisión del padre mediante un trigger invoker. Así, un editor abierto no reemplaza silenciosamente relaciones modificadas por otro cliente. No se modifican 019–022, RLS, grants de tablas ni schemas administrados. [Funciones PostgreSQL en Supabase](https://supabase.com/docs/guides/database/functions).

Un conflicto editorial devuelve `PT409` / HTTP 409. La prueba HTTP detectó que utilizar `40001` para este caso provocaba reintentos de transacción en PostgREST y terminaba en timeout. `40001` se reserva a errores reales de serialización; la revisión editorial usa el mecanismo soportado de [errores HTTP explícitos de PostgREST](https://docs.postgrest.org/en/v14/references/errors.html#raise-errors-with-http-status-codes). La suite comprueba tanto el rechazo SQL como su respuesta real al navegador.

Autosave usa debounce de 1,5 segundos y una cola por editor. Estados: Sin cambios, Cambios pendientes, Guardando, Guardado, Error y Conflicto. Una respuesta anterior nunca marca como guardados cambios posteriores. Los errores conservan el texto y requieren reintento; un conflicto requiere cargar la revisión más reciente. Hay aviso del navegador ante cambios sin guardar y confirmación antes de recargar descartándolos.

## Guardar y publicar

Guardar persiste en Supabase. Publicar valida referencias de media, guarda visibilidad/estado editorial y solicita `publish-site` con JWT e identificador de solicitud. El sitio estático no cambia por guardar. Otro build puede recoger los cambios de un registro que ya sea público: no existe versionado editorial aislado en V1.

F11 sigue pendiente. La función de dispatch no está habilitada remotamente; el CMS muestra **contenido público guardado / rebuild pendiente**, nunca “sitio actualizado”. `site_builds` se consulta en lectura, con queued/building/success/failed, fecha, commit, duración y error resumido. No se crea workflow, PAT ni callback productivo.

## Markdown y multimedia

El editor importa exactamente `renderMarkdown()` de F4, con el mismo parser, sanitizer, TOC y resaltado. No admite HTML ejecutable. Las imágenes utilizan referencias `media:UUID`; la preview obtiene archivos autorizados mediante Storage API y usa URLs Blob efímeras en memoria, revocadas al retirar la preview. Nunca persiste signed URLs ni incorpora recursos privados al artefacto público.

La biblioteca integra los repositorios y servicios de F8: upload privado, validación de bytes/MIME/extensión/tamaño, metadata, alt/decorative, copia pública explícita, usos, reemplazo y eliminación. El selector conserva solamente el ID editorial. Borrar archivos referenciados queda bloqueado por el servicio, relaciones y FK UUID de Storage. Los reemplazos conservan el objeto anterior hasta su retiro explícito. La eliminación normal pide confirmación; una limpieza parcial se informa.

Documentos utiliza `registerDocument` y `activate_cv`: PDF validado, registro inactivo y activación de un CV público en transacción, desactivando el anterior. Configuración de contacto controla si se expone la descarga. No existe subida directa a un bucket público desde el control normal.

Publicar PDF crea una copia mediante F8 y vincula únicamente ese documento con control de `updated_at`. Conserva el archivo privado original. Si falla la vinculación, la copia permanece identificada en Multimedia y la UI informa que debe revisarse; no elimina silenciosamente ninguno de los archivos. Se puede editar título, verificar, activar/desactivar y eliminar el registro conservando sus bytes.

## Mensajes, Analytics y auditoría

Los mensajes se presentan como nodos de texto, con filtros y estados new/read/replied/archived. El owner puede actualizar solo status mediante el grant de F6. Responder abre su cliente de correo; copiar y marcar respondido no simulan un envío. No hay eliminación libre de mensajes ni proveedor saliente nuevo.

Analytics consume `loadAnalyticsReport()` de F10 y su RPC owner-only: 7/30/90/366 días o rango personalizado limitado; vistas, sesiones aproximadas, conversiones, interacciones, tablas top y tendencia SVG. No consulta raw events ni modifica tracking, retención o identidad. Los módulos Admin no cargan el script público de Analytics.

`admin_activity` conserva su contrato de lectura owner y escritura reservada a servicios. F7 no abre INSERT/UPDATE desde el navegador ni inventa una auditoría por pulsación. La auditoría operacional de F9 continúa existente; no había un trigger general de CRUD editorial que pudiera invocarse desde estos formularios.

## Verificación y límites

`playwright.admin.config.ts` ejecuta los recorridos contra Supabase local real. `scripts/admin-local-fixtures.mjs` exige el stack loopback aislado, crea usuarios Auth temporales, media vía API y contenido de prueba. Las contraseñas/sesiones aleatorias viven solamente en `.tools/` ignorado; no se registran en reportes o capturas. La limpieza elimina fixtures identificables, nunca datos remotos.

Las suites generales continúan usando fixtures públicos aislados y Analytics deshabilitado. El checkpoint de F7 debe registrar por separado pruebas locales, revisión de capturas, validación remota y cualquier limitación de login remoto. No considerar un shell visible como evidencia de autorización.
