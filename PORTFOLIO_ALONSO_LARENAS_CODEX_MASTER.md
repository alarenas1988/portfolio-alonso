# PORTFOLIO PERSONAL — ALONSO LARENAS
## Especificación maestra para implementación con Codex

**Estado:** Diseño aprobado para implementación  
**Arquitectura:** C2 — Astro + Tailwind CSS + TypeScript + Supabase + GitHub Pages + GitHub Actions  
**Objetivo:** Construir un portafolio personal premium, responsive, administrable y altamente visual, con publicación estática automatizada desde un CMS privado integrado en `/admin`.

---

# 1. Objetivo general

Construir un sitio web de portafolio personal para **Alonso Larenas**, orientado simultáneamente a:

- reclutadores;
- clientes y organizaciones;
- networking profesional;
- presentación de proyectos tecnológicos;
- publicación de artículos técnicos y notas tipo blog;
- demostración de experiencia en automatización, desarrollo, datos, IA aplicada y transformación digital.

El sitio debe transmitir una identidad **Tech Premium + Liquid Glass selectivo**, con una estética moderna, profesional y tecnológica, evitando tanto el aspecto de plantilla genérica como el exceso de efectos visuales.

---

# 2. Identidad de marca

## 2.1 Marca principal

- **Nombre:** Alonso Larenas
- **Isotipo:** AL
- **Posicionamiento:** marca personal tecnológica
- **Claim base:** Automatización · Desarrollo · Transformación Digital

## 2.2 Criterios de marca

- El isotipo `AL` debe ser geométrico, minimalista y escalable.
- Debe funcionar correctamente como:
  - favicon;
  - icono de navbar;
  - avatar;
  - elemento Hero;
  - recurso decorativo.
- No debe depender de detalles finos que se pierdan en 16px–32px.
- El sitio NO debe identificarse visualmente con una institución específica.
- Los proyectos institucionales deben presentarse como casos de estudio profesionales, sin convertir la identidad del sitio en una marca institucional.

---

# 3. Arquitectura técnica aprobada

## 3.1 Stack

- **Frontend / SSG:** Astro
- **CSS:** Tailwind CSS
- **Lenguaje:** TypeScript
- **Backend:** Supabase
- **Base de datos:** PostgreSQL
- **Autenticación:** Supabase Auth
- **Archivos:** Supabase Storage
- **Backend serverless:** Supabase Edge Functions
- **Hosting público:** GitHub Pages
- **Repositorio:** GitHub
- **CI/CD:** GitHub Actions

## 3.2 Principio de arquitectura

Usar **un solo repositorio y un solo proyecto Astro**.

Dentro del mismo proyecto coexistirán:

1. **Sitio público prerenderizado** durante el build.
2. **Panel `/admin`** estático, hidratado en el navegador y conectado a Supabase.

### Flujo público

```text
Supabase
   ↓
GitHub Actions
   ↓
Astro Build
   ↓
HTML/CSS/JS estático
   ↓
GitHub Pages
```

### Flujo administrativo

```text
GitHub Pages
   ↓
/admin
   ↓
TypeScript
   ↓
Supabase Auth
   ↓
JWT
   ↓
PostgreSQL + RLS
```

## 3.3 Fuente única de verdad

**Supabase/PostgreSQL es la fuente única de verdad.**

GitHub Pages contiene únicamente la última compilación pública correcta.

Si un build falla:

- los datos ya guardados en Supabase NO se pierden;
- GitHub Pages conserva la última versión válida;
- `/admin` debe mostrar el fallo y permitir reintentar.

---

# 4. Estructura del repositorio

Usar una estructura equivalente a:

```text
portfolio/
│
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── quality.yml
│
├── public/
│
├── src/
│   ├── components/
│   │   ├── public/
│   │   ├── admin/
│   │   └── shared/
│   │
│   ├── layouts/
│   │   ├── PublicLayout.astro
│   │   └── AdminLayout.astro
│   │
│   ├── pages/
│   │   ├── index.astro
│   │   ├── proyectos/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── blog/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── sobre-mi.astro
│   │   ├── contacto.astro
│   │   └── admin/
│   │       ├── index.astro
│   │       ├── login.astro
│   │       ├── projects/
│   │       ├── blog/
│   │       ├── experience/
│   │       ├── technologies/
│   │       ├── impact/
│   │       ├── media/
│   │       ├── contact/
│   │       ├── messages/
│   │       ├── analytics/
│   │       ├── seo/
│   │       └── settings/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   ├── auth/
│   │   ├── analytics/
│   │   ├── markdown/
│   │   ├── github/
│   │   └── utils/
│   │
│   ├── styles/
│   └── types/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── publish-site/
│   │   ├── track-event/
│   │   ├── contact-submit/
│   │   └── build-status/
│   └── seed.sql
│
├── astro.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

---

# 5. Rutas públicas

```text
/
/proyectos
/proyectos/[slug]
/blog
/blog/[slug]
/sobre-mi
/contacto
```

## 5.1 Rutas administrativas

Debido a GitHub Pages, evitar rutas administrativas dinámicas dependientes del servidor.

Usar:

```text
/admin
/admin/login
/admin/projects
/admin/projects/new
/admin/projects/edit/?id=UUID
/admin/blog
/admin/blog/new
/admin/blog/edit/?id=UUID
/admin/experience
/admin/technologies
/admin/impact
/admin/media
/admin/contact
/admin/messages
/admin/analytics
/admin/seo
/admin/settings
```

---

# 6. Home público

La página inicial debe ser completa y estructurarse así:

```text
1. Hero
2. Proyectos destacados
3. Sobre mí
4. Áreas de especialidad
5. Stack tecnológico
6. Experiencia / trayectoria
7. Impacto
8. Blog / Insights
9. Contacto
10. Footer
```

## 6.1 Hero

Debe combinar:

- isotipo `AL`;
- nombre Alonso Larenas;
- claim profesional;
- propuesta de valor;
- CTA principal a proyectos;
- CTA secundario a contacto;
- visual tecnológico dinámico;
- terminal premium;
- nodos relacionados con automatización, desarrollo, datos e IA.

### Mensaje conceptual

```text
Alonso Larenas

Tecnología aplicada
a problemas reales.

Automatización · Desarrollo · IA · Datos

[ Explorar proyectos ] [ Contactarme ]
```

El visual del Hero NO debe contener código ficticio absurdo.

Ejemplo de terminal:

```text
> profile.initialize

automation      ready
development     ready
data            ready
ai              ready

status          ONLINE_
```

## 6.2 Proyectos destacados

Mostrar 3–6 proyectos destacados.

Cada tarjeta debe incluir:

- imagen;
- título;
- resumen;
- tecnologías;
- problema o impacto breve;
- CTA “Ver caso”.

## 6.3 Sobre mí

Texto editorial breve, orientado a propuesta profesional.

Usar el concepto:

```text
Construyo soluciones digitales
para simplificar procesos complejos.
```

## 6.4 Áreas de especialidad

Administrables desde el CMS.

Base inicial:

- Automatización
- Desarrollo web
- Inteligencia Artificial aplicada
- Datos
- Digitalización
- Optimización de procesos

## 6.5 Stack

Agrupar por categorías.

Evitar barras de porcentaje tipo “PHP 90%”.

Ejemplo:

```text
Desarrollo
Laravel · PHP · TypeScript · Astro · Tailwind

Datos
PostgreSQL · MySQL · SQL · Excel

Automatización
Python · APIs · Webhooks · GitHub Actions
```

## 6.6 Experiencia

Timeline interactivo.

En desktop: horizontal/vertical editorial según layout final.

En mobile: vertical.

Cada experiencia puede relacionarse con proyectos y tecnologías.

## 6.7 Impacto

Indicadores globales administrables.

Ejemplo:

```text
+15 proyectos
+3.000 procesos / mes
-70% tiempo de procesamiento
```

No hardcodear cifras.

## 6.8 Blog

Mostrar últimas publicaciones y artículos destacados.

## 6.9 Contacto

CTA grande tipo Liquid Glass.

Mostrar:

- WhatsApp;
- correo;
- GitHub;
- LinkedIn;
- CV.

---

# 7. Página individual de proyecto

Ruta:

```text
/proyectos/[slug]
```

Cada proyecto debe funcionar como **caso de estudio profesional**.

## 7.1 Secciones

```text
1. Hero del proyecto
2. Resumen ejecutivo
3. Problema
4. Objetivo
5. Solución
6. Arquitectura / flujo
7. Funcionalidades principales
8. Tecnologías
9. Galería
10. Resultados e impacto
11. Desafíos / aprendizajes
12. Enlaces
13. Proyecto siguiente
```

Todas las secciones deben ser opcionales.

Un proyecto pequeño puede usar solo:

```text
Hero
Resumen
Solución
Tecnologías
Galería
```

## 7.2 Hero de proyecto

Mostrar:

- título;
- subtítulo;
- estado;
- año;
- tecnologías;
- enlaces disponibles;
- captura principal.

## 7.3 Resultados

Permitir indicadores tipo:

```text
+3.000 documentos
-70% tiempo
+100 usuarios
24/7 trazabilidad
```

## 7.4 Antes / después

Permitir opcionalmente una sección comparativa:

```text
ANTES
Proceso manual
Seguimiento por correo
Sistemas separados

↓

DESPUÉS
Proceso centralizado
Trazabilidad
Alertas automáticas
```

---

# 8. Blog / Insights

## 8.1 Portada

Ruta:

```text
/blog
```

Estructura:

```text
Hero editorial
Artículo destacado
Categorías
Últimas publicaciones
Artículos técnicos
Más leídos
```

## 8.2 Categorías iniciales

- Automatización
- Desarrollo
- Inteligencia Artificial
- Datos
- Transformación Digital
- Arquitectura
- Productividad
- Experiencias
- Build Notes

Administrables desde el CMS.

## 8.3 Artículo individual

Ruta:

```text
/blog/[slug]
```

Estructura:

```text
Categoría
Título
Bajada
Fecha
Tiempo de lectura
Imagen principal
Contenido
Tabla de contenidos
Recursos / código / imágenes
Tags
Compartir
Artículos relacionados
```

## 8.4 Markdown

El contenido fuente debe almacenarse como **Markdown**, no como HTML.

Durante el build:

```text
Markdown
   ↓
parse
   ↓
sanitize
   ↓
HTML
```

## 8.5 Código técnico

Los bloques de código deben soportar:

- syntax highlighting;
- botón copiar;
- lenguaje;
- filename opcional;
- números de línea opcionales.

---

# 9. Sobre mí

Ruta:

```text
/sobre-mi
```

Estructura:

```text
Hero personal
Perfil profesional
Cómo trabajo
Experiencia
Áreas de especialización
Stack
Principios de trabajo
CTA proyectos
Contacto
```

## 9.1 Principios de trabajo iniciales

```text
1. Resolver primero el problema.
2. Automatizar lo repetitivo.
3. Diseñar para quien lo utiliza.
4. Medir el resultado.
```

Administrables desde el CMS.

---

# 10. Contacto

Ruta:

```text
/contacto
```

## 10.1 Acciones principales

- WhatsApp
- Correo
- GitHub
- LinkedIn
- Descargar CV

## 10.2 WhatsApp

Debe permitir configurar:

- número;
- mensaje inicial;
- visibilidad;
- texto CTA.

Registrar evento `whatsapp_click`.

## 10.3 Correo

Permitir:

- abrir cliente de correo;
- copiar correo;
- feedback visual “Correo copiado”.

Eventos:

```text
email_click
email_copy
```

## 10.4 Formulario

El Home NO necesita formulario.

La página `/contacto` sí puede tenerlo.

Campos:

```text
Nombre
Correo
Asunto
Mensaje
```

Envío mediante Edge Function.

Protección:

- honeypot;
- validación server-side;
- sanitización;
- rate limiting;
- tiempo mínimo de llenado.

Opcionalmente integrar Turnstile si se vuelve necesario.

---

# 11. Footer

Diseño limpio y tecnológico.

Debe incluir:

- AL;
- Alonso Larenas;
- claim;
- navegación;
- GitHub;
- LinkedIn;
- WhatsApp;
- Email;
- copyright;
- stack de implementación de forma discreta.

Detalle visual opcional:

```text
SYSTEM STATUS   ● ONLINE
CHILE · UTC-4
```

---

# 12. CMS `/admin`

El panel administrativo debe mantener la identidad visual del sitio, pero con menos efectos y mayor densidad informativa.

## 12.1 Navegación

```text
Overview
├── Dashboard
└── Analítica

Content
├── Proyectos
├── Blog
├── Experiencia
├── Tecnologías
└── Impacto

Media
└── Multimedia

Communication
├── Contacto
└── Mensajes

System
├── SEO
└── Configuración
```

## 12.2 Login

Ruta:

```text
/admin/login
```

- Supabase Auth;
- correo + contraseña;
- sin registro público;
- recuperación de contraseña permitida;
- una sola cuenta owner en V1.

## 12.3 Dashboard

Mostrar:

- visitas últimos 30 días;
- contactos;
- proyectos publicados;
- artículo más leído;
- proyecto más visto;
- origen principal;
- dispositivo predominante;
- estado del sitio;
- último build;
- accesos rápidos.

Acciones rápidas:

```text
+ Nuevo proyecto
+ Nuevo artículo
+ Subir imagen
```

## 12.4 Estado del sitio

Mostrar:

```text
GitHub Pages      Online / Error
Supabase          Connected / Error
Último build      Success / Failed
Última publicación
```

Acción:

```text
[ Reconstruir sitio ]
```

## 12.5 Proyectos

Ruta:

```text
/admin/projects
```

Filtros:

- todos;
- publicados;
- borradores;
- destacados;
- archivados.

Editor con pestañas:

```text
General
Contenido
Funcionalidades
Tecnologías
Galería
Impacto
SEO
```

## 12.6 Blog

Ruta:

```text
/admin/blog
```

Editor Markdown con modos:

```text
Editar
Split
Preview
```

Barra mínima:

```text
H1
H2
Bold
Link
Image
Code
Quote
```

## 12.7 Autoguardado

Mostrar estados:

```text
Guardando...
✓ Guardado
```

## 12.8 Experiencia

Gestionar:

- cargo;
- organización;
- fechas;
- descripción;
- hitos;
- proyectos relacionados;
- tecnologías;
- visibilidad;
- orden.

## 12.9 Tecnologías

Gestionar:

- nombre;
- slug;
- icono;
- categoría;
- descripción;
- URL oficial;
- destacada;
- visible;
- orden.

## 12.10 Impacto

Gestionar indicadores globales del Home.

## 12.11 Multimedia

Asset manager con:

- grid;
- filtros;
- búsqueda;
- subir;
- reemplazar;
- eliminar;
- copiar URL;
- editar alt;
- caption;
- revisar uso del archivo.

## 12.12 Contacto

Gestionar:

- email;
- WhatsApp;
- mensaje WhatsApp;
- GitHub;
- LinkedIn;
- CTA;
- disponibilidad;
- formulario activo;
- CV activo;
- visibilidad por canal.

## 12.13 Mensajes

Estados:

```text
new
read
replied
archived
```

No convertirlo en CRM.

## 12.14 Analítica

Filtros:

- 7 días;
- 30 días;
- 90 días;
- 12 meses;
- personalizado.

KPIs:

- visitas;
- visitantes;
- vistas de proyectos;
- vistas de artículos;
- contactos;
- CV descargados.

Gráficos:

- visitas por día;
- páginas más vistas;
- proyectos más vistos;
- artículos más vistos;
- origen del tráfico;
- dispositivo;
- conversiones.

## 12.15 SEO

Configuración global:

- título;
- descripción;
- OG image;
- canonical base;
- robots.

Debe soportar:

- sitemap;
- RSS;
- Open Graph;
- Twitter/X Cards;
- Schema.org.

---

# 13. Modelo de datos Supabase/PostgreSQL

## 13.1 Identidad

```text
auth.users
```

```text
admin_profiles
────────────────────────
id uuid PK → auth.users.id
display_name
avatar_url
role
active
created_at
updated_at
```

V1:

```text
role = owner
```

## 13.2 Configuración general

```text
site_settings
────────────────────────
id
site_name
brand_short
professional_title
hero_title
hero_subtitle
hero_description
availability_enabled
availability_text
location_public
cv_url
default_seo_title
default_seo_description
default_og_image
created_at
updated_at
```

## 13.3 Redes

```text
social_links
────────────────────────
id
platform
label
url
icon
sort_order
visible
created_at
updated_at
```

## 13.4 Contacto

```text
contact_settings
────────────────────────
id
email
whatsapp_number
whatsapp_default_message
cta_title
cta_description
form_enabled
cv_enabled
created_at
updated_at
```

## 13.5 Proyectos

```text
projects
────────────────────────────────────
id uuid PK
title
slug UNIQUE
subtitle
summary
problem
objective
solution
architecture
challenges
learnings
role
year
status
featured_image_url
cover_image_url
github_url
demo_url
documentation_url
featured boolean
published boolean
seo_title
seo_description
og_image_url
published_at
created_at
updated_at
```

Estados de proyecto:

```text
concept
development
production
completed
archived
```

## 13.6 Funcionalidades

```text
project_features
────────────────────────
id
project_id FK
title
description
icon
sort_order
created_at
updated_at
```

## 13.7 Galería

```text
project_images
────────────────────────
id
project_id FK
storage_path
public_url
alt_text
caption
sort_order
featured
created_at
updated_at
```

## 13.8 Métricas por proyecto

```text
project_metrics
────────────────────────
id
project_id FK
value
label
description
sort_order
visible
```

`value` debe ser texto para soportar `+100`, `24/7`, `-70%`, etc.

## 13.9 Desafíos

```text
project_challenges
────────────────────────
id
project_id FK
title
problem
solution
sort_order
```

## 13.10 Tecnologías

```text
technologies
────────────────────────
id
name
slug UNIQUE
category
description
icon
official_url
featured
visible
sort_order
created_at
updated_at
```

```text
project_technologies
────────────────────────
project_id
technology_id
sort_order
```

## 13.11 Blog

```text
posts
──────────────────────────────────
id uuid PK
title
slug UNIQUE
excerpt
content_markdown
featured_image_url
status
featured
reading_time
seo_title
seo_description
og_image_url
published_at
created_at
updated_at
```

Estados:

```text
draft
published
archived
```

## 13.12 Categorías

```text
post_categories
────────────────────────
id
name
slug UNIQUE
description
sort_order
visible
```

```text
post_category_relations
────────────────────────
post_id
category_id
```

## 13.13 Tags

```text
tags
────────────────────────
id
name
slug UNIQUE
```

```text
post_tags
────────────────────────
post_id
tag_id
```

## 13.14 Experiencia

```text
experiences
────────────────────────
id
position
organization
organization_url
start_date
end_date
current
summary
description_markdown
visible
sort_order
created_at
updated_at
```

```text
experience_highlights
────────────────────────
id
experience_id
title
description
sort_order
```

```text
experience_projects
────────────────────────
experience_id
project_id
```

```text
experience_technologies
────────────────────────
experience_id
technology_id
```

## 13.15 Especialidades

```text
specialties
────────────────────────
id
title
slug
description
icon
sort_order
visible
```

## 13.16 Principios

```text
work_principles
────────────────────────
id
number
title
description
sort_order
visible
```

## 13.17 Impacto global

```text
impact_metrics
────────────────────────
id
value
label
description
sort_order
visible
```

## 13.18 Multimedia

```text
media_assets
────────────────────────
id
storage_bucket
storage_path
public_url
filename
mime_type
file_size
width
height
alt_text
caption
category
created_by
created_at
updated_at
```

Categorías:

```text
project
blog
profile
document
general
```

## 13.19 Documentos

```text
documents
────────────────────────
id
type
title
storage_path
public_url
active
created_at
updated_at
```

Ejemplo:

```text
type = cv
```

## 13.20 Contactos recibidos

```text
contact_messages
────────────────────────
id
name
email
subject
message
status
user_agent_summary
created_at
updated_at
```

## 13.21 Analítica

```text
analytics_events
────────────────────────
id
session_hash
event_type
pathname
referrer_domain
project_id nullable
post_id nullable
device_type
browser_family
created_at
```

Eventos principales:

```text
page_view
project_view
post_view
whatsapp_click
email_click
email_copy
github_click
linkedin_click
demo_click
cv_download
contact_submit
article_share
```

## 13.22 Agregados

```text
analytics_daily
────────────────────────
date
page_views
unique_sessions
project_views
post_views
whatsapp_clicks
email_clicks
cv_downloads
contact_submits
```

```text
analytics_daily_content
────────────────────────
date
content_type
content_id
views
unique_sessions
```

## 13.23 Actividad administrativa

```text
admin_activity
────────────────────────
id
admin_id
action
entity_type
entity_id
metadata
created_at
```

## 13.24 Builds

```text
site_builds
────────────────────────
id
trigger_type
entity_type
entity_id
github_run_id
github_run_url
status
commit_sha
started_at
completed_at
created_at
```

Estados:

```text
queued
building
success
failed
```

---

# 14. Seguridad y RLS

## 14.1 Principio

**El navegador nunca recibe privilegios administrativos reales.**

## 14.2 Claves

### Navegador / GitHub Pages

Permitido:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

No permitido:

```text
SUPABASE_SECRET_KEY
service_role
GITHUB_TOKEN
EMAIL_SECRET
BUILD_CALLBACK_SECRET
```

## 14.3 Administrador

Crear función equivalente a:

```text
private.is_portfolio_admin()
```

Debe verificar:

```text
auth.uid()
    ↓
admin_profiles
    ↓
active = true
role = owner
```

Si se usa `SECURITY DEFINER`:

- fijar `search_path` explícito;
- usar nombres de esquema completos;
- mantener función en esquema privado.

## 14.4 Público

Permitir solo lectura de contenido público.

Ejemplos conceptuales:

```text
projects
SELECT WHERE published = true
```

```text
posts
SELECT WHERE status = 'published'
AND published_at <= now()
```

```text
technologies
SELECT WHERE visible = true
```

## 14.5 Privado

Sin lectura pública:

- admin_activity;
- contact_messages;
- site_builds;
- analytics_events;
- analytics_daily;
- admin_profiles.

## 14.6 Escritura pública

NO permitir escritura directa anónima a:

- analytics_events;
- contact_messages.

Usar Edge Functions.

---

# 15. Supabase Storage

Buckets propuestos:

```text
portfolio-public
blog
documents
private
```

Estructura:

```text
portfolio-public/
├── projects/
├── technologies/
└── profile/

blog/
└── posts/

documents/
└── cv/

private/
└── temporary/
```

Lectura pública solo donde sea necesario.

Escritura, reemplazo y borrado restringidos al owner.

---

# 16. Edge Functions

Crear solo las necesarias en V1.

## 16.1 `publish-site`

Responsabilidades:

- recibir JWT;
- validar owner;
- crear registro en `site_builds`;
- disparar `repository_dispatch` en GitHub;
- devolver `build_id`.

## 16.2 `track-event`

Responsabilidades:

- recibir solo eventos permitidos;
- validar payload;
- limitar tamaño;
- rate limiting;
- generar `session_hash`;
- guardar `analytics_events`.

## 16.3 `contact-submit`

Responsabilidades:

- honeypot;
- validación;
- sanitización;
- rate limiting;
- guardar mensaje;
- enviar notificación por correo si hay proveedor configurado.

Si falla el correo, el mensaje debe permanecer guardado.

## 16.4 `build-status`

Responsabilidades:

- recibir callbacks de GitHub Actions;
- validar secreto;
- actualizar `site_builds`;
- registrar:
  - building;
  - success;
  - failed;
  - run id;
  - run url;
  - commit sha.

---

# 17. Analítica propia

## 17.1 Privacidad

NO almacenar:

- nombre;
- email;
- IP completa;
- fingerprint invasivo;
- historial personal.

## 17.2 Sesión anónima

Generar UUID aleatorio local en navegador.

La Edge Function debe convertirlo a:

```text
HMAC/SHA-256(session + server secret)
```

Guardar solo `session_hash`.

## 17.3 Objetivo

Medir:

- visitantes aproximados;
- visitas;
- vistas de proyectos;
- vistas de artículos;
- clics de contacto;
- clics externos;
- descargas de CV;
- conversiones.

---

# 18. GitHub Actions

## 18.1 Triggers

El workflow de deploy debe responder a:

```text
push a main
repository_dispatch: portfolio_publish
workflow_dispatch
```

## 18.2 Jobs

```text
BUILD
  ↓
DEPLOY
```

### BUILD

- checkout;
- instalar Node;
- `npm ci`;
- typecheck/lint;
- tests esenciales;
- `astro build`;
- subir artifact de Pages.

### DEPLOY

Permisos mínimos:

```text
contents: read
pages: write
id-token: write
```

Usar environment `github-pages`.

## 18.3 Concurrencia

Usar grupo:

```text
portfolio-production
```

Permitir cancelar builds previos si llega uno más reciente.

## 18.4 Estado del build

Llamar `build-status` al iniciar y finalizar.

---

# 19. Design System

## 19.1 Dirección visual

**Tech Premium + Liquid Glass selectivo + Dark UI + acentos eléctricos.**

Regla:

> El contenido manda. El glass, glow y animaciones refuerzan jerarquía y profundidad, no reemplazan el contenido.

## 19.2 Paleta base

```text
Midnight 950    #050816
Midnight 900    #080C1A
Midnight 850    #0B1020
Midnight 800    #10172A
```

## 19.3 Superficies

```text
Glass subtle   rgba(255,255,255,0.035)
Glass normal   rgba(255,255,255,0.055)
Glass strong   rgba(255,255,255,0.085)
Border         rgba(255,255,255,0.10)
Border hover   rgba(255,255,255,0.18)
```

## 19.4 Texto

```text
Primary        #F8FAFC
Secondary      #CBD5E1
Muted          #94A3B8
Subtle         #64748B
```

## 19.5 Acentos

```text
Electric Cyan      #22D3EE
Electric Blue      #3B82F6
Electric Violet    #8B5CF6
Electric Magenta   #D946EF
```

### Gradiente de marca

```css
linear-gradient(
  135deg,
  #22D3EE 0%,
  #3B82F6 42%,
  #8B5CF6 72%,
  #D946EF 100%
)
```

Usarlo solo en:

- isotipo;
- palabras destacadas;
- botones seleccionados;
- bordes;
- glows;
- elementos gráficos.

NO como fondo general permanente.

## 19.6 Tipografías

- UI / texto: **Manrope Variable**
- Display: **Space Grotesk Variable**
- Código: **JetBrains Mono**

Optimizar carga y evitar múltiples pesos innecesarios.

## 19.7 Escala tipográfica

Hero:

```css
font-size: clamp(3.4rem, 7vw, 7.2rem);
```

H1:

```css
clamp(2.8rem, 5vw, 5.5rem)
```

H2:

```css
clamp(2rem, 3.6vw, 3.8rem)
```

H3:

```css
clamp(1.4rem, 2vw, 2rem)
```

Blog:

```text
18px
line-height 1.75
```

## 19.8 Espaciado

Base:

```text
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80 / 96 / 128 / 160
```

Secciones:

```text
Desktop 120–160px
Tablet 96px
Mobile 72px
```

## 19.9 Contenedores

```text
Máximo general: 1440px
Contenido normal: 1280px
Editorial: 720–780px
```

Padding lateral:

```text
Desktop 48px
Tablet 32px
Mobile 20px
```

## 19.10 Radios

```text
Small   12px
Medium  18px
Large   24px
XL      32px
Hero    40px
Pill    9999px
```

## 19.11 Liquid Glass

Estándar conceptual:

```css
background: rgba(255,255,255,0.05);
border: 1px solid rgba(255,255,255,0.10);
backdrop-filter: blur(24px);
box-shadow: 0 24px 80px rgba(0,0,0,0.25);
```

Niveles:

- Glass 1: navbar / badges;
- Glass 2: tarjetas / CTA;
- Glass 3: Hero / contacto / destacados.

## 19.12 Glow

```text
blur: 80–160px
opacity: 0.10–0.24
```

Debe sentirse como iluminación ambiental, no neón duro.

## 19.13 Fondo global

Construir con CSS:

- Midnight base;
- radial glow cyan;
- radial glow violet;
- grid técnico muy tenue;
- noise ligero.

No usar imagen fija de fondo.

---

# 20. Animaciones

## 20.1 Principios

Usar animaciones premium, suaves y discretas.

Preferir:

- fade-up;
- fade-in;
- scale-soft;
- stagger;
- micro-parallax;
- spotlight;
- hover glow;
- arrow movement.

Evitar:

- bounce;
- spin;
- flip;
- rotaciones exageradas;
- animaciones eternas;
- cursores personalizados invasivos.

## 20.2 Timing

```text
micro       150ms
normal      250ms
premium     400ms
section     600ms
```

Curva:

```text
cubic-bezier(0.22, 1, 0.36, 1)
```

## 20.3 Hero

Secuencia aproximada:

```text
0ms     AL
100ms   eyebrow
200ms   nombre
300ms   headline
450ms   descripción
600ms   CTAs
700ms   terminal/nodos
```

Total visual:

```text
900–1200ms
```

El sitio debe ser usable inmediatamente.

## 20.4 Tilt

Solo donde aporte.

Máximo:

```text
rotateX ±2deg
rotateY ±3deg
```

## 20.5 Cursor spotlight

Solo en desktop y tarjetas seleccionadas.

Usar `requestAnimationFrame`.

No producir layout thrashing.

## 20.6 Reduced Motion

Obligatorio:

```css
@media (prefers-reduced-motion: reduce)
```

Desactivar:

- tilt;
- parallax;
- seguimiento de cursor;
- animaciones decorativas;
- reveal no esencial.

---

# 21. Navbar

Desktop:

```text
AL   Proyectos   Blog   Sobre mí   Contacto
```

Inicialmente transparente.

Al hacer scroll:

- más compacta;
- floating glass;
- blur;
- transición 300–400ms.

Mobile:

- botón hamburguesa;
- menú overlay fullscreen glass;
- navegación grande;
- redes al final;
- cierre accesible.

---

# 22. Botones

Variantes:

1. Primary
2. Secondary glass
3. Ghost

Hover:

```text
translateY(-2px)
+ border highlight
+ background intensity
+ arrow movement
```

Active:

```text
scale(.98)
```

Focus:

`focus-visible` claramente perceptible.

---

# 23. Responsive

Mobile-first.

Breakpoints conceptuales:

```text
0–639       Mobile
640–767     Large Mobile
768–1023    Tablet
1024–1279   Desktop
1280–1535   Large Desktop
1536+       XL
```

No diseñar solo para 1920x1080.

La versión móvil debe ser una experiencia propia, no desktop comprimido.

Reducir efectos dependientes de mouse.

---

# 24. Accesibilidad

Objetivo mínimo: **WCAG AA**.

Requisitos:

- landmarks;
- headings semánticos;
- navegación teclado;
- `focus-visible`;
- contraste suficiente;
- labels;
- `alt` obligatorio en CMS;
- atributos ARIA solo donde sean necesarios;
- targets táctiles mínimo 44px;
- reduced motion;
- feedback no dependiente solo de color.

---

# 25. Performance

Objetivos:

```text
LCP < 2.5s
CLS < 0.1
INP < 200ms
```

Estrategias:

- SSG Astro;
- JavaScript solo donde aporte;
- lazy loading;
- dimensiones explícitas en imágenes;
- AVIF/WebP cuando sea posible;
- SVG para iconos;
- fuentes optimizadas;
- evitar librerías pesadas;
- usar CSS + Web Animations API + IntersectionObserver antes de añadir dependencias.

No añadir GSAP de entrada.

No convertir toda la aplicación a React solo por animaciones.

---

# 26. Iconografía

Usar **Lucide** como base.

Para logos tecnológicos usar SVG propios o fuentes oficiales cuando corresponda.

Mantener consistencia de stroke y tamaño.

---

# 27. SEO

## 27.1 Global

Generar:

- `<title>`;
- meta description;
- canonical;
- Open Graph;
- Twitter/X Cards;
- sitemap;
- RSS;
- Schema.org.

## 27.2 Por proyecto/artículo

Permitir:

```text
seo_title
seo_description
og_image
canonical opcional
robots opcional
```

---

# 28. Slugs

Reglas:

- lowercase;
- ASCII seguro;
- únicos;
- generados automáticamente;
- editables;
- advertir al cambiar un slug ya publicado.

---

# 29. Borrado y estados

V1 no requiere soft-delete global.

Usar estados:

```text
draft
published
archived
```

Eliminar definitivamente solo mediante acción secundaria con confirmación.

Aplicar `ON DELETE CASCADE` donde corresponda para relaciones de contenido.

Los archivos de Storage requieren borrado explícito desde la aplicación.

---

# 30. Qué NO construir en V1

No implementar todavía:

- múltiples administradores;
- roles complejos;
- editor colaborativo;
- comentarios públicos;
- newsletter;
- CRM;
- programación de publicaciones;
- workflow editorial;
- pagos;
- comercio;
- chat;
- notificaciones internas complejas.

YAGNI.

---

# 31. Criterios de aceptación funcionales

La implementación se considera válida cuando:

## Público

- Home completo funciona en desktop, tablet y mobile.
- Proyectos se generan desde Supabase.
- Proyectos individuales se generan como HTML estático.
- Blog se genera desde Supabase.
- Artículos individuales son indexables.
- Contacto funciona.
- WhatsApp y email funcionan.
- CV puede descargarse.
- SEO por página está presente.
- sitemap y RSS funcionan.

## Admin

- Login Supabase funciona.
- Usuario no autorizado no puede administrar.
- CRUD de proyectos funciona.
- CRUD de blog funciona.
- Tecnologías, experiencia e impacto son administrables.
- Multimedia se puede cargar y gestionar.
- Configuración general se puede editar.
- Analítica se visualiza.
- Mensajes de contacto se visualizan.
- Publicar dispara rebuild.
- Rebuild manual funciona.
- Build fallido no destruye publicación anterior.

## Seguridad

- RLS activo en tablas expuestas.
- Ningún secreto administrativo aparece en frontend.
- visitantes anónimos no pueden escribir directamente en tablas sensibles.
- Edge Functions validan payloads.
- Storage write restringido al owner.

## UX

- navegación teclado funcional;
- mobile usable;
- reduced-motion respetado;
- feedback de guardado/publicación claro;
- skeletons y toasts funcionan;
- errores visibles y recuperables.

---

# 32. Criterios visuales de aceptación

La implementación NO debe parecer:

- dashboard administrativo genérico;
- template Tailwind sin personalización;
- portfolio cyberpunk saturado;
- página llena de glow/neón;
- colección de tarjetas flotantes sin jerarquía.

Debe transmitir:

- tecnología;
- claridad;
- profundidad;
- diseño premium;
- profesionalismo;
- alto contraste;
- movimiento controlado;
- excelente responsive.

---

# 33. Orden sugerido de implementación

## Fase 1 — Foundation

- Astro
- Tailwind
- TypeScript
- estructura de proyecto
- tokens visuales
- tipografías
- layouts
- Supabase client
- variables de entorno

## Fase 2 — Base de datos y seguridad

- migraciones
- RLS
- `admin_profiles`
- función `is_portfolio_admin()`
- Storage policies
- seed inicial

## Fase 3 — Público base

- navbar
- footer
- Home
- Sobre mí
- Contacto
- responsive

## Fase 4 — Proyectos

- listado
- página individual
- tecnologías
- galería
- métricas
- relaciones

## Fase 5 — Blog

- listado
- categorías
- tags
- Markdown
- artículo
- syntax highlighting
- TOC
- RSS

## Fase 6 — Admin

- login
- layout
- dashboard
- proyectos
- blog
- experiencia
- tecnologías
- impacto
- multimedia
- contacto
- SEO
- settings

## Fase 7 — Edge Functions

- publish-site
- track-event
- contact-submit
- build-status

## Fase 8 — GitHub Actions / Pages

- quality workflow
- deploy workflow
- repository_dispatch
- workflow_dispatch
- concurrency
- callback de build

## Fase 9 — Analítica

- tracking
- agregados
- dashboard
- conversiones

## Fase 10 — QA y pulido

- accesibilidad
- performance
- SEO
- mobile
- reduced motion
- Lighthouse
- Core Web Vitals
- revisión visual final

---

# 34. Reglas para Codex durante la implementación

1. No cambiar la arquitectura C2 sin justificarlo.
2. No introducir Laravel, PHP o servidor tradicional.
3. No usar una SPA completa si Astro SSG resuelve el caso.
4. No usar React globalmente sin necesidad.
5. No exponer secretos en frontend.
6. Mantener RLS desde el inicio.
7. Mantener componentes pequeños y con responsabilidad clara.
8. No concentrar toda la lógica en archivos gigantes.
9. Mantener TypeScript estricto.
10. Evitar dependencias innecesarias.
11. Priorizar Web Platform APIs antes de librerías pesadas.
12. Mantener accesibilidad WCAG AA.
13. Mantener performance como requisito, no como ajuste final.
14. El diseño visual debe seguir exactamente los tokens de este documento.
15. No inventar paletas, tipografías ni estilos fuera del sistema definido.
16. No hardcodear contenido que debe venir del CMS.
17. Todas las funcionalidades públicas deben degradar con gracia si JavaScript falla, cuando sea posible.
18. El sitio público debe ser prerenderizado siempre que sea razonable.
19. Antes de declarar una fase terminada, ejecutar lint, typecheck, tests y build.
20. Mantener README actualizado con instalación local, variables y despliegue.

---

# 35. Variables de entorno esperadas

## Frontend / Build públicas

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## Edge Functions / Supabase secrets

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
GITHUB_FINE_GRAINED_TOKEN
GITHUB_REPOSITORY_OWNER
GITHUB_REPOSITORY_NAME
ANALYTICS_HASH_SECRET
BUILD_CALLBACK_SECRET
EMAIL_PROVIDER_SECRET
```

## GitHub Actions

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
BUILD_CALLBACK_SECRET
SUPABASE_BUILD_STATUS_URL
```

Nunca commitear valores reales.

---

# 36. Entregables esperados de Codex

Codex debe entregar como mínimo:

- código fuente completo;
- migraciones Supabase;
- policies RLS;
- Edge Functions;
- workflows GitHub Actions;
- seed mínimo;
- README técnico;
- `.env.example`;
- componentes públicos;
- panel `/admin`;
- pruebas esenciales;
- documentación de despliegue;
- checklist de configuración manual pendiente en Supabase/GitHub.

---

# 37. Resultado final esperado

Un portafolio personal que se sienta como un producto digital premium, no como una página estática tradicional.

Debe combinar:

```text
Contenido real
+ diseño fuerte
+ arquitectura simple
+ administración propia
+ publicación automatizada
+ seguridad por RLS
+ performance SSG
+ analítica propia
+ excelente responsive
```

La experiencia pública debe ser expresiva y memorable.

La experiencia administrativa debe ser sobria, rápida y productiva.

---

# FIN DE ESPECIFICACIÓN

Esta especificación es la fuente principal de requisitos para la implementación. Si durante el desarrollo aparece una decisión no descrita, Codex debe elegir la alternativa que mantenga coherencia con:

1. simplicidad;
2. seguridad;
3. SSG-first;
4. mobile-first;
5. accesibilidad;
6. performance;
7. identidad Tech Premium + Liquid Glass selectivo;
8. mínima dependencia de infraestructura.
