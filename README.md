# AL — Portfolio Alonso Larenas

Portfolio personal premium de Alonso Larenas. El proyecto usa una arquitectura C2: Supabase es la fuente de verdad, Astro genera un sitio estático y GitHub Actions lo publica en GitHub Pages. El CMS privado vivirá en `/admin/` y accederá a Supabase mediante Auth, JWT y RLS.

## Estado

F1/F2/F5/F6/F8 y el despliegue inicial del backend están integrados. F3 implementa la Home estática con contenido público de Supabase, conservando el Design System aprobado. El CMS, las páginas internas, Edge Functions, tracking y la publicación C2 siguen pendientes de sus fases. [Contrato y validación de la Home](./docs/HOME.md).

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
- Los comandos de backend local requieren Docker y Supabase CLI (versionada en package.json). Las pruebas frontend usan fixtures HTTP locales y no necesitan Docker ni Supabase remoto.

En PowerShell, si `npm` intenta ejecutar `npm.ps1` y la política lo impide, usar `npm.cmd` con los mismos argumentos.

## Configuración local

Copiar `.env.example` a `.env.local` y completar únicamente variables públicas:

```dotenv
PUBLIC_SITE_URL=http://localhost:4321/portfolio-alonso/
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.local` está ignorado por Git. La Home requiere ambas variables Supabase; `PUBLIC_SUPABASE_PUBLISHABLE_KEY` acepta solo el formato `sb_publishable_*`. El build se detiene si falta configuración o falla la lectura pública.

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
npm.cmd run test:home:build
```

La primera ejecución E2E requiere instalar Chromium:

```powershell
npm.cmd exec playwright install chromium
```

Las pruebas unitarias comprueban contratos, visibilidad, rutas, contacto, fechas, media, configuración y tokens. Playwright verifica 320, 360, 390, 640, 768, 1024, 1280, 1440 y 1920px, Home completa/vacía, navegación, foco, 404, axe, reduced motion y no-JS. Conserva los fixtures aislados de F2/F8. Su servidor compila con datos y archivos sintéticos locales y apaga la API antes de abrir el navegador.

`test:home:build` prueba builds completos/vacíos y fallos de lectura, contrato y media obligatoria. Los fixtures viven en tests; no se insertan en Supabase ni en el seed. El comando normal `build` siempre consume el proyecto público configurado.

`node scripts/test-home-dev.mjs` verifica el servicio de assets generados en desarrollo. `node scripts/capture-home.mjs dist remote` guarda capturas locales reproducibles de seis tamaños en `.tools/f3-visual/`.

## Build

```powershell
npm.cmd run build
npm.cmd run preview
```

Astro genera `dist/` con HTML estático. `check:static` valida estructura y referencias internas bajo la base configurada; `check:secrets` busca material privado conocido y valores canario de las variables privadas disponibles durante el check.

El build consume `loadPublicSnapshot()` con publishable key y RLS. F8 descarga los assets públicos referenciados, genera AVIF/WebP/PNG y copia PDF dentro de `dist/assets/media/`. La Home publicada no consulta Supabase desde el navegador. No necesita una sesión owner ni service role. Un fallo de snapshot o de asset requerido aborta la compilación.

## Despliegue

La URL base inicial es `https://alarenas1988.github.io/portfolio-alonso/`. Astro deriva `site` y `base` de `PUBLIC_SITE_URL`, por lo que enlaces y assets funcionan en GitHub Pages bajo la subruta del repositorio.

El flujo final será:

```text
/admin → Supabase → Edge Function → repository_dispatch
       → GitHub Actions → Astro build → GitHub Pages
```

Los workflows y la publicación se implementarán en F11.

## Documentación

- [Especificación maestra](./PORTFOLIO_ALONSO_LARENAS_CODEX_MASTER.md)
- [Plan de implementación](./PLAN_IMPLEMENTACION_PORTFOLIO_ALONSO.md)
- [Arquitectura](./docs/ARCHITECTURE.md)
- [Decisiones de diseño](./docs/DECISIONS.md)
- [Registro de fases](./docs/PHASE_LOG.md)

`supabase/migrations/` es la fuente reproducible del backend desplegado. Automatic RLS coexiste con RLS, grants y policies explícitos. F3 consume el contrato existente sin modificar el backend remoto.
