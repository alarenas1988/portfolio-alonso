# Registro de fases

## Fase 1 — Bootstrap

**Estado:** completada; detenida para revisión antes de F2.

**Rama:** `feat/f1-bootstrap`
**Fecha:** 2026-09-05 (`America/Santiago`)

### Alcance

- Documento maestro incorporado con el mismo SHA-256 del original.
- Precisiones aprobadas registradas en el plan.
- Astro estático, Tailwind Vite, TypeScript estricto y Supabase JS.
- Configuración pública validada; `.env.local` ignorado y sin credenciales inventadas.
- Clientes Supabase de browser/build y separación API key/JWT.
- Rutas con base de GitHub Pages, layout público/admin mínimo y 404.
- Formato, lint, tipos, unit tests, E2E, checks de artefacto y secretos.
- README y arquitectura de instalación/despliegue.

### Decisiones y desviaciones

- Node 24.20.0 no estaba instalado en PATH. Para validar F1 se descargó el binario oficial en `.tools/`, se verificó contra `SHASUMS256.txt` y se ignoró en Git. Se recomienda activar Node 24 mediante Laragon o un version manager.
- Vite se elevó de 8.0.13 a 8.2.2 dentro del rango de Astro/Tailwind, porque 8.0.13 tenía dos advisories en Windows. `npm audit` queda limpio.
- npm 11 bloquea scripts de instalación sin aprobación. Se revisó y aprobó únicamente `esbuild@0.28.2`, fijado en `allowScripts`.
- Supabase JS 2.115.0 separa API keys para Edge Functions, pero aún usa la publishable key como Bearer en Storage/REST cuando no hay sesión. Se añadió un guard de transporte pequeño y probado que elimina solo ese fallback y preserva JWT reales.
- Astro 7 inicia `preview` en background al detectar agentes. Playwright fija `ASTRO_PREVIEW_BACKGROUND=0` para que gestione correctamente su proceso.
- No se creó configuración Supabase local ni se probó conexión remota: corresponde a F5 y no se entregaron credenciales en F1.
- GitHub CLI mantiene permiso READ. Es una dependencia obligatoria para F11, sin impacto en F1 local.

### Integraciones todavía simuladas o pendientes por fase

- El contenido todavía no se consulta desde Supabase.
- `Database` es un tipo placeholder vacío y documentado; F5 lo reemplaza por tipos generados.
- `AdminLayout` es un shell estático sin Auth; F6/F7 implementan identidad, owner y CMS.
- No existen migraciones, policies, buckets, Edge Functions ni workflows. Se conservan sus fases.

### Evidencia

- Node `24.20.0`; npm `11.19.0`.
- `npm ci`: 393 paquetes instalados desde lockfile, 0 vulnerabilidades.
- `npm ls --depth=0`: árbol válido, sin dependencias inválidas.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- `npm run format:check`: correcto.
- `npm run lint`: correcto, sin mensajes.
- `npm run typecheck`: 20 archivos, 0 errores, 0 advertencias, 0 hints.
- `npm test`: 36 pruebas aprobadas.
- `npm run build`: 2 páginas estáticas generadas.
- `npm run check:static`: 2 documentos HTML y base `/portfolio-alonso/` válidos.
- `npm run check:secrets`: 3 artefactos revisados, sin material privado detectado.
- `npm run test:e2e`: 9 pruebas aprobadas en desktop, tablet y mobile.
- Revisión visual manual de capturas desktop/mobile: legible, sin overflow y deliberadamente mínima.
- Hash del maestro versionado: `F38CE3E6A0E3A6AE012D29949D5170BB89F02FD443DFA1A2B7D5BF11AA106CD8`.

### Commits de F1

- `3ee008c docs: incorporate approved phase one scope and clarifications`
- `5413cd5 chore: bootstrap astro portfolio`
- `7ca668b docs: document phase one architecture and validation`

Los fallos RED de TDD y los fallos de entorno investigados no se presentan como checks finales: las pruebas fallaron primero por módulos/scripts ausentes; Playwright falló inicialmente porque Astro creó un preview en background; el audit detectó Vite vulnerable antes de subirlo a 8.2.2. La evidencia anterior procede de ejecuciones frescas posteriores a las correcciones.

## Fase 2 — Design System

**Estado:** completada; detenida para revisión antes de F3 y fases posteriores.

**Rama:** `feat/f2-design-system`

**Fecha:** 2026-09-05 (`America/Santiago`)

### Alcance

- Tokens exactos de color, glass, gradiente, tipografía, espaciado, contenedores, radios, glow y movimiento.
- Manrope, Space Grotesk y JetBrains Mono variables en WOFF2 locales; display/body precargadas.
- Fondo CSS Midnight con glows, grid y ruido tenues, sin imagen raster.
- Isotipo AL geométrico en componente gradiente/monocromo y favicon SVG.
- Lucide mediante `@lucide/astro`, con importaciones individuales.
- Button, GlassCard, SectionHeader, Badge, Input, FormField, Icon, Feedback y BrandMark.
- Motion progresivo con IntersectionObserver y requestAnimationFrame; tilt ±2°/±3° solo con puntero fino.
- Estilos admin con blur 12px y glow 0.035 frente a 24px y 0.10 del público.
- Fixture temporal en `/` para revisión; no se creó `/design-system` ni se inició la Home definitiva.

### Revisión visual

- 360px: H1 se divide en dos líneas; botones ocupan todo el ancho; cards y admin se apilan sin overflow.
- 390px: H1 cabe en una línea; jerarquía y targets conservan aire lateral de 20px.
- 768px: principios en tres columnas; componentes en una columna amplia; padding lateral de 32px.
- 1024px: composición de componentes 7/5 y 5/7; jerarquía estable y sin colapso de cards.
- 1440px: ancho de contenido limitado a 1280px y secciones con ritmo editorial amplio.
- 1920px: el contenido permanece centrado y no se estira por encima del máximo definido.

### Accesibilidad y performance

- Axe no detecta incidencias WCAG A/AA/2.1 AA en los seis anchos.
- Contraste calculado: Primary 19.07:1, Secondary 13.44:1 y Muted 7.78:1 sobre Midnight 950.
- Texto Midnight sobre los cuatro stops del CTA: entre 4.71:1 y 11.04:1.
- Subtle 4.19:1 queda sin uso como texto pequeño.
- Todos los botones e inputs tienen al menos 44px; foco visible, disabled, loading, error y feedback son verificables.
- Reduced motion elimina transformaciones decorativas; touch no activa tilt; el contenido funciona sin JavaScript.
- El JS propio se limita a un módulo de motion sin framework, loops permanentes ni librerías de animación.

### Commits de F2

- `555f06c feat: implement portfolio design tokens`
- `a5ec868 feat: add accessible shared components`

La instalación inicial de `lucide-astro` produjo una advertencia de deprecación. Se sustituyó antes de implementar iconos por el paquete oficial `@lucide/astro@1.41.0`. La primera revisión visual detectó cards colapsadas por el aislamiento de CSS scoped; una prueba de ancho reprodujo el fallo y el selector compartido se corrigió antes de generar las capturas finales.
