# Arquitectura del portfolio

## Modelo C2

Supabase/PostgreSQL es la única fuente de verdad. Astro consulta únicamente contenido público durante el build, genera HTML/CSS/JavaScript estático y GitHub Actions publica el artefacto en GitHub Pages. Si una compilación falla, Pages conserva la última publicación correcta.

```text
Supabase ──lectura pública/RLS──> Astro build ──artefacto──> GitHub Pages
    ^                                                        │
    └──── JWT + RLS <──── CMS estático /admin <───────────────┘
```

Un solo repositorio contiene el sitio público y el shell administrativo. No existe un servidor Astro en producción ni routing dinámico del lado servidor. Las páginas administrativas editables serán físicas, por ejemplo `/admin/projects/edit/?id=UUID`.

## Límites de F1, F2 y F5

F1 entrega configuración, rutas, clientes Supabase separados, pruebas y documentación. F2 añade tokens visuales, fuentes locales, componentes compartidos, motion progresivo y estilos base del administrador. La pantalla visible es un fixture temporal sin contenido administrable. Estas responsabilidades permanecen para fases autorizadas posteriores:

- F6: grants, policies, Auth owner y Storage policies sobre el esquema cerrado de F5; Automatic RLS se conserva.
- F3/F4: contenido público y rutas internas alimentadas desde Supabase.
- F9: Edge Functions.
- F7: CMS `/admin`.
- F10: analítica.
- F11: Actions y Pages.

## Configuración y secretos

`src/lib/config/public.ts` aplica una allowlist de variables `PUBLIC_*`. La URL y publishable key pueden llegar al navegador; RLS sigue siendo la frontera de datos. `src/lib/config/build.ts` se utiliza en Node para derivar `site` y `base`.

`src/lib/supabase/browser.ts` prepara el cliente futuro del admin con persistencia de sesión y PKCE. `src/lib/supabase/build.ts` crea un cliente de lectura anónima sin persistencia. Ambos usan el transporte acotado de `src/lib/supabase/transport.ts`: Supabase JS 2.115.0 ya evita usar nuevas API keys como Bearer para Edge Functions, pero aún conserva ese fallback en Storage/REST. El guard elimina exclusivamente un Bearer que empiece con `sb_publishable_` o `sb_secret_`; conserva cualquier JWT de usuario. Una prueba de regresión permite retirar el guard cuando el SDK aplique la separación a todos los servicios.

Las Edge Functions no usan este guard como sistema de autenticación. En F9 se implementarán con `@supabase/server`, `withSupabase()` o `createSupabaseContext()` y el modo adecuado:

| Tipo de llamada               | Header                                      | Modo          |
| ----------------------------- | ------------------------------------------- | ------------- |
| Usuario con sesión            | `Authorization: Bearer <user JWT>`          | `user`        |
| Cliente público sin identidad | `apikey: sb_publishable_*`                  | `publishable` |
| Servicio autorizado           | `apikey: sb_secret_*`                       | `secret`      |
| Webhook con firma propia      | firma del proveedor, verificada por handler | `none`        |

El modo `none` no autentica: un callback debe verificar su firma. Un JWT autenticado tampoco implica administración; la autorización owner se mantiene en `admin_profiles`, `private.is_portfolio_admin()` y RLS.

## URLs y GitHub Pages

`PUBLIC_SITE_URL` es la URL pública completa. Los helpers centralizados derivan una base `/` o `/portfolio-alonso/`, agregan barra final a páginas y rechazan URLs externas o traversal. `astro.config.mjs` usa salida estática con formato de directorio.

La base inicial propuesta es `https://alarenas1988.github.io/portfolio-alonso/`. Un dominio propio cambiará la variable sin exigir rutas hardcodeadas. Canonical, sitemap, RSS y robots se terminan en F12.

## Estructura

```text
src/components/{public,admin,shared}/
src/layouts/
src/pages/
src/lib/{config,supabase,auth,analytics,markdown,media,seo,utils}/
src/styles/
src/types/
supabase/migrations/
supabase/functions/
tests/{unit,integration,e2e}/
scripts/
docs/
```

Las carpetas se crean cuando su fase las necesita. Las páginas coordinan; consultas, autorización, Markdown y publicación viven en módulos enfocados. F5 reemplaza el placeholder de DB por tipos generados reproduciblemente desde PostgreSQL local.

## Esquema y frontera de F5

Siete migraciones y un seed idempotente reconstruyen 32 tablas de public y tres de private. Todas nacen con RLS, permisos de cliente revocados y sin policies; la RPC de lectura también queda sin EXECUTE para anon/authenticated. No se ha aplicado el esquema remoto ni iniciado F6.

El contrato de build es `loadPublicSnapshot(): Promise<PublicSnapshot>`, implementado en `src/lib/content/snapshot.ts`. Una RPC SQL STABLE y SECURITY INVOKER devuelve una lectura consistente, con proyección explícita y filtrado de publicación, fechas, relaciones y media. El parser valida el contrato antes de presentar datos; una consulta fallida aborta sin fallback privilegiado. Las páginas de F2 conservan su fixture hasta F3 y las políticas de F6.

El catálogo completo, estados, cascades, sincronización de URLs/CV, referencias editoriales, pruebas y comandos de reconstrucción están en [CONTENT.md](CONTENT.md). Los tipos DB incluyen public/private, pero los DTO públicos derivan únicamente campos permitidos. Importar el loader está reservado al build; los módulos generales conservan la prohibición de importar código de build.

## Calidad

TypeScript usa el preset `strictest`. ESLint prohíbe `any` explícito y evita importar módulos build-only en código general de `src`. Prettier conserva una copia byte por byte del maestro fuera de su alcance.

El artefacto se valida por estructura, base y referencias; luego se analiza en busca de patrones privados. Unit tests ejercitan configuración, URLs, tokens y contraste. Playwright y axe prueban el artefacto a 360, 390, 768, 1024, 1440 y 1920px, incluida la 404, controles, touch, uso sin JavaScript y reduced motion.

Los tokens de F2 son la fuente visual compartida por Tailwind, el frontend y el futuro administrador. El admin reduce blur, glow y movimiento para priorizar densidad y legibilidad. La portada de muestra se reemplaza en F3 y no adelanta contenido público, navegación ni funcionalidades posteriores.
