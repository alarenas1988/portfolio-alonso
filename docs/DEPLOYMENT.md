# Entorno y despliegue — contrato F6

## Primer despliegue real — 2026-09-06

Baseline 019 aplicado a portfolio-alonso, sa-east-1, PostgreSQL 17.6; CLI 2.116.0. Rama `chore/supabase-initial-deploy`, base main `d3b5d0f671aa783c09d59760a68b466aded5662f`. Historial remoto, esquema, RLS, buckets, snapshot y reconstrucción local posterior verificados. [Informe vigente](checkpoints/INITIAL_DEPLOY.md).

Seed: 21 filas base autorizadas. Signup deshabilitado; Site URL GitHub Pages y cuatro redirects exactos de admin/recovery en producción y localhost configurados. El usuario creó su cuenta Auth; bootstrap administrativo completado con un único owner activo, sin identidad ni credenciales versionadas. Pasaron 139 comprobaciones remotas Auth/RLS/snapshot/Storage y se eliminaron todos los fixtures. No recrear baseline ni aplicar las fuentes archivadas.

El bootstrap puntual está en `scripts/bootstrap-remote-owner.sql`: exige una única cuenta confirmada y ningún perfil; no debe repetirse. `scripts/check-remote-owner.mjs --initial-deploy-checkpoint` documenta el smoke test operacional, usa sesiones reales y guarda evidencia saneada. Requiere el entorno inicial sin contenido y no es un comando de mantenimiento general. La sesión temporal del owner se cerró sin cambiar su contraseña ni cerrar sus otras sesiones.

Los apartados siguientes son historial. Las prohibiciones previas de despliegue quedaron sustituidas únicamente por la autorización explícita de este checkpoint. El respaldo nuevo se restauró realmente en local y permanece fuera de Git; el proyecto Free no dispone aquí de restauración gestionada.

## Instalación inicial preparada para revisión

El directorio activo contiene ahora únicamente `20260906001900_initial_portfolio.sql`, generada a partir del historial archivado sin la dependencia Storage no-PK. El dry-run remoto lista solo esa migración; no aplicó SQL, seed, roles ni Vault. La puerta de aplicación sigue requiriendo aprobación del usuario y una nueva comprobación de que el remoto no cambió. [Informe vigente](checkpoints/INITIAL_BASELINE.md).

No ejecutar la baseline sobre bases F8 existentes: usar 018 archivada, comparar equivalencia y reconciliar el historial según el procedimiento probado. Tampoco usar el diff inverso del checkpoint anterior como script de instalación. El SQL forward autorizado para revisión es la baseline versionada, contrastada con el catálogo remoto y reproducida sobre su respaldo restaurado.

El ensayo de recuperación usa el respaldo fuera de Git y conserva Automatic RLS; documenta el GRANT administrado ya existente y la normalización local de defaults de secuencias. El entorno aislado actual es `portfolio-alonso-baseline-local`: API 58421, DB 58422, shadow 58420, Studio 58423, correo 58424, analytics 58427, inspector 8483. Los párrafos de checkpoints/fases siguientes se conservan como historial, no instrucciones vigentes para este stack.

## Checkpoint remoto del 2026-09-06

**Estado posterior al login:** CLI 2.116.0 autenticada, proyecto enlazado, auditoría de lectura actualizada y respaldo lógico fuera de Git. La simulación no aplicó migraciones. El orden 014 → 018 sigue creando temporalmente la FK rechazada; se detiene para acordar la instalación inicial, sin reescribir historial. [Informe CLI](checkpoints/CLI_REMOTE_PREFLIGHT.md). La recuperación aún requiere ensayo y el diff disponible tiene dirección inversa al despliegue. Los párrafos siguientes conservan el contexto previo a este acceso CLI.

F8 ya está integrada en main. El [informe de inspección remota](checkpoints/SUPABASE_REMOTE_READINESS.md) registra PostgreSQL 17.6, Automatic RLS activo y backend todavía sin desplegar. La instrucción vigente prohíbe db push. La FK compuesta se corrigió localmente mediante la migración 018 hacia la PK UUID de Storage; siguen pendientes el volcado restaurable, el diff y la revisión de la puerta remota. La CLI 2.116.0 requiere login administrativo; no usar las claves públicas como sustituto. El futuro push debe incluir `--skip-vault`; no incluye seed por defecto. No se aplicaron cambios remotos ni se creó PR/merge del checkpoint.

La configuración Auth observada todavía permite signup, tiene Site URL `http://localhost:3000` y carece de redirects. El plan Free no incluye backups restaurables. La [decisión Storage](checkpoints/STORAGE_OBJECT_IDENTITY.md) registra la corrección local probada. El informe conserva el estado remoto previo, Automatic RLS, recuperación y pasos pendientes. No modificar signup, URLs ni usuarios durante esta corrección.

F8 incorpora un stack aislado adicional, buckets locales y el pipeline de multimedia. Para puertos, reconstrucción y comandos vigentes de esa fase, consultar [MEDIA.md](MEDIA.md). Los puertos y la evidencia F6 siguientes se conservan como historial; no ejecutar pruebas F8 contra ese entorno anterior.

F6 está validada solo en Supabase local. **No ejecutar db push ni modificar el proyecto remoto sin una aprobación posterior explícita.** Automatic RLS remoto permanece habilitado y se mantendrá junto a las migraciones RLS/grants/policies.

## Aislamiento local

La rama `feat/f6-auth-rls` parte de `origin/main` en `4056e6b`, que contiene F1, F2 y F5. Su worktree es `.worktrees/f6-auth-rls`.

- Proyecto CLI: portfolio-alonso-f6-local.
- PostgreSQL: 17.6, imagen 17.6.1.165, puerto 55422; shadow 55420.
- API: http://127.0.0.1:55421.
- Studio: http://127.0.0.1:55423.
- Mailpit: http://127.0.0.1:55424.
- CLI: 2.116.0 fijada; Node 24.20.0; npm 11.19.0.
- La instancia local F5 en los puertos 5432x se conserva separada.
- .env.local existe y está ignorado; puede conservar las dos variables públicas remotas. Los tests de Auth NO lo cargan: obtienen únicamente las claves de la CLI local y rechazan URLs/puertos diferentes de los loopback fijados.
- No se versionan passwords, JWT, claves privadas ni identidades owner reales.

```powershell
$env:Path = 'C:/laragon/www/portfolio/.tools/node-v24.20.0-win-x64;' + $env:Path
Set-Location C:/laragon/www/portfolio/.worktrees/f6-auth-rls
npm ci
npm ls --depth=0
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
npm run db:types:check
npm run db:snapshot:check
npm run test:auth:local
npm run db:audit
```

db:reset reconstruye únicamente el proyecto local de F6 y aplica todas las migraciones/seed. Los wrappers no aceptan parámetros remotos. Los tests SQL usan ROLLBACK; test:auth:local exige el seed limpio, crea usuarios con passwords aleatorias en memoria y elimina exactamente sus fixtures al finalizar. El script no imprime credenciales. Las solicitudes de recovery llegan a Mailpit local, sin enviar correos externos.

Si cambia config.toml de Auth, detener el proyecto local con `npx --no-install supabase stop` y volver a iniciar con db:start antes de probar. stop conserva el backup local; no usar opciones para descartar datos ajenos a las pruebas.

## Auth y registro

- auth.enabled=true.
- auth.enable_signup=false: bloqueo global de registro público.
- auth.email.enable_signup=true: en esta versión de CLI mantiene el proveedor email/password disponible; desactivarlo produjo email_provider_disabled al intentar login. El bloqueo global se comprueba con una petición signup real denegada.
- Sign-in anónimo deshabilitado; password mínimo 12.
- PKCE en el cliente browser; persistencia de sesión y refresh gestionados por Supabase JS. No interpretar publishable keys como JWT.
- Un login correcto no concede permisos: la consulta RLS de admin_profiles y private.is_portfolio_admin definen al owner.

En remoto, después de autorización de despliegue: mantener el proveedor email/password habilitado y desactivar **Allow new users to sign up** en Auth; mantener anonymous sign-ins deshabilitado. Verificar el rechazo real del endpoint signup. Configurar redirects exactos y mecanismos de recuperación antes de habilitar uso administrativo. Estos cambios remotos todavía no se han realizado.

Referencias: [configuración Auth](https://supabase.com/docs/guides/auth/general-configuration), [passwords y recovery](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage](https://supabase.com/docs/guides/storage/security/access-control).

## URLs de Auth y contrato de recovery

La base Astro inicial es /portfolio-alonso/. URLs previstas:

| Entorno            | Site URL                                         | Callback físico de recovery                                           |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------- |
| Desarrollo         | http://localhost:4321/portfolio-alonso/          | http://localhost:4321/portfolio-alonso/admin/reset-password/          |
| Producción inicial | https://alarenas1988.github.io/portfolio-alonso/ | https://alarenas1988.github.io/portfolio-alonso/admin/reset-password/ |

config.toml solo permite el callback exacto local; no agrega redirects productivos al entorno de pruebas. Si cambia el base de Astro, derivar de nuevo las rutas con getAuthRedirects(), actualizar la allowlist y volver a probar; nunca aceptar returnTo arbitrario ni usar comodines de producción.

En F7 se deberá crear `src/pages/admin/reset-password.astro`, generando una página estática real en esa ruta, junto a la UI de login. No se necesita endpoint server-side en GitHub Pages. Antes de esa fase la URL es un contrato, no una pantalla de recovery funcional.

Flujo previsto: solicitar reset con resetPasswordForEmail y redirect fijo; validar el callback esperado; intercambiar el código PKCE mediante Supabase JS (con el verifier/flowId gestionado por SDK cuando corresponda); verificar al usuario con Auth; cambiar password usando updateUser; retirar el código de la URL y no registrarlo en analytics/logs. readRecoveryCode() valida origen/ruta/código y rechaza callbacks implícitos con tokens en hash. F6 no crea el formulario ni un consumidor automático del callback.

Recovery no crea admin_profiles ni modifica role/active. Recuperar una cuenta normal no la convierte en owner. Una sesión local caducada o manipulada debe fallar contra Auth/REST; nunca usar localStorage como autorización.

## Bootstrap del owner: operación administrativa futura

No existe formulario público para crear owner. El seed productivo no incluye Auth ni perfiles.

Después de la aprobación del despliegue y verificación de políticas:

1. Un operador autorizado crea o invita al usuario mediante el canal administrativo Supabase Auth; la contraseña se entrega/establece mediante un canal seguro, fuera de Git, SQL y documentación.
2. Verifica la identidad del usuario y obtiene su UUID real desde Auth. No autoriza por coincidencia de email ni por metadata proporcionada por el usuario.
3. Con una conexión administrativa y variables psql proporcionadas fuera del repositorio, ejecuta una transacción equivalente a:

```sql
begin;
insert into public.admin_profiles (id, display_name, role, active)
values (:'owner_uuid'::uuid, 'Alonso Larenas', 'owner', true);
-- Verificar que se creó exactamente la identidad previamente comprobada.
commit;
```

La FK exige un auth.users existente; el índice único impide un segundo owner activo. No usar ON CONFLICT para activar silenciosamente otro perfil ni conceder INSERT sobre admin_profiles al navegador. Cualquier sustitución/reactivación es otra operación administrativa explícita.

4. Inicia sesión como owner y comprueba CRUD; repite pruebas de anon/noowner/inactivo en un entorno de verificación apropiado.
5. Comprueba recuperación y URLs exactas. El futuro frontend solo recibe URL y publishable key.

En las pruebas locales de F6 se usa un procedimiento equivalente con identidades efímeras, alta por la API Auth administrativa y SQL local para los perfiles. Ningún owner remoto se ha creado.

## Antes de evaluar el primer despliegue remoto

Esta lista describe trabajo futuro, no autorización para ejecutarlo:

- Confirmar PostgreSQL remoto compatible y el alcance de todas las migraciones.
- Revisar SECURITY_AUDIT.json contra grants/policies ya presentes: las policies permisivas se combinan con OR; una policy heredada amplia no debe conservarse sin análisis.
- Mantener Automatic RLS y declaraciones explícitas de aplicación.
- Verificar los privileges administrados de Storage. F6 solo instala seguridad; F8 creará portfolio-public, blog, documents y private y probará bytes, MIME/tamaño y operaciones de Storage API.
- Preparar variables/secretos únicamente en sus entornos privados; nunca exponer service_role ni secret keys en Astro/dist.
- Obtener autorización explícita antes de db push, cambios de Auth remoto o alta de owner.
- No se han creado Edge Functions, secretos, buckets remotos ni workflows de despliegue.
