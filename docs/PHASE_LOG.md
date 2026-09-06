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
- `npm test`: 33 pruebas aprobadas.
- `npm run build`: 2 páginas estáticas generadas.
- `npm run check:static`: 2 documentos HTML y base `/portfolio-alonso/` válidos.
- `npm run check:secrets`: 3 artefactos revisados, sin material privado detectado.
- `npm run test:e2e`: 9 pruebas aprobadas en desktop, tablet y mobile.
- Revisión visual manual de capturas desktop/mobile: legible, sin overflow y deliberadamente mínima.
- Hash del maestro versionado: `F38CE3E6A0E3A6AE012D29949D5170BB89F02FD443DFA1A2B7D5BF11AA106CD8`.

### Commits de F1

- `3ee008c docs: incorporate approved phase one scope and clarifications`
- `5413cd5 chore: bootstrap astro portfolio`
- Commit de documentación y evidencia: el commit que contiene esta sección.

Los fallos RED de TDD y los fallos de entorno investigados no se presentan como checks finales: las pruebas fallaron primero por módulos/scripts ausentes; Playwright falló inicialmente porque Astro creó un preview en background; el audit detectó Vite vulnerable antes de subirlo a 8.2.2. La evidencia anterior procede de ejecuciones frescas posteriores a las correcciones.
