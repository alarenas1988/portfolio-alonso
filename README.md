# AL — Portfolio Alonso Larenas

Portfolio personal premium de Alonso Larenas. El proyecto usa una arquitectura C2: Supabase es la fuente de verdad, Astro genera un sitio estático y GitHub Actions lo publica en GitHub Pages. El CMS privado vivirá en `/admin/` y accederá a Supabase mediante Auth, JWT y RLS.

## Estado

Fases 1 y 2 completadas: bootstrap técnico y Design System. La pantalla actual es un fixture visual temporal, sin datos profesionales ficticios; F3 la reemplazará por la Home definitiva. El contenido público, PostgreSQL, RLS, Storage, Edge Functions y el CMS corresponden a fases posteriores del [plan de implementación](./PLAN_IMPLEMENTACION_PORTFOLIO_ALONSO.md).

## Stack actual

- Astro 7 con salida estática y rutas con barra final.
- Tailwind CSS 4 mediante `@tailwindcss/vite`.
- TypeScript 6 en modo `strictest`.
- Supabase JS preparado con publishable key y sin secretos privilegiados.
- ESLint, Prettier, Node Test Runner, Playwright y axe.
- Node.js 24 LTS y npm 11 fijados para desarrollo y CI.
- Manrope Variable, Space Grotesk Variable y JetBrains Mono Variable servidas localmente.
- Lucide Astro para iconos SVG estáticos.

## Design System

Los tokens canónicos viven en `src/styles/tokens.css`; los estilos globales, motion y admin se mantienen separados. Los componentes compartidos cubren botones, glass cards, encabezados, badges, inputs, campos, iconos, feedback e isotipo.

La interacción usa CSS, IntersectionObserver y `requestAnimationFrame`. Tilt y spotlight solo se activan con puntero fino; reduced motion y funcionamiento sin JavaScript están cubiertos por pruebas. Las decisiones visuales se documentan en [docs/DECISIONS.md](./docs/DECISIONS.md).

## Requisitos

- Node.js `24.20.0`.
- npm `11.19.0`.
- Para este equipo con Laragon, activar Node 24 o agregar su carpeta al `PATH`. F1 descargó una copia temporal verificada en `.tools/`, ignorada por Git; no forma parte del repositorio.
- Las fases con Supabase local requerirán Supabase CLI y Docker. Se configurarán y verificarán en F5.

En PowerShell, si `npm` intenta ejecutar `npm.ps1` y la política lo impide, usar `npm.cmd` con los mismos argumentos.

## Configuración local

Copiar `.env.example` a `.env.local` y completar únicamente variables públicas:

```dotenv
PUBLIC_SITE_URL=http://localhost:4321/portfolio-alonso/
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.local` está ignorado por Git. Durante F1, ambas variables Supabase pueden quedar vacías; deben configurarse juntas cuando se conecte el contenido. `PUBLIC_SUPABASE_PUBLISHABLE_KEY` acepta solo el formato `sb_publishable_*`.

Una clave publicable se envía como API key. No representa una sesión y no debe tratarse como JWT. Los JWT de usuario corresponden a `Authorization: Bearer <user JWT>`; las API keys corresponden al header `apikey`. Ninguna clave `sb_secret_*`, service role, token de GitHub o secreto Edge puede entrar en variables `PUBLIC_*`.

Las variables privadas configuradas manualmente para Edge en fases posteriores se enumeran, sin valores, en `.env.edge.example`. El mismo archivo documenta cuáles entrega el runtime de Supabase y separa el access token reservado para herramientas de despliegue. Supabase Edge Functions priorizarán `@supabase/server` y sus modos `user`, `publishable`, `secret` y `none` según el endpoint.

## Desarrollo

```powershell
npm.cmd ci
npm.cmd run dev
```

Con `PUBLIC_SITE_URL` del ejemplo, el sitio se abre en `http://localhost:4321/portfolio-alonso/`.

## Calidad y pruebas

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run check:static
npm.cmd run check:secrets
npm.cmd run test:e2e
```

La primera ejecución E2E requiere instalar Chromium:

```powershell
npm.cmd exec playwright install chromium
```

Las pruebas unitarias comprueban rutas con y sin subruta, configuración pública, separación de credenciales, tokens, contraste y validadores del artefacto. Las pruebas E2E verifican 360, 390, 768, 1024, 1440 y 1920px, navegación básica, controles, 404, accesibilidad automatizada, reduced motion, touch, overflow y funcionamiento sin JavaScript.

## Build

```powershell
npm.cmd run build
npm.cmd run preview
```

Astro genera `dist/` con HTML estático. `check:static` valida estructura y referencias internas bajo la base configurada; `check:secrets` busca material privado conocido y valores canario de las variables privadas disponibles durante el check.

El build de producción consumirá contenido público de Supabase con la publishable key y RLS. No necesita service role. La página de F2 indica explícitamente que la infraestructura visual está lista; todavía no consulta contenido.

## Despliegue

La URL base inicial es `https://alarenas1988.github.io/portfolio-alonso/`. Astro deriva `site` y `base` de `PUBLIC_SITE_URL`, por lo que enlaces y assets funcionan en GitHub Pages bajo la subruta del repositorio.

El flujo final será:

```text
/admin → Supabase → Edge Function → repository_dispatch
       → GitHub Actions → Astro build → GitHub Pages
```

Los workflows y la publicación se implementarán en F11. La credencial GitHub CLI observada tiene permiso de lectura; esto no bloquea el desarrollo local y debe resolverse antes de F11.

## Documentación

- [Especificación maestra](./PORTFOLIO_ALONSO_LARENAS_CODEX_MASTER.md)
- [Plan de implementación](./PLAN_IMPLEMENTACION_PORTFOLIO_ALONSO.md)
- [Arquitectura](./docs/ARCHITECTURE.md)
- [Decisiones de diseño](./docs/DECISIONS.md)
- [Registro de fases](./docs/PHASE_LOG.md)

No ejecutar todavía migraciones o tablas manuales. Desde F5, `supabase/migrations/` será la fuente reproducible del esquema; Automatic RLS permanece habilitado y se complementará con RLS, grants y policies explícitos en migraciones.
