# Decisiones de diseño

## Sistema visual de F2

La fuente de verdad visual es `src/styles/tokens.css`. Contiene la paleta, gradiente, tipografía, escalas de espacio, anchos, radios, glass, glow y tiempos definidos en el maestro. Tailwind consume los mismos valores mediante `@theme inline`; los componentes no mantienen una paleta paralela.

El fondo global se genera con gradientes y patrones CSS. No usa imágenes raster, filtros animados ni loops permanentes. Las tres superficies glass existen para jerarquías distintas y se aplican solo en la muestra de componentes seleccionados. El fallback sin `backdrop-filter` utiliza Midnight 800 opaco.

## Tipografías

Manrope Variable, Space Grotesk Variable y JetBrains Mono Variable se distribuyen como WOFF2 latinos locales bajo la licencia OFL 1.1. El build de Vite genera URLs con hash y la base correcta de GitHub Pages. Manrope y Space Grotesk se precargan porque aparecen en la primera vista; JetBrains Mono se descarga cuando el navegador encuentra una etiqueta técnica. Todas usan `font-display: swap` y fallbacks del sistema.

## Marca e iconografía

El isotipo AL usa dos formas geométricas dentro de un campo de 64 unidades. El componente permite gradiente o monocromo y el favicon conserva la misma geometría sin texto ni datos raster. Los iconos de interfaz proceden exclusivamente de `@lucide/astro`; se importan de forma individual y se renderizan como SVG estático.

Durante la instalación se descartó `lucide-astro` porque npm lo marca como deprecado. Se adoptó el sucesor oficial `@lucide/astro`, que mantiene la familia Lucide requerida.

## Movimiento y degradación

El contenido se muestra por defecto. JavaScript mejora los reveals fuera de la primera vista mediante IntersectionObserver. Tilt y spotlight solo se activan con puntero fino, leen geometría y escriben variables CSS dentro de `requestAnimationFrame`, y se limitan a ±2°/±3°. `prefers-reduced-motion: reduce`, touch, JavaScript desactivado o falta de IntersectionObserver conservan todo el contenido visible y funcional.

## Accesibilidad y contraste

Los textos normales usan Primary, Secondary o Muted sobre Midnight. Subtle queda reservado y no se usa como texto pequeño. Las combinaciones usadas superan 4.5:1; el botón con gradiente usa Midnight 950 y supera AA en sus cuatro stops. Todos los controles tienen un alto mínimo de 44px, foco visible, label y feedback textual además del color.

## Público y administrador

Los estilos administrativos reutilizan tokens y tipografías, reducen el blur de 24px a 12px y el glow ambiental de 0.10 a 0.035. También usan radios y espaciado más compactos. F2 solo prepara esta infraestructura: no crea rutas, navegación, autenticación ni pantallas del CMS.

## Fixture visual

La portada actual es una muestra temporal de F2 para revisar componentes en el artefacto estático. No es la Home, el Hero ni la navegación definitivos y F3 la reemplazará. No se publica una ruta `/design-system` adicional.

Playwright genera capturas locales a 360, 390, 768, 1024, 1440 y 1920px. Los artefactos viven en `test-results/`, están ignorados por Git y no forman parte del sitio publicado.
