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

## Acceso administrativo futuro

`get_analytics_report(from,to)` es SECURITY INVOKER con comprobación `private.is_portfolio_admin()` y RLS. Anon no tiene EXECUTE; authenticated sin owner y owner inactivo reciben denegación. Owner activo puede leer agregados; no ejecutar mantenimiento/ranking. Raw y agregados nunca entran al snapshot público.

`src/lib/analytics/queries.ts` prepara DTO validado en runtime y repositorio tipado: resumen, serie diaria, top 20 páginas, top 20 proyectos y top 20 posts, interacciones y dimensiones. Rangos 7/30 días o personalizado, máximo 366 fechas dentro de la retención, sin futuro. No descarga raw. Las sesiones del rango usan COUNT(DISTINCT session_hash) sobre el conjunto de fechas, nunca SUM de unique_sessions diarios. La rotación limita su interpretación a sesiones aproximadas.

## Comandos y operación

```powershell
npm.cmd run db:start
node scripts/test-analytics-upgrade-local.mjs
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

El test de upgrade destruye únicamente el stack local de prueba validado en 58421/58422; crea una copia ignorada de 019–021, conserva un evento al aplicar 022 y después reconstruye las cuatro migraciones desde volumen vacío. Nunca acepta DB remota ni modifica los archivos históricos. Los fixtures HTTP se eliminan por UUID; se recalculan sus agregados después de limpiar raw.

Rate limits existentes: 60/min por sesión, 120/min por señal de origen y 10000/h global; body 4 KiB. Secrets consumidores: ANALYTICS_HMAC_SECRET (hash diario, reutilizado), ANALYTICS_RATE_LIMIT_HMAC_SECRET (abuso de tracking), contexto Supabase administrado dentro de Edge y configuración pública de orígenes/URL. Ninguno participa en el build público. No rotar secretos existentes sin motivo.

La operación remota requiere puerta local aprobada, proyecto verificado, backup/inventario, diff completo y dry-run exclusivo de 022. Solo se ejecuta deploy de track-event. Añadir un secreto de proyecto hizo que la plataforma incrementara contact-submit de v2 a v3 sin cambiar su código: los 14 archivos descargados coinciden con el SHA base F9. No se ejecutó deploy de contacto. Supabase aplica los secrets inmediatamente sin requerir otro despliegue de código ([documentación oficial](https://supabase.com/docs/guides/functions/secrets)). El cierre F10 registra ejecución, pruebas e incidencias sin valores de secrets.

## Consumidor administrativo F7

/admin/analytics utiliza loadAnalyticsReport y la RPC owner-only de F10. Consulta únicamente agregados para 7/30 días o un rango acotado; muestra métricas, tablas top, interacciones y tendencia SVG. Indica que las sesiones son aproximadas y rotan diariamente. No consulta raw events, no agrega tracking y no modifica retención ni HMAC. Los scripts públicos de Analytics no se cargan en Admin. [Guía CMS](ADMIN_CMS.md).
