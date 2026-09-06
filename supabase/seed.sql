-- Approved public base only. No Auth identities, private data, or demonstration achievements.
insert into public.site_settings
  (site_name, brand_short, professional_title, hero_title, hero_subtitle, about_summary_markdown)
values ('Alonso Larenas', 'AL', 'Automatización · Desarrollo · Transformación Digital',
  'Tecnología aplicada a problemas reales.', 'Automatización · Desarrollo · IA · Datos',
  'Construyo soluciones digitales para simplificar procesos complejos.')
on conflict (singleton) do nothing;

insert into public.contact_settings (singleton) values (true) on conflict (singleton) do nothing;

insert into public.post_categories (name, slug, sort_order, visible) values
  ('Automatización', 'automatizacion', 0, true),
  ('Desarrollo', 'desarrollo', 1, true),
  ('Inteligencia Artificial', 'inteligencia-artificial', 2, true),
  ('Datos', 'datos', 3, true),
  ('Transformación Digital', 'transformacion-digital', 4, true),
  ('Arquitectura', 'arquitectura', 5, true),
  ('Productividad', 'productividad', 6, true),
  ('Experiencias', 'experiencias', 7, true),
  ('Build Notes', 'build-notes', 8, true)
on conflict (slug) do nothing;

insert into public.specialties (title, slug, sort_order, visible) values
  ('Automatización', 'automatizacion', 0, true),
  ('Desarrollo web', 'desarrollo-web', 1, true),
  ('Inteligencia Artificial aplicada', 'inteligencia-artificial-aplicada', 2, true),
  ('Datos', 'datos', 3, true),
  ('Digitalización', 'digitalizacion', 4, true),
  ('Optimización de procesos', 'optimizacion-de-procesos', 5, true)
on conflict (slug) do nothing;

insert into public.work_principles (number, title, sort_order, visible) values
  (1, 'Resolver primero el problema.', 0, true),
  (2, 'Automatizar lo repetitivo.', 1, true),
  (3, 'Diseñar para quien lo utiliza.', 2, true),
  (4, 'Medir el resultado.', 3, true)
on conflict (number) do nothing;
