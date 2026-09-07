# F11 — Publicación C2: inspección inicial

Estado: **en pausa por credencial requerida; F11 no está completada ni desplegada**. Fecha local 2026-09-06, America/Santiago; inspección remota entre 2026-09-07 00:17 y 00:19 UTC.

## Base y aislamiento

- `origin/main`: `8bb9815d869064621254d4ccbfe087b1e4962b4d`, merge de F10B mediante PR #14.
- Main se comprobó limpio y se sincronizó mediante fetch/fast-forward. Cero commits locales pendientes antes de crear la rama.
- Rama `feat/f11-c2-deployment`; worktree `C:/laragon/www/portfolio/.worktrees/f11-c2-deployment`, creado desde origin/main.
- No se reutilizan los worktrees de F7/F10B. Las referencias de sus fases se leen desde el nuevo checkout.

## Auditoría sin cambios remotos

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

## Acción mínima del usuario

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
