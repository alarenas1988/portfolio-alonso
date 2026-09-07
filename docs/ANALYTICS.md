# F10 — Analytics first-party

Base `origin/main`: `e528078f19a245af7d56b00be6895e3af681777a`, con F9 y los checkpoints aprobados integrados. Rama `feat/f10-first-party-analytics`, worktree `.worktrees/f10-first-party-analytics`. Implementación secuencial: el skill superpowers solicitado no estaba disponible. No incluye dashboard F7 ni publicación F11.

## Flujo y eventos

HTML estático → cliente nativo → `track-event` → RPC F9 `edge_record_event` → raw privado → recomputación PostgreSQL horaria → agregados privados → repositorio owner. La única allowlist TypeScript es `supabase/functions/_shared/events.ts`, extraída sin cambiar los doce nombres de F9.

| Origen                              | Eventos                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| Documento público visible           | `page_view`, además `project_view` o `post_view` en un detalle                                 |
| Enlaces relevantes                  | `whatsapp_click`, `email_click`, `github_click`, `linkedin_click`, `demo_click`, `cv_download` |
| Acción confirmada                   | `email_copy`, `article_share`                                                                  |
| Transacción de contacto en servidor | `contact_submit`                                                                               |

`contact_submit` no se puede emitir desde el cliente ni aceptar en `track-event`. F9 persiste mensaje y conversión juntos; retry con el mismo UUID no duplica ninguno. El frontend del formulario permanece intacto. No se copia ningún campo del formulario a Analytics, ni siquiera hasheado.

El cliente vive en `src/lib/analytics/client.ts`; `src/scripts/analytics.ts` lo inicializa una sola vez por Document. Reutiliza los hooks de F3/F4 y un listener delegado de enlaces; copia/compartir se registran mediante el hook confirmado. No hay listeners de scroll, hover, teclado ni movimiento. No se intercepta ni espera la navegación. Fetch usa keepalive, credentials omit, referrerPolicy no-referrer, timeout 5 s y cero retries. Los errores no generan UI ni logs de producción.

Una vista se registra al hacerse visible el documento. Doble inicialización, eventos Astro o restauración del mismo documento desde BFCache no generan otra vista. Un reload real sí. Se deduplica el mismo objeto Event, no dos clicks legítimos diferentes. Cada entrega tiene UUID propio; la RPC garantiza idempotencia sobre event_id.

## Datos y privacidad

Payload permitido: `event_id`, `session_id`, `event_type`, pathname normalizado; UUID público de proyecto/artículo cuando corresponde y categoría de referrer opcional. No query, fragment, título libre, URL de destino, signed URL, canal arbitrario ni blob properties. CV y compartir conservan el contrato F9: acción y contexto público de página; no añaden document_id o channel no previstos. La DB valida existencia, slug y publicación del contenido, incluidos posts futuros.

El referrer se reduce **antes del envío** a same-site, google.com, google.cl, bing.com, duckduckgo.com, github.com, linkedin.com u other. La Edge repite la reducción. El UA se deriva en categorías generales ya existentes en F9 (desktop/mobile/tablet/unknown y familia de navegador), sin conservar el string. No se recogen resolución, hardware, fuentes ni canvas.

La sesión usa UUID aleatorio en sessionStorage y rota además al cambiar el día UTC. Una pestaña normal conserva sesión al recargar; otra pestaña tiene su propio almacén. Si el almacenamiento no existe, está bloqueado o es inválido, se utiliza memoria y la web continúa. Nunca localStorage ni cookies. La duplicación de pestañas/restauración del navegador puede copiar sessionStorage según el navegador; los enlaces nuevos usan noopener y no se intenta corregirlo mediante fingerprinting. [Semántica de sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

El servidor guarda HMAC-SHA256 del UUID con namespace y fecha **UTC**, rotación a las 00:00 UTC, usando `ANALYTICS_HMAC_SECRET` ya existente. No almacena el UUID recibido. Rate limiting usa otro HMAC/secret y señal de ingreso normalizada; no persiste IP completa. No hay reconocimiento de personas entre días. Los conteos son aproximaciones de sesiones con hashes diarios, no visitantes únicos históricos.

DNT=1/yes y GPC desactivan el cliente antes de crear sesión. Edge respeta DNT=1/GPC=1 con respuesta genérica sin persistir. Bots evidentes (Googlebot, bingbot, DuckDuckBot, HeadlessChrome, Playwright y HealthCheck) se omiten; es un filtro limitado de calidad, no autorización. El cliente también omite webdriver. El contacto solicitado explícitamente sigue su transacción funcional y registra una conversión mínima server-side, incluso sin tracking cliente.

No se registran nombre, email, asunto, mensaje, IP completa, JWT, tokens, cookies ni historial cross-site. No hay terceros Analytics, CMP, banner artificial ni afirmaciones de cumplimiento legal absoluto.

## Configuración y pruebas sin contaminación

`PUBLIC_ANALYTICS_ENABLED=false` deshabilita la instrumentación. En producción se habilita por defecto; en Astro dev permanece deshabilitada. Además el origen real debe coincidir con PUBLIC_SITE_URL: un preview local del artefacto de producción no cuenta tráfico. Es una preferencia de ejecución, no una barrera de seguridad del receptor.

`PublicLayout` admite `analyticsDisabled` para futuras previews administrativas. Solo las rutas públicas aprobadas producen payload. `/admin/`, 404 y rutas desconocidas se omiten. Los E2E generales construyen con Analytics deshabilitado. Los dedicados lo habilitan exclusivamente contra un endpoint mock de loopback; no requieren disponibilidad remota ni envían tráfico a producción. Sin JS la web sigue funcional y no hay eventos cliente.

## Agregación, concurrencia y retención

Se reutilizan `analytics_events`, `analytics_daily`, `analytics_daily_content`, `private.analytics_daily_dimensions` y `private.analytics_daily_sessions`. La migración **022** añade solamente el contador interactions por contenido, un índice temporal y funciones/jobs propios. No crea tablas duplicadas ni modifica 019/020/021.

`refresh_analytics(from,to)` es SECURITY INVOKER, solo service_role. Reconstruye de forma idempotente hasta siete fechas inclusivas respaldadas por raw. Por defecto recalcula hoy y ayer en **America/Santiago**. Usa advisory lock para serializar jobs y SHARE sobre raw para que todos los agregados vean el mismo conjunto dentro de una transacción. Los inserts concurrentes esperan brevemente; después quedan para el siguiente ciclo, sin perder incrementos ni simular transacciones desde Edge. [Locks PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).

`portfolio-analytics-maintenance` se ejecuta mediante pg_cron en el minuto 7 de cada hora bajo service_role. Llama `maintain_analytics`: recomputación, retención y ranking. La latencia esperada de reportes es hasta una hora. Los cambios DST se calculan con IANA America/Santiago; nunca offsets UTC-3/UTC-4 fijos.

- Raw: **90 fechas de reporte**, incluyendo hoy (límite inferior hoy−89 a medianoche Santiago).
- Agregados y conjuntos mínimos de sesiones: **400 fechas**, incluyendo hoy (hoy−399).
- Counters de abuso: ventanas/TTL máximo una hora y cleanup de F9 cada 15 minutos.
- Histórico agregado se conserva después de purgar raw. Se rechaza recomputar fechas anteriores a la ventana raw para no destruir ese histórico.

La suite prueba fronteras DST, retención e idempotencia. Si cron permanece detenido más de dos días, debe recuperarse mediante backfill por tramos de hasta siete fechas **antes de que venza raw**. No se promete recuperar datos ya purgados. El lock debe vigilarse si el volumen crece; el diseño apunta a un portfolio, no a telemetría masiva.

daily contiene los doce contadores; unique_sessions proviene solo de page_view. Una conversión aislada no inventa una visita. Por contenido, views cuenta project_view/post_view; page_view no duplica esa cifra. Interactions agrega acciones relevantes. Las dimensiones reutilizan el esquema aprobado.

Popularidad: SUM(views) de posts en los últimos 30 días de reporte, solo publicados y no futuros; rank ascendente por vistas descendentes y UUID como desempate. Sin vistas → NULL. El snapshot solo expone el popular_rank previamente aprobado, nunca conteos ni hashes.

`private.update_analytics_popularity()` es el único SECURITY DEFINER nuevo: owner postgres, search_path vacío, sin argumentos, nombres completos, EXECUTE únicamente service_role. Actualiza solo el ranking calculado. Es necesario porque actualizar posts ejecuta los triggers editoriales de media F8; encapsular este cálculo evita conceder CRUD amplio sobre media al servidor. No autoriza identidad ni acepta SQL, tablas, IDs o rank del caller. Los tres definer F6 permanecen sin cambios.

## Acceso administrativo

`get_analytics_report(from,to)` es SECURITY INVOKER con comprobación `private.is_portfolio_admin()` y RLS. Anon no tiene EXECUTE; authenticated sin owner y owner inactivo reciben denegación. Owner activo puede leer agregados; no ejecutar mantenimiento/ranking. Raw y agregados nunca entran al snapshot público.

`src/lib/analytics/queries.ts` prepara DTO validado en runtime y repositorio tipado: resumen, serie diaria, top 20 páginas, top 20 proyectos y top 20 posts, interacciones y dimensiones. Rangos 7/30 días o personalizado, máximo 366 fechas dentro de la retención, sin futuro. No descarga raw. Las sesiones del rango usan COUNT(DISTINCT session_hash) sobre el conjunto de fechas, nunca SUM de unique_sessions diarios. La rotación limita su interpretación a sesiones aproximadas.

## Comandos y operación

```powershell
npm.cmd run db:start
npm.cmd run db:types:check
npm.cmd run db:lint
npm.cmd run db:test
npm.cmd run db:types:check
npm.cmd run edge:serve
# Otra terminal:
npm.cmd run test:edge
npm.cmd run test:edge:http
npm.cmd run test:analytics:local
npm.cmd run test:contact:local
npm.cmd run test:auth:local
npm.cmd run test:media:local
npm.cmd test
npm.cmd run test:e2e
```

El test histórico `test-analytics-upgrade-local.mjs` pertenece a la evidencia F10A: probó 021→022 y reconstruyó las cuatro migraciones de ese checkpoint. No utilizarlo como preparación del entorno actual, que ya incluye 023. Para reconstruir hoy el stack de pruebas vacío se utiliza `npm.cmd run db:reset`, que aplica todas las migraciones activas. Los fixtures HTTP se eliminan por UUID; se recalculan sus agregados después de limpiar raw.

Rate limits existentes: 60/min por sesión, 120/min por señal de origen y 10000/h global; body 4 KiB. Secrets consumidores: ANALYTICS_HMAC_SECRET (hash diario, reutilizado), ANALYTICS_RATE_LIMIT_HMAC_SECRET (abuso de tracking), contexto Supabase administrado dentro de Edge y configuración pública de orígenes/URL. Ninguno participa en el build público. No rotar secretos existentes sin motivo.

La operación remota requiere puerta local aprobada, proyecto verificado, backup/inventario, diff completo y dry-run exclusivo de 022. Solo se ejecuta deploy de track-event. Añadir un secreto de proyecto hizo que la plataforma incrementara contact-submit de v2 a v3 sin cambiar su código: los 14 archivos descargados coinciden con el SHA base F9. No se ejecutó deploy de contacto. Supabase aplica los secrets inmediatamente sin requerir otro despliegue de código ([documentación oficial](https://supabase.com/docs/guides/functions/secrets)). El cierre F10 registra ejecución, pruebas e incidencias sin valores de secrets.

## Consumidor administrativo F7

/admin/analytics utiliza loadAnalyticsReport y la RPC owner-only de F10. Consulta únicamente agregados para 7/30 días o un rango acotado; muestra métricas, tablas top, interacciones y tendencia SVG. Indica que las sesiones son aproximadas y rotan diariamente. No consulta raw events, no agrega tracking y no modifica retención ni HMAC. Los scripts públicos de Analytics no se cargan en Admin. [Guía CMS](ADMIN_CMS.md).

## Cierre F10B

F10A ya había implementado todos los objetos de datos previstos para F10B y F7 ya consumía sus métricas. El [análisis previo](checkpoints/F10B_GAP_ANALYSIS.md) evita duplicar tablas, RPC, dimensiones, índices, sesiones, retención y jobs. F10B añade verificación de operación/rendimiento y corrige una carrera de presentación: una respuesta lenta de un período anterior podía reemplazar el seleccionado. El Admin ahora aplica solamente la respuesta/error de la consulta vigente; no modifica el contrato SQL ni el bundle público.

La ejecución automática se verificó directamente en `cron.job_run_details`, sin invocar ni reprogramar el job: `portfolio-analytics-maintenance`, job 2, `7 * * * *`, corrió correctamente a las 22:07 y 23:07 UTC del 2026-09-06. Durante el cierre se observó además el run 21 del 2026-09-07 a las 00:07 UTC (21:07 del día 6 en Santiago), succeeded, 41,349 ms, posterior al deploy F7. Cron utiliza GMT; cada comando calcula fechas de informe con America/Santiago. El job de contadores `portfolio-rate-limit-retention`, job 1, continúa cada 15 minutos. [Monitorización soportada por Supabase](https://supabase.com/docs/guides/cron).

El dataset de rendimiento es exclusivamente local: 95.000 eventos, 95 fechas, ocho proyectos, ocho posts y doce tipos. Se generan los agregados existentes, se actualizan estadísticas y se ejecuta EXPLAIN ANALYZE/BUFFERS dentro de una transacción que termina en ROLLBACK. No es una carga remota ni una garantía de latencia del plan Free.

| Consulta/operación local                       | Tiempo observado |
| ---------------------------------------------- | ---------------: |
| Reporte owner 7 días                           |           6,3 ms |
| Reporte owner 30 días                          |           7,0 ms |
| Reporte owner 366 días                         |          11,4 ms |
| Top páginas 30 días                            |           0,4 ms |
| DISTINCT de sesiones 30 días                   |           1,8 ms |
| Refresh de dos fechas                          |          46,8 ms |
| Mantenimiento, incluida purga de 5.000 eventos |          56,5 ms |

El reporte de 30 días mide 13.302 bytes JSON sin comprimir. El CMS hace una RPC y, si hay top content, dos consultas batched para sus títulos (máximo 40 IDs); no N+1 ni descarga raw. Las trece sumas sobre `analytics_daily` recorren como máximo 400 filas pequeñas: no se justifica una RPC nueva ni reescribirlas por ese costo. EXPLAIN observa el índice raw `analytics_events_created_at` para la ventana reciente y las claves por fecha de dimensiones/sesiones para sus rangos. No se añadieron índices. El nodo Result de una función PL/pgSQL mide su costo total pero no desglosa su SQL interno; por eso se midieron también las consultas relevantes por separado. [Interpretación de EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html).

### Integridad histórica y recuperación

Cambiar slug mantiene el UUID de contenido; nuevos eventos requieren la ruta vigente. Los conteos por contenido conservan continuidad; la dimensión pathname conserva las rutas históricas separadas. Archivar/despublicar impide nueva ingestión y retira el rank en la siguiente recomputación; no borra eventos existentes.

Eliminar contenido aplica ON DELETE SET NULL en raw, sin cascade. Los agregados históricos guardan UUID sin FK y el CMS presenta «Contenido retirado». Al recalcular una fecha después del borrado, los raw con FK nula ya no pueden atribuirse a ese contenido: los totales diarios se mantienen, pero se retira la atribución de contenido de esa fecha. Las fechas no recalculadas conservan la atribución histórica hasta su retención. Es el límite explícito del modelo aprobado, no una identidad reconstruida a partir de slugs.

Una falla de agregación revierte todo el mantenimiento: quedan los raw ya recibidos y la última versión válida de los agregados. El próximo job recompone hoy/ayer. Si la interrupción supera dos fechas, un operador debe recalcular los días faltantes por tramos de hasta siete fechas mediante `refresh_analytics(desde,hasta)`, bajo el contexto de servicio administrado existente, antes de ejecutar la purga y antes de perder raw. Solo admite fechas retenidas (hoy−89 a hoy); no promete reconstruir datos vencidos. La UI owner solo lee reportes; no se abrió EXECUTE de mantenimiento al navegador.

La purga actual es una transacción por ventana vencida, no un cursor de lotes configurable. El ensayo de 5.000 vencidos/95.000 raw fue breve; no se cambia la implementación por carga hipotética. Vigilar duración/fallos del job y esperas de locks si aumenta el volumen o hay una interrupción larga. La retención sigue siendo 90/400 fechas inclusivas y los límites se probaron hasta el microsegundo alrededor del corte Santiago, además de DST.

El proyecto usa el plan Free identificado en los checkpoints. La oferta consultada incluye 500 MB de base de datos y CPU compartida, sin backup automático/PITR y con posible pausa tras inactividad; Analytics comparte ese presupuesto con contenido e índices. pg_cron ya está disponible y operativo en este proyecto, sin infraestructura adicional. No tomar el rate limit global como capacidad sostenible de almacenamiento ni el ensayo local como SLA remoto. Se conservan las prácticas de respaldo lógico del portfolio y la supervisión de uso del proyecto; no se añade un sistema de backup de Analytics. [Límites publicados del plan](https://supabase.com/pricing).

Comprobaciones F10B reproducibles:

```powershell
node scripts/benchmark-analytics-local.mjs --local-only
npm.cmd run db:test
npm.cmd run test:analytics:local
npm.cmd run test:admin -- --grep "Analytics|Session failure"
node scripts/audit-analytics-closure-remote.mjs --read-only
```

El auditor reutiliza el comparador de catálogo/tipos de F7 dentro del worktree actual; su flag histórico no realiza despliegues ni fixtures. Inspecciona cron, estado y dry-run vacío. No se modificó el remoto, ni se rotaron secrets, ni se desplegó track-event. [Entrega completa F10B](checkpoints/F10B_ANALYTICS_CLOSURE.md).
