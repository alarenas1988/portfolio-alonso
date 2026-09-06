# Cierre F9 — Supabase Edge Functions

Fecha: 2026-09-06. Base exacta `origin/main`: `302a00211db100237630d16bd323f07e8475bc92`, con F4 y los checkpoints previos integrados. Rama `feat/f9-edge-functions`; worktree `.worktrees/f9-edge-functions`. Ejecución secuencial porque el skill superpowers solicitado no estaba disponible. No se reutilizó ni integró nuevamente F4.

F9 implementada y verificada. Solo `contact-submit` está desplegada: versión 2 ACTIVE en `portfolio-alonso`, región `sa-east-1`, PostgreSQL 17.6, CLI 2.116.0 autenticada/enlazada. El formulario utiliza exclusivamente configuración pública; quedó habilitado tras el smoke completo. Publish-site/build-status/track-event permanecen locales. No se publicó GitHub Pages ni se creó PR/merge de esta rama.

## Alcance efectivo

- Cuatro handlers con configuración/lock independientes de despliegue; shared HTTP/CORS, límites, validación, SDK Auth, HMAC, privacidad, errores, logs, timeout y repositorio tipado.
- Contacto atómico con idempotencia, rate limit y conversión mínima sin PII; notificación desacoplada y desactivada sin proveedor. Formulario F4 conectado, accesible, recuperable y sin doble envío.
- Publicación autorizada por JWT + owner activo y comprobación transaccional. Adaptador repository_dispatch probado con mocks, sin token ni dispatch real.
- Callback HMAC sobre bytes exactos, ventana temporal, identidad de ejecución y transiciones/idempotencia en DB.
- Tracking con once eventos allowlisted; contact_submit reservado a persistencia de contacto. Receptor local, sin instrumentación F10.
- Migraciones 020/021 sobre tablas existentes. Baseline 019 intacto. No nuevas tablas de aplicación ni cambios de policies/browser grants. Cinco RPC y helper privados SECURITY INVOKER, ejecución exclusiva service_role; tres definer aprobados de F6 conservados.

[Contratos completos, límites, comandos y seguridad](../EDGE_FUNCTIONS.md).

## Operación remota

1. Inventario previo: solo 019, 32 tablas public + 3 private con RLS, owner existente, cuatro buckets aprobados, cero funciones propias, cero mensajes/eventos. Automatic RLS activo. [Preflight y dry-run](f9/remote-preflight.json).
2. Backup lógico roles/schema/datos fuera del repositorio, ACL restringida. [Manifest con hashes y limitaciones](f9/backup-manifest.json). No se incluyeron secretos ni datos Auth en evidencia Git. El dump nuevo no se restauró nuevamente; Free no ofrece aquí restauración gestionada disponible. Recuperación según el procedimiento ensayado del checkpoint inicial, en un entorno compatible.
3. SQL revisado sin DROP ni DDL estructural de auth/storage. Push único de 020/021 el 2026-09-06 19:35 UTC. Sin seed, roles ni Vault. [Resultado CLI](f9/push.json).
4. Dos secretos HMAC propios (contacto y conversión) y tres ajustes de origen/URL/límite. Supabase aprovisionó sus variables administradas de contexto. No se copiaron sus valores a código, documentación, frontend o logs. Ningún secreto GitHub/email/callback remoto.
5. Contact-submit v2 ACTIVE desde 19:56 UTC. [Despliegue](f9/deployed.json); el flag false en esa evidencia corresponde al momento anterior al smoke. El estado definitivo es true en la auditoría posterior.
6. Smoke: 27 comprobaciones aprobadas; build y navegador Astro locales apuntaron al remoto con publicable. Recepción, deduplicación, conflicto de payload, origen exacto, CORS malicioso, publicable inválida, honeypot, denegación RPC/INSERT/tablas privadas, falsificación de IP, límite 429 y snapshot. [Resultados](f9/remote-smoke.json).
7. Se eliminaron todos los mensajes/conversiones fixture. Estado posterior: cero mensajes, cero eventos y cero objetos Storage; un usuario Auth y un owner existentes. Dos counters HMAC vigentes permanecen hasta su expiración ordinaria; no se reseteó el límite productivo. Cron de limpieza cada 15 minutos, sin counters vencidos en la auditoría.
8. Historial final 019/020/021; dry-run vacío. Automatic RLS sigue activo. Coinciden catálogo de seguridad, grants, policies, vistas, 404 columnas, 256 constraints, 100 índices, 45 triggers y definiciones de 24 funciones propias. Se excluye únicamente el helper de Automatic RLS preexistente administrado por la plataforma. [Auditoría posterior y comparación](f9/post-deploy.json).
9. Tipos remotos equivalentes a `src/types/database.ts`: única normalización, anotación administrada PostgrestVersion 14.5 y comentarios del generador, conforme al checkpoint anterior. [Comparación](f9/types-comparison.json). DTO público inalterado.

No se modificaron signup, Site URL/Redirect URLs de Auth, owner, buckets, límites MIME ni policies. `form_enabled=true` es la activación editorial autorizada de contacto; no se insertó contenido productivo ficticio. La única configuración de plataforma nueva es la necesaria para Edge y la limpieza de counters definida mediante 020.

## Incidencias resueltas

- **Empaquetado API:** el deno.json global servía localmente pero no resolvía imports en deploy. Se conservó el error HTTP 400; no se improvisó SQL. Configuración/lock por función y verificación de bundle con Edge Runtime corrigieron el despliegue. Las RPC ya aplicadas no se repitieron.
- **Señal de origen:** el último XFF era un intermediario variable en hosted; el primer smoke detectó seis mensajes repartidos entre tres counters. Se deshabilitó formulario, se limpiaron fixtures y se corrigió a CF-Connecting-IP requerido en hosted. Local conserva su único Kong conocido. Ausencia/header inválido falla sin persistencia, sin fallback al XFF del caller. No se almacenaron IP completas.
- **Prueba de falsificación:** la plataforma rechazó CF-Connecting-IP suministrado por cliente con 403, antes del handler. Se separó esa prueba negativa del límite por origen; cambiar XFF no eludió el 429. No fue necesario reemplazar otra vez la función ni relajar controles.
- **CORS local:** configuración declarativa del plugin functions-v1 de Kong; conserva Auth/REST/Storage. El wrapper la reaplica en hot reload. No cambia el gateway remoto.
- **HTTP local:** un timeout aislado al rechazar oversized, con 413 registrado por el runtime. Repetición sin modificar código ni timeout: 79/79, fixtures eliminados. Los logs están ignorados en `.tools/f9/`; no se oculta la ejecución fallida.

## Validación y revisión

| Control                                         | Resultado                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Reconstrucción local antes y después del deploy | 019 → 020 → 021 + seed; sin estado manual                             |
| db lint                                         | Sin errores                                                           |
| SQL                                             | 659 aprobadas, 46 nuevas F9                                           |
| Auth/RLS real local                             | 107 comprobaciones aprobadas                                          |
| Storage/media real local                        | 66 comprobaciones aprobadas                                           |
| Edge unitarias                                  | 90 aprobadas                                                          |
| Edge HTTP real local                            | 79 aprobadas, fixtures eliminados                                     |
| Formulario local real                           | Receipt, offline, respuesta perdida, retry, 429, no-JS y cleanup      |
| npm test                                        | 146 aprobadas                                                         |
| E2E                                             | 179 aprobadas, 73 omisiones explícitas por breakpoint                 |
| Contacto remoto                                 | 27 comprobaciones aprobadas y cleanup                                 |
| Tipos y snapshot                                | Regeneración local, comparación remota y seed idempotente correctos   |
| Bundle Edge                                     | Cuatro funciones empaquetadas con configuración individual            |
| Build público remoto                            | Seis páginas estáticas, base correcta, formulario habilitado          |
| npm ci / ls / audit                             | Instalación reproducible; dependencias válidas; cero vulnerabilidades |
| Format / lint / typecheck                       | Aprobados; Astro/TS sin errores, warnings ni hints                    |
| Static / secrets                                | Seis HTML y 21 artefactos aprobados                                   |
| git diff --check                                | Sin errores                                                           |

Se inspeccionaron capturas reales del formulario 390/1440, error/rate limit local y éxito remoto 390. Conserva diseño F4, labels, aria-live/atomic, foco, teclado, reduced motion y no-JS. Sin JS no simula envío; actualmente Email/WhatsApp aún no están configurados, por lo que no se inventan canales alternativos. Capturas locales ignoradas, sin sesiones ni credenciales.

[Puerta local previa al deploy](f9/local-gate.json) conserva el resultado de ese momento (145 npm / 88 Edge antes de las dos correcciones adicionales). Los resultados finales de la tabla prevalecen. [Comprobaciones HTTP finales](f9/edge-http-results.json) y [formulario local](f9/contact-local-results.json).

## Archivos, dependencias y commits

Inventario completo: [archivos de F9](f9/files.json). Incluye funciones/shared/config/locks, migraciones/tests/tipos, adaptador y UI de contacto, tooling local/remoto, pruebas unitarias/E2E, documentación y evidencia. Las dependencias nuevas de desarrollo son `@supabase/server` 1.5.3 y Deno 2.9.6; no se añadió framework UI ni proveedor externo.

Commits de implementación y correcciones:

- `17fbc52` — transactional edge database contracts.
- `6af54bd` — secure edge intake and publishing contracts.
- `6c4d4d6` — edge authorization and real local HTTP.
- `bef07c0` — contact form with recoverable delivery.
- `0f48b40` — controlled contact deployment documentation/tooling.
- `0e0eaab` — isolated deployment dependency maps.
- `9dab8f1` — smoke test formatting.
- `22a73b5` — managed client header for abuse limits.
- `5911575` — managed runtime settings recognized.
- `c5f6a54` — separación de falsificación de cabecera y límite en pruebas remotas.
- `docs: record verified phase nine deployment` — cierre, catálogo y evidencia.

El último commit documental no incluye su propio SHA: consultar `git log origin/main..HEAD --oneline`. No commits reescritos, force-push, PR ni merge.

## Pendientes deliberados

Proveedor email no configurado; el mensaje queda persistido y notification_status=disabled. Falta CMS para gestión editorial, F10 para retención/explotación analítica e instrumentación, y F11 para workflows/dispatch/callback reales. El HMAC diario y techo global reducen abuso, no prueban humanidad; redes compartidas comparten límite y abuso distribuido puede consumir el cupo global. Las ventanas de rate limit son fijas, no móviles.

Un timeout de dispatch futuro puede requerir reconciliación con GitHub antes de reintentar. Cambio de dominio/ingreso requiere revisar origen y contrato de cabecera antes de habilitar tráfico. Rotación de secretos debe coordinarse con las ventanas de idempotencia/callback. Mantener vigilancia operativa cuando exista tráfico real; no se creó monitoreo ni dashboard en esta fase.

F10/F7/F11/F12/F13/F14 no fueron iniciadas. F9 termina aquí para revisión del usuario.
