# F9 — Edge Functions

Fecha: 2026-09-06. Base `origin/main`: `302a00211db100237630d16bd323f07e8475bc92` (F4 integrada). Rama `feat/f9-edge-functions`, worktree `.worktrees/f9-edge-functions`. No se reutilizó una rama anterior. El skill solicitado `superpowers:subagent-driven-development` no estaba disponible; ejecución secuencial.

## Contratos y frontera de confianza

| Función          | Caller                                 | Contrato                                   | Estado del despliegue                                  |
| ---------------- | -------------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `contact-submit` | Publicable + origen permitido          | Persistencia e idempotencia de contacto    | Puerta remota en verificación                          |
| `publish-site`   | JWT verificado + owner activo en DB    | Solicitud de publicación; adaptador GitHub | Local; dispatch productivo pendiente F11               |
| `build-status`   | HMAC dedicado; sin Origin de navegador | Callback exacto del futuro workflow        | Local; pendiente F11                                   |
| `track-event`    | Publicable + origen permitido          | Receptor acotado; sin instrumentación      | Local; activación y retención analítica pendientes F10 |

Las cuatro funciones usan `@supabase/server` 1.5.3 mediante `createSupabaseContext`: modos `publishable`, `user` y `none` después de verificar HMAC. La publicable viaja en `apikey`; un JWT de usuario viaja en Authorization. Ninguna clave pública/secret se interpreta como JWT. `publish-site` verifica claims con el SDK, confirma la cuenta mediante Auth y consulta el perfil bajo el JWT/RLS. Exige el mismo UUID, `active=true`, `role=owner`. La RPC vuelve a comprobar ese perfil dentro de la transacción. Email y user_metadata no autorizan.

`verify_jwt=false` en las cuatro entradas evita depender del verificador legado del gateway y permite claves publicables/asimétricas. **No desactiva la autenticación de aplicación**: el SDK valida el JWT de `publish-site`; `build-status` valida su MAC; los endpoints públicos exigen publicable y validan íntegramente el request. Esto se probó con tokens reales inválidos, vencidos y de los cuatro actores. [Patrón oficial de autenticación Edge](https://supabase.com/docs/guides/functions/auth).

El cliente privilegiado queda dentro de Edge. El código solo puede invocar cinco RPC de nombre fijo y actualizar el estado de notificación. El navegador no elige tabla, SQL ni actor. Todas las nuevas RPC son **SECURITY INVOKER**, `search_path=''`, EXECUTE exclusivo de service_role y comprobación explícita `current_user`. No se añade ninguna función SECURITY DEFINER ni policy. Las tres funciones definer de F6 se conservan.

## HTTP, CORS y errores

POST JSON UTF-8; OPTIONS se resuelve sin Auth/DB/rate limit. Límites reales del stream, además de Content-Length: contacto 16 KiB, tracking 4 KiB, publicación/callback 8 KiB. Body con plazo de 5 s; se rechazan compresión, JSON inválido, campos desconocidos, controles y métodos incorrectos. Un request id UUID válido puede propagarse; en otro caso se genera uno.

Orígenes exactos: producción `https://alarenas1988.github.io`; desarrollo `http://localhost:4321` y `http://127.0.0.1:4321`. Las pruebas locales añaden exclusivamente 4322/4339 loopback. El origen nunca incluye `/portfolio-alonso/`; las URLs de página sí. Sin wildcard ni cookies. Contacto, publicación y tracking rechazan Origin ausente/desconocido. El callback rechaza Origin presente y requiere firma. CORS no sustituye Auth, validación ni rate limit: un cliente no navegador puede fabricar Origin.

Preflight permite POST y los headers `apikey`, `authorization`, `content-type`, `idempotency-key`, `x-client-info`, `x-request-id`, `x-form-started-at`. Se exponen únicamente X-Request-Id y Retry-After. Respuestas no-store, nosniff, Vary Origin. Estados: accepted; invalid_request (400), unauthorized (401), forbidden (403), too_large (413), conflict (409), rate_limited (429), configuración temporal (503) y fallo temporal sin datos internos.

Logs propios: request id, función, status, duración y categoría de error. Nunca body, email, IP, UA completo, headers, tokens, SQL ni respuestas de proveedores. Los timeouts externos son 8 s para Supabase/GitHub y 5 s para notificación. No hay reintentos automáticos de dispatch/email.

### Gateway local

Supabase CLI 2.116.0 instala CORS de Kong con wildcard e intercepta OPTIONS antes de Edge. Las comprobaciones HTTP detectaron 200/wildcard aunque el handler aplicaba correctamente su allowlist. `configure-edge-local-cors.mjs` ajusta exclusivamente el plugin CORS del servicio local `functions-v1` mediante la API declarativa DB-less `/config`, con `preflight_continue=true`. Conserva Auth/REST/Storage y mantiene el documento completo, que contiene claves, solo en memoria. Requiere el stack loopback validado. No altera RLS ni configuración remota.

`edge:serve` aplica este ajuste cuando arranca el runtime. Reiniciar/recrear el stack puede regenerar el gateway: volver a ejecutar el wrapper. La configuración es reversible al reconstruir el stack; no se editan archivos administrados de PostgreSQL. Referencias: [CORS de Kong](https://developer.konghq.com/plugins/cors/), [configuración declarativa DB-less](https://developer.konghq.com/gateway/db-less-mode/).

## Contacto y formulario

Body permitido: name (2–120), email (máximo 254), subject (3–200), message (20–5000), honeypot (hasta 500). Trim/NFC, email normalizado; mensaje tratado como texto, con saltos de línea legítimos. HTML/script escrito en el mensaje se conserva como texto; el futuro CMS debe escaparlo. Honeypot relleno recibe aceptación genérica sin persistencia/notificación/conversión. Header X-Form-Started-At: mínimo 3 segundos y máximo 24 horas, señal adicional antispam que no sustituye límites. Idempotency-Key: UUID.

`edge_record_contact` toma advisory lock por submission_id. Dentro de 24 h, mismo UUID y contenido normalizado devuelve la recepción existente; otro contenido o una solicitud caducada produce conflicto. Los UUID siguen siendo únicos permanentemente: una solicitud antigua no vuelve a insertarse. Tras error de DB la transacción revierte y puede reintentarse. Un retry después de respuesta perdida no genera otra fila ni otra notificación.

La RPC comprueba `contact_settings.form_enabled`. Inserta status/new y notification_status interno; el browser no controla estos campos. En la misma transacción registra una conversión `contact_submit` con UUID del envío y HMAC efímero independiente del contenido. No envía nombre/email/mensaje a analytics. No se concede INSERT público a contact_messages.

Notificación opcional: interfaz inyectable, únicamente después del commit y para una fila nueva. Proveedor fallido no pierde el mensaje; queda notification_status=failed. Sin proveedor, disabled. No se contrató ni configuró proveedor; no se enviaron correos de prueba reales. Un fallo al registrar el resultado deja pending para recuperación administrativa futura, no reintentos ciegos.

El formulario F4 conserva su diseño y utiliza fetch con URL/publicable públicas. Estados idle, validating, submitting, success, error y rate-limited; bloqueo de doble envío, aria-busy/status/atomic, foco y errores por campo. Limpia únicamente tras accepted. Fallo de red, timeout de 15 s y 429 conservan el texto en memoria. Un retry sin editar reutiliza UUID; editar crea otra solicitud. No localStorage ni PII persistida en navegador. Sin configuración devuelve unavailable; sin JS botón inactivo y aviso de canales alternativos, solo los que estén configurados.

## Límites y privacidad

Se reutiliza `private.rate_limit_buckets`; no hay tabla duplicada ni Redis. Upsert atómico por hash/acción/ventana; contador saturado evita overflow. Contacto: 5/15 min por señal de origen + techo global configurable (100/h inicial, máximo configurado 1000). Tracking: 60/min por sesión, 120/min por origen y techo global 10000/h. Publicación: una activa y cooldown 30 s.

Los HMAC incluyen namespace y día UTC. Hashes de abuso separados de sesión analítica; TTL de counters máximo 1 h, limpieza oportunista y cron cada 15 minutos incluso sin tráfico. La caducidad lógica se respeta aunque el scheduler se retrase. La señal de red es el último valor de X-Forwarded-For normalizado; es **no confiable**, no identidad. Señales inválidas comparten un bucket conservador. El techo global limita abuso incluso si la señal se falsifica/rota. No IP completa ni UA persistidos; solo dispositivo y familia de navegador gruesos.

La retención de eventos/agregados de 90/400 días pertenece a F10. Por eso `track-event` permanece local y no se activa un receptor productivo de eventos antes de esa fase. No se añadió dashboard, agregación, popularidad ni tracking global. Los counters caducados se eliminan mediante el job `portfolio-rate-limit-retention` de pg_cron 1.6.4.

## Publicación y callback

`publish-site` recibe request_id, trigger_type (`manual`, `content_change`, `retry`), entidad/FK opcional y retry_of cuando corresponde. No recibe actor ni rol. La transacción serializa solicitudes, reutiliza el request existente o la publicación activa y registra auditoría mínima. Las entidades deben existir; retry_of debe ser una publicación fallida. El caller conserva el build_id devuelto como identidad efectiva al reutilizar una publicación activa.

GitHub adapter: repository_dispatch, event_type `portfolio_publish`, solo build_id en client_payload; host y repositorio configurados del servidor, timeout/redirect denial, sin retry. Un 204 confirma dispatch, no deployment. Falta de token/configuración devuelve 503 **antes de crear queued**. Fallo de dispatch marca failed sin pisar un callback que ya haya asociado run. Un timeout externo puede ser ambiguo; F11 deberá reconciliar GitHub antes de reintentar. Ningún PAT ni workflow se creó.

`build-status`: `X-Build-Timestamp` (epoch segundos), `X-Build-Signature: v1=<hex>` = HMAC-SHA256(secret, timestamp + '.' + bytes JSON exactos). Ventana ±300 s; WebCrypto verifica el MAC. Sin tolerar cambios de espacios/payload. El callback contiene build_id, status, run_id/run_attempt, commit_sha, started_at, completed_at y deployment_id/failure_reason según estado. deployment_url opcional debe coincidir exactamente con Site URL; errores son categorías acotadas, no logs arbitrarios.

La RPC bloquea la fila, exige run/attempt/SHA/inicio consistentes, valida tiempos y los CHECK existentes. queued puede avanzar a building o terminal (callback intermedio perdido); building a success/failed. Terminal no retrocede ni cambia de ejecución. Callback exacto repetido no muta nuevamente; build desconocido no se crea. Solo queued/building/success/failed se almacenan.

## Tracking

Allowlist: page_view, project_view, post_view, whatsapp_click, email_click, email_copy, github_click, linkedin_click, demo_click, cv_download, article_share. `contact_submit` se reserva exclusivamente a la transacción de contacto y se rechaza desde este receptor público.

event_id y session_id UUID; pathname sin query/hash y dentro del base. IDs de proyecto/artículo permitidos solo para eventos correspondientes; la DB comprueba publicación, fecha y slug. Rutas estáticas allowlisted; no se almacena un slug arbitrario con información personal. Sin blob properties; referrer solo dominio conocido u other. No cuerpo/contacto/credenciales. Eventos duplicados no generan otra fila. UUID de sesión nunca se persiste, solo HMAC diario. El receptor no instala cookies, sesiones cliente ni instrumentación F10.

## Migraciones y tipos

- `20260906002000_edge_intake.sql`: helper de counters, contacto/conversión y evento atómicos, índice de expiración y job de limpieza.
- `20260906002100_edge_build_contracts.sql`: solicitud/callback/fallo de dispatch.
- 019 permanece byte por byte intacta; no modificación estructural de auth/storage, nuevas tablas de aplicación ni grants de browser. SELECT mínimos adicionales solo para service_role. Las 35 tablas conservan RLS y las 138 policies anteriores.
- `src/types/database.ts` regenerado reproduciblemente incluye las cinco firmas RPC. DTO públicos de F3/F4 no cambian.

## Desarrollo y validación

Node 24.20.0, npm 11.19.0, CLI 2.116.0. Deno 2.9.6 fijado como dependencia de desarrollo y lock de imports; `@supabase/server` 1.5.3, supabase-js 2.115.0. El runtime local probado es Edge Runtime 1.74.3 / Deno 2.1.4. Las dependencias nuevas no entran en bundles del navegador.

```powershell
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:reset
npm.cmd run edge:serve
# En otra terminal del mismo worktree:
npm.cmd run edge:check
npm.cmd run edge:lint
npm.cmd run test:edge
npm.cmd run db:lint
npm.cmd run db:test
npm.cmd run test:edge:http
npm.cmd run test:contact:local
npm.cmd run test:e2e
```

El wrapper crea `.env.edge.local` ignorado con secretos aleatorios **solo locales** y rechaza stacks que no sean loopback 58421/58422. No imprime valores. Detener `edge:serve` antes de npm ci en Windows: un proceso CLI abierto bloquea supabase.exe. La instalación permite explícitamente el script de Deno que materializa el binario fijado; no se habilitan scripts arbitrarios.

Secrets propios: CONTACT_RATE_LIMIT_HMAC_SECRET, ANALYTICS_HMAC_SECRET; para tracking local ANALYTICS_RATE_LIMIT_HMAC_SECRET; callback local BUILD_CALLBACK_HMAC_SECRET. GITHUB_FINE_GRAINED_TOKEN futuro en F11 y proveedor email futuro opcional. Supabase provee el contexto administrativo en Edge; nunca copiarlo a PUBLIC_* ni al frontend. `.env.edge.example` documenta solo nombres/valores públicos. El escáner de dist contempla los cuatro secretos HMAC.

Pruebas locales: 88 Edge unitarias; 46 SQL F9 dentro de 659 SQL totales; 79 comprobaciones HTTP Runtime/Auth/DB; 107 Auth/RLS y 66 Storage/media previas conservadas. Navegador local verifica commit real, respuesta perdida, retry, límite, no-JS y limpieza. Fixtures Auth/passwords solo locales; filas y bytes de prueba eliminados. Tests npm/CI/E2E usan fixtures y no requieren el remoto. Las pruebas SQL usan rollback.

## Operación remota y límites

Inspección F9: proyecto portfolio-alonso, sa-east-1, PostgreSQL 17.6, CLI autenticada/enlazada, historia exclusivamente 019, sin funciones/secrets propios ni colisiones F9. Automatic RLS activo; 32 public + 3 private con RLS; buckets/owner conservados. pg_cron 1.6.4 disponible. Dry-run: únicamente 020 y 021, sin seed/roles/Vault.

Respaldo de roles/schema/datos fuera de Git en `%LOCALAPPDATA%/portfolio-alonso/backups/20260906-f9-edge`, ACL exclusiva del usuario/SYSTEM/Administrators. Se excluyen los dos catálogos vector administrados igual que en el checkpoint aprobado; no hay bytes Storage. Se conservan inventario, configuración y hashes. El nuevo dump no se presenta como una restauración recién ensayada: el procedimiento probado es el del checkpoint inicial. Free no ofrece aquí restauración gestionada disponible. Ante fallo, conservar error e historial, mantener formulario apagado y revisar; no DROP/repair/fixes improvisados.

**Incidencia de empaquetado:** 020/021 se aplicaron correctamente el 2026-09-06 a las 19:35 UTC, sin seed/roles/Vault. El primer deploy por API falló con HTTP 400: no resolvía `@supabase/server` porque el deno.json global de desarrollo no se incluyó en los assets del deploy. Se reprodujo el mismo error sin cambiar DB ni secretos y se conservó el diagnóstico. El formulario permaneció desactivado y no había función activa.

Corrección: deno.json y lock propios en cada función, con versiones idénticas a las probadas. `edge:check` verifica esos mapas y `edge:bundle:local` empaqueta las cuatro funciones con el runtime real. Se añadió una regresión sobre la presencia de configuración/lock de despliegue. [Configuración de dependencias recomendada por Supabase](https://supabase.com/docs/guides/functions/dependencies). La reanudación `resume-contact-edge.mjs --deploy-function-only-f9` comprueba historial/configuración y no repite push ni genera secretos. No se modificó lógica de autorización, RLS ni SQL para corregir el empaquetado.

**Estado actual:** validación de la corrección de empaquetado. El cierre de F9 registrará el resultado remoto efectivo.

Sin cambios Auth, owner, buckets, políticas ni contenido final. No se han iniciado F10/F7/F11/F12/F13/F14. No hay PR ni merge automático.
