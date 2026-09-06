# Seguridad del portfolio

## Frontera Edge F9 — 2026-09-06

`authenticated != administrator` sigue vigente. Las nuevas RPC tienen EXECUTE solo service_role, SECURITY INVOKER y search_path vacío; no hay nuevos definer ni grants/policies de navegador. Publicación verifica JWT/Auth/perfil activo en RLS y de nuevo en la transacción. Contacto valida texto, tamaños, honeypot, duración e idempotencia; no INSERT público. CORS explícito no sustituye identidad ni límites. Callback con HMAC/ventana y transiciones irreversibles. Los hashes diarios de abuso no contienen IP/UA completos y caducan con limpieza periódica. [Matriz, pruebas adversariales, secretos y límites](EDGE_FUNCTIONS.md).

El formulario cliente es UX; las pruebas reales llaman Edge/DB sin depender de esa protección. Contact-submit v2 está activo en remoto, con 27 comprobaciones y limpieza verificadas. La plataforma rechaza CF-Connecting-IP falsificado; XFF no define el cliente en hosted. Se contrastaron las definiciones completas propias, constraints, columnas, índices, triggers, grants y policies con la reconstrucción local. [Evidencia de cierre](checkpoints/F9_EDGE_FUNCTIONS.md). F9 no modifica Auth, owner, buckets ni las policies aprobadas. El historial siguiente describe cada checkpoint en su fecha.

## Backend remoto desplegado — 2026-09-06

019 ya está aplicada en portfolio-alonso. Auditoría real: 32 tablas public y 3 private con RLS, 138 policies, tres funciones SECURITY DEFINER propias con owner postgres/search_path vacío, cuatro vistas y Automatic RLS conservado. El catálogo remoto coincide con la reconstrucción local. [Evidencia completa](checkpoints/INITIAL_DEPLOY.md).

28 comprobaciones API anónimas iniciales y 139 comprobaciones posteriores con sesiones reales correctas. Signup deshabilitado y rechazo signup_disabled comprobado; URLs exactas de Auth configuradas. El usuario creó su Auth definitivo; bootstrap administrativo fuera de migraciones produjo un único owner activo. Se comprobó private.is_portfolio_admin y CRUD con su JWT real, sin leer ni cambiar contraseña ni versionar UUID.

Anon, noowner e inactivo no pudieron obtener drafts/hijos/futuros/privados, hacer CRUD, escalar mediante user_metadata/UUID/role/active ni administrar Storage. El snapshot público fue equivalente para los cuatro roles. El owner tampoco puede crear otro owner o modificar atributos de autorización desde API. Las credenciales administrativas se usaron solo en preparación/limpieza; las aserciones de permisos usaron publishable key y JWT Auth reales. Dos cuentas temporales y todos sus fixtures quedaron eliminados. La sesión temporal del owner se cerró con scope local; no se revocaron otras sesiones. Ver [evidencia remota](checkpoints/initial-deploy/owner-smoke.json) y [estado final sin drift](checkpoints/initial-deploy/final-state.json).

## Instalación inicial y Automatic RLS

La baseline 019 instala esquema, grants y RLS en una transacción, sin crear la FK compuesta de 014. Su guard bloquea bases con aplicación/datos previos; un observador DDL local demostró que ni siquiera aparece una FK no-PK transitoria. Las 18 migraciones anteriores se conservan como fuentes inmutables, no como camino de instalación nuevo. [Pruebas de equivalencia y recuperación](checkpoints/INITIAL_BASELINE.md).

El catálogo local auditado incluye las tres funciones SECURITY DEFINER propias y la función de evento preexistente `public.rls_auto_enable()`, restaurada desde el respaldo remoto para el ensayo. No es una nueva RPC administrativa. Los tests distinguen la función de plataforma y verifican su tipo event_trigger, owner postgres y search_path pg_catalog; la prueba de instalación compara también cuerpo/ACL y el event trigger, sin cambiarlos. Todas las funciones propias conservan el search_path vacío.

La reconciliación de historial se permite en el ensayo únicamente después de comprobar equivalencia de catálogo y respaldar el registro anterior. No concede permisos editoriales ni aplica SQL funcional. No se ejecutó repair, cambios Auth/owner ni despliegue en remoto.

## Estado remoto inspeccionado el 2026-09-06

El [checkpoint remoto](checkpoints/SUPABASE_REMOTE_READINESS.md) es una auditoría de solo lectura, sin aprobación de despliegue efectivo. Remoto aún no contiene las tablas/policies/RPC del portfolio. Automatic RLS está habilitado mediante ensure_rls y una función de evento SECURITY DEFINER de plataforma con search_path pg_catalog; se conserva. Las tres funciones SECURITY DEFINER propias siguen únicamente en local, con owner postgres y search_path vacío. El registro público remoto está habilitado y debe cerrarse antes de declarar el backend listo. No se crearon usuarios ni fixtures, ni se probaron escrituras remotas.

La evidencia histórica de F6/F8 no sustituye la matriz remota. La corrección Storage 018 ya se valida en un stack local aislado; no autoriza por sí sola el despliegue. La clave pública solo sirvió para dos GET de inspección; no se extrajeron secretos de la sesión del navegador.

## Corrección de Storage 018

La única FK propia hacia Storage referencia ahora su PK UUID, con ON DELETE/UPDATE RESTRICT. El trigger propio `private.validate_storage_object_identity()` es SECURITY INVOKER, search_path vacío, sin EXECUTE de clientes. Verifica identidad/localización y autor owner; no amplía grants ni policies ni agrega SECURITY DEFINER. El bloqueo de integridad lo realiza PostgreSQL al validar la FK, sin exigir UPDATE de Storage al caller. Las tres funciones definer de F6 permanecen sin cambios.

API DELETE de un objeto registrado falla sin retirar sus bytes. No se habilitan upsert, overwrite ni move; reemplazar exige otro objeto. Tras desvincular usos, se elimina metadata y luego bytes mediante API, con compensación y reporte ante fallo. Las pruebas Auth/media crean y limpian objetos exclusivamente mediante Storage API; los tests SQL de catálogo usan fixtures transaccionales que se revierten. [Evidencia completa](checkpoints/STORAGE_OBJECT_IDENTITY.md).

## Ampliación vigente de F8

F8 conserva la autorización owner y RLS de F6, exclusivamente local. El catálogo SECURITY_AUDIT.json se regeneró con esta fase. Las secciones siguientes describen la frontera entregada en F6; estos cambios de F8 prevalecen para multimedia:

- Se crean portfolio-public, blog, documents y private, con 10 MiB y MIME explícitos.
- Storage conserva cuatro policies: lectura pública y SELECT/INSERT/DELETE owner. Se elimina UPDATE para denegar sobrescritura/upsert/move incluso al owner; el reemplazo crea una ruta UUID nueva.
- media_assets incluye decorative; solo imágenes marcadas decorativas admiten alt vacío. El navegador no modifica dimensiones, tamaño ni visibility. La FK al objeto impide borrar bytes registrados mediante la API de Storage.
- Los triggers registran FK y tokens Markdown, también logos de tecnologías. Borrar manualmente una referencia no permite saltarse la comprobación del Markdown original al eliminar un asset.
- replace_media_asset y activate_cv son RPC adicionales SECURITY INVOKER, con EXECUTE authenticated y comprobación owner explícita. No se agregan funciones SECURITY DEFINER; siguen siendo las tres justificadas de F6.
- Los PDF generales publicados no dependen de cv_enabled; el CV mantiene su visibilidad y unicidad propias.
- Un archivo privado permanece en private, sin URL pública persistente. Preview usa URL firmada de 60 segundos. El build no admite URLs firmadas, destinos arbitrarios ni fallback ante archivos requeridos inválidos.
- La validación de bytes ocurre en servicios/build. RLS y MIME de bucket no equivalen a decodificación del archivo en el servidor; un owner que evite los servicios puede cargar bytes inválidos, cuyo uso en build falla.

Matriz, compensación, SSRF, validación y riesgos de actualización del catálogo administrado: [MEDIA.md](MEDIA.md). No se modificaron Supabase remoto, Auth remoto ni Automatic RLS.

F6 implementa y verifica la autorización exclusivamente en Supabase local. El proyecto remoto y Automatic RLS no se han modificado. La aprobación de esta fase es previa a cualquier despliegue remoto.

## Arquitectura y límites de confianza

La API valida el JWT mediante Supabase. PostgreSQL autoriza cada consulta usando auth.uid(), admin_profiles, grants y RLS. La publishable key identifica la aplicación; no representa una identidad ni concede administración. Solo un perfil con el UUID autenticado, role=owner y active=true autoriza contenido privado o CRUD.

`private.is_portfolio_admin()` es SQL STABLE, SECURITY DEFINER, owned by postgres y search_path vacío. Consulta exclusivamente `public.admin_profiles` con `auth.uid()`, sin parámetros ni metadata del navegador. El propietario de la función puede leer esa tabla sin reentrar en su policy, evitando recursión. EXECUTE solo authenticated, no PUBLIC ni anon.

La función se usa en policies mediante `(select private.is_portfolio_admin())`. Cada INSERT/UPDATE verifica WITH CHECK y cada UPDATE/DELETE aplica USING. Cambiar active administrativamente retira permisos inmediatamente, incluso con un JWT todavía válido. Un owner inactivo se comporta como noowner.

`getVerifiedUser()` consulta Auth con getUser(); `requireOwner()` consulta el perfil permitido por RLS. Estos helpers son guards de UX para F7: ninguna prueba SQL/REST depende de ellos para denegar escrituras. getSession, email, user_metadata, localStorage o un UUID enviado no constituyen autorización.

## Matriz efectiva

| Operación                                     | anon         | authenticated sin perfil    | owner inactivo              | owner activo                                       |
| --------------------------------------------- | ------------ | --------------------------- | --------------------------- | -------------------------------------------------- |
| Contenido público y snapshot                  | Sí, filtrado | Sí, mismo resultado público | Sí, mismo resultado público | Sí, mismo resultado público                        |
| Drafts, archivados, posts futuros             | No           | No                          | No                          | Sí en consultas administrativas; nunca en snapshot |
| CRUD editorial                                | No           | No                          | No                          | Sí                                                 |
| Contacto oculto / metadatos internos          | No           | No                          | No                          | Sí por tablas administrativas                      |
| Leer mensajes/analytics/builds/auditoría      | No           | No                          | No                          | Sí                                                 |
| Cambiar estado de mensaje                     | No           | No                          | No                          | Solo status                                        |
| Insertar eventos, builds o auditoría          | No           | No                          | No                          | No desde navegador                                 |
| Crear perfil owner / cambiar role, active, id | No           | No                          | No                          | No desde navegador                                 |
| Cambiar display_name/avatar_url propio        | No           | No                          | No                          | Sí                                                 |
| Leer media privada de Storage                 | No           | No                          | No                          | Solo objetos de su identidad y rutas aprobadas     |
| Upload/upsert/update/delete de Storage        | No           | No                          | No                          | Solo bucket/ruta y owner_id permitidos             |
| Registro público Auth                         | No           | No                          | No                          | No; alta inicial por canal administrativo          |

authenticated es un rol de transporte compartido, no un rol administrativo. Sus grants habilitan operaciones potenciales; RLS decide si existen filas/operaciones autorizadas. Una denegación puede ser un error 42501 o un resultado vacío/UPDATE 0/DELETE 0. Las pruebas comprueban ambas formas y que no cambia el dato protegido.

## Tablas public y policies

Todas las 32 tablas tienen RLS habilitado. Las policies owner_read/owner_insert/owner_update/owner_delete se limitan al contenido editorial; public_read aplica la condición indicada. No hay GRANT ALL, TRUNCATE, TRIGGER ni REFERENCES de aplicación para anon/authenticated.

| Tabla                     | RLS | Política efectiva                                                                 |
| ------------------------- | --- | --------------------------------------------------------------------------------- |
| `admin_profiles`          | Sí  | Solo owner activo sobre su propia fila; UPDATE limitado a display_name/avatar_url |
| `site_settings`           | Sí  | SELECT público; CRUD owner; URLs cacheadas solo de media pública                  |
| `contact_settings`        | Sí  | Solo owner; público usa public_contact_settings con campos ocultos a NULL         |
| `social_links`            | Sí  | SELECT si visible; CRUD owner                                                     |
| `projects`                | Sí  | SELECT published, no archived y published_at <= now(); CRUD owner                 |
| `project_features`        | Sí  | SELECT si proyecto público; CRUD owner                                            |
| `project_images`          | Sí  | SELECT si proyecto público y asset público; CRUD owner                            |
| `project_metrics`         | Sí  | SELECT visible y proyecto público; CRUD owner                                     |
| `project_challenges`      | Sí  | SELECT si proyecto público; CRUD owner                                            |
| `project_technologies`    | Sí  | SELECT proyecto público + tecnología visible; CRUD owner                          |
| `technologies`            | Sí  | SELECT visible; CRUD owner                                                        |
| `posts`                   | Sí  | SELECT published y published_at <= now(); CRUD owner                              |
| `post_categories`         | Sí  | SELECT visible; CRUD owner                                                        |
| `post_category_relations` | Sí  | SELECT post público + categoría visible; CRUD owner                               |
| `tags`                    | Sí  | SELECT si usado por post público; CRUD owner                                      |
| `post_tags`               | Sí  | SELECT si post público; CRUD owner                                                |
| `experiences`             | Sí  | SELECT visible; CRUD owner                                                        |
| `experience_highlights`   | Sí  | SELECT si experiencia visible; CRUD owner                                         |
| `experience_projects`     | Sí  | SELECT experiencia visible + proyecto público; CRUD owner                         |
| `experience_technologies` | Sí  | SELECT experiencia visible + tecnología visible; CRUD owner                       |
| `specialties`             | Sí  | SELECT visible; CRUD owner                                                        |
| `work_principles`         | Sí  | SELECT visible; CRUD owner                                                        |
| `impact_metrics`          | Sí  | SELECT visible; CRUD owner                                                        |
| `media_assets`            | Sí  | Solo owner; público usa public_media_assets sin created_by/rutas internas         |
| `media_references`        | Sí  | SELECT asset público y padre editorial público; CRUD owner                        |
| `documents`               | Sí  | SELECT activo + cv_enabled + asset público; CRUD owner                            |
| `contact_messages`        | Sí  | SELECT owner; UPDATE solo status; inserción de servicio                           |
| `analytics_events`        | Sí  | SELECT owner; inserción de servicio                                               |
| `analytics_daily`         | Sí  | SELECT owner; escritura de servicio                                               |
| `analytics_daily_content` | Sí  | SELECT owner; escritura de servicio                                               |
| `admin_activity`          | Sí  | SELECT owner; INSERT servicio; ningún UPDATE/DELETE de navegador                  |
| `site_builds`             | Sí  | SELECT owner; escritura de servicio                                               |

Las tres tablas de private también mantienen RLS: analytics_daily_dimensions y analytics_daily_sessions permiten SELECT solo al owner; rate_limit_buckets no tiene grants de cliente. Dos vistas administrativas invoker permiten al futuro CMS leer los agregados privados con la misma RLS.

## Grants explícitos

- anon: SELECT sobre las 23 tablas editoriales con public_read y las dos proyecciones públicas; EXECUTE de get_public_snapshot y de helpers de proyección/ruta usados por las policies. Sin grants directos a contact_settings, media_assets, admin_profiles ni tablas operacionales.
- authenticated: SELECT/INSERT/UPDATE/DELETE potencial sobre las 25 tablas de contenido, siempre sujeto a owner/RLS. En media_assets, UPDATE se limita a visibility, filename, file_size, width, height, alt_text, caption y category; created_by se fija por defecto a auth.uid() y WITH CHECK impide falsificarlo al insertar.
- admin_profiles: SELECT y UPDATE(display_name, avatar_url) solamente; sin INSERT/DELETE ni UPDATE(id, role, active).
- contact_messages: SELECT y UPDATE(status); sin INSERT/DELETE ni cambios de cuerpo/notificación.
- Analytics, builds, auditoría: SELECT para authenticated filtrado al owner, sin escrituras del navegador.
- service_role: grants explícitos a las escrituras operacionales previstas. La clave privada solo se usa en las pruebas locales para alta Auth administrativa; no entra en src ni en dist. F9 deberá usarla exclusivamente desde backend.
- private: USAGE para authenticated permite evaluar helpers y acceder a agregados autorizados, pero el esquema está excluido de la Data API. USAGE no concede SELECT ni EXECUTE de otras funciones.

El detalle exacto por tabla, columna, rol, grantor y operación, junto con todas las condiciones de policies, se genera del catálogo en [SECURITY_AUDIT.json](SECURITY_AUDIT.json) mediante `npm run db:audit`. No contiene datos de usuarios ni credenciales.

## Funciones, vistas y snapshot

| Función de aplicación                   | Modo                                 | EXECUTE de cliente | Justificación                                                                      |
| --------------------------------------- | ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------- |
| private.is_portfolio_admin()            | Definer, postgres, search_path vacío | authenticated      | Lookup del perfil sin recursión; boolean sin parámetros                            |
| private.read_public_contact()           | Definer, postgres, search_path vacío | anon/authenticated | Proyección fija que pone email/WhatsApp ocultos a NULL                             |
| private.read_public_media()             | Definer, postgres, search_path vacío | anon/authenticated | Solo assets públicos; excluye created_by, bucket/ruta y timestamps internos        |
| private.storage_path_allowed(text,text) | Invoker, search_path vacío           | anon/authenticated | Predicado puro de bucket/ruta, sin consultas ni privilegios elevados               |
| public.get_public_snapshot()            | Invoker, STABLE, search_path vacío   | anon/authenticated | Una lectura consistente y proyección explícita; no devuelve tablas administrativas |
| Helpers de triggers                     | Invoker, search_path vacío           | Ninguno            | Ejecución asociada a triggers ya creados; no RPC de escritura                      |

Existen exactamente tres SECURITY DEFINER de aplicación. Son privados, de lectura, sin SQL dinámico ni argumentos controlables que seleccionen otras filas/funciones. Las dos proyecciones adicionales son necesarias porque RLS filtra filas, no columnas. Dar SELECT al contacto original revelaría un email oculto; darlo a media_assets revelaría created_by y rutas internas. Sus tablas base quedan owner-only.

Las cuatro vistas tienen security_invoker=true y security_barrier=true:

- public_contact_settings y public_media_assets llaman a las proyecciones fijas de lectura.
- admin_analytics_daily_dimensions y admin_analytics_daily_sessions consultan las tablas private con RLS del invocador.

La única RPC de aplicación expuesta es get_public_snapshot(). Los intentos de llamar is_portfolio_admin desde /rest/v1/rpc o de seleccionar el perfil API private fallan también con JWT owner. La plantilla local conserva el stub invoker graphql_public.graphql; pg_graphql no está habilitada y la llamada comprobada devuelve ese error, sin datos. No se añadió ninguna API GraphQL.

El inventario también enumera cuatro definers proporcionados por Supabase y no modificados: pgbouncer.get_auth, supabase_functions.http_request, vault.create_secret y vault.update_secret. No pertenecen a la API public de la aplicación.

El snapshot sigue usando DTO v1 de F5. Filtra padres e hijos, estados, fechas, tecnología/categoría/experiencia visible, media privada y contacto oculto. Usa ahora las proyecciones seguras para contacto y media. La salida se comprobó equivalente entre anon, usuario normal, owner inactivo y owner activo, excluyendo generated_at de la comparación temporal. Los datos privados del owner nunca se mezclan en esta RPC pública.

Los caches URL de proyectos/posts/settings se vacían cuando el asset deja de ser público. cv_url también respeta visibilidad y cv_enabled. Estos triggers evitan que una lectura directa de un registro público revele la antigua URL privada; las FK siguen protegiendo integridad, no son credenciales.

## Storage: seguridad preparada, sin F8

La migración instala cinco policies sobre storage.objects y verifica que RLS ya esté habilitado. Supabase es dueño de esa tabla; no se cambia su propietario ni se intenta alterar su RLS administrada.

Las únicas rutas aprobadas son:

| Bucket previsto  | Prefijos                           | Extensiones                |
| ---------------- | ---------------------------------- | -------------------------- |
| portfolio-public | projects/, technologies/, profile/ | jpg, jpeg, png, webp, avif |
| blog             | posts/                             | jpg, jpeg, png, webp, avif |
| documents        | cv/                                | pdf                        |
| private          | temporary/                         | imágenes anteriores o pdf  |

INSERT y UPDATE WITH CHECK exigen owner activo, owner_id igual a auth.uid(), bucket permitido y ruta válida. UPDATE/DELETE USING verifica también la fila previa. Se deniegan traversal, otros buckets, SVG/HTML, cambios de propietario y operaciones sobre objetos de otra identidad.

Supabase conserva grants administrados amplios sobre storage.objects, otorgados por supabase_storage_admin, incluidos privilegios que la Data API no ofrece como operación. No se presentan como revocados por una migración postgres: el catálogo registra ambos grantors. Las policies son la frontera de su API y ningún cliente recibe credenciales SQL ni una RPC que ejecute SQL arbitrario. Esto debe contrastarse con el catálogo remoto antes del despliegue.

No existen buckets de aplicación persistentes todavía. Las pruebas crean esos cuatro nombres dentro de una transacción y hacen ROLLBACK. Para probar DELETE SQL se usa solo en fixtures la bandera transaccional storage.allow_delete_query, que emula el servicio Storage; F8 debe usar la Storage API para operaciones reales.

F8 deberá crear los buckets, definir MIME/tamaño (10 MiB según plan), validar los bytes reales y gestionar la publicación. Los bytes de un bucket público son públicos aunque se restrinja SELECT de metadatos; los borradores deben permanecer en private. Esta fase no implementa UI, biblioteca, uploads reales ni pipeline de imágenes.

## Auth, recovery y bootstrap

Ver [DEPLOYMENT.md](DEPLOYMENT.md) para configuración local, URLs exactas, bloqueo de signup, bootstrap administrativo y controles previos al remoto. F6 solo prepara el contrato de recovery; la página física y la UI son posteriores. No se declara operativo el callback mientras no exista esa página estática.

## Evidencia adversarial

- SQL: 194 pruebas de integridad F5 adaptadas al acceso F6, 333 de RLS y 41 de Storage.
- Auth/REST reales: login de tres identidades, signup bloqueado, metadata manipulada en Auth, CRUD denegado/permitido, UUID/FK conocidos, elevación por perfil, vistas, RPC privada, snapshot equivalente, JWT alterado y expirado, recovery local y revocación del owner con JWT aún válido.
- Las identidades/passwords se generan solo en memoria para la instancia loopback F6 y se eliminan en finally. No se usan datos productivos.
- Triggers, grants y RLS se prueban sin UI; los seis tests de helpers frontend solo verifican su contrato de UX/recovery.

# F10 — Privacidad y agregados

Analytics no utiliza cookies, localStorage, PII del formulario, IP completa persistida ni fingerprinting. UUID por sesión/pestaña con rotación UTC adicional; en DB solo HMAC diario. DNT/GPC deshabilitan la instrumentación. Tests y previews no generan tráfico productivo. [Datos, retención, límites y restricciones](ANALYTICS.md).

RLS y policies F6 permanecen. get_analytics_report es invoker y exige owner activo además de grants/RLS. Mantenimiento invoker reservado a service_role. El único definer nuevo, private.update_analytics_popularity(), no recibe argumentos y solo actualiza el ranking calculado; evita conceder permisos editoriales amplios para ejecutar los triggers de media existentes. Owner postgres, search_path vacío y EXECUTE solo service_role; probado contra anon/authenticated/owner. SECURITY_AUDIT.json recoge el catálogo local de las 35 tablas RLS y cuatro definer propios.
