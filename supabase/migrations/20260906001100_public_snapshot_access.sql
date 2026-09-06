begin;
-- Single SQL statement, invoker permissions and RLS. F6 must grant access explicitly.
create or replace function public.get_public_snapshot() returns jsonb
language sql stable security invoker set search_path = ''
as $$
with
snapshot_settings as (
  select r.id,
    r.site_name,
    r.brand_short,
    r.professional_title,
    r.hero_title,
    r.hero_subtitle,
    r.hero_description,
    r.availability_enabled,
    r.availability_text,
    r.location_public,
    (select d.public_url from public.documents d join public.public_media_assets m on m.id = d.asset_id where d.active and m.visibility = 'public' and exists (select 1 from public.public_contact_settings where cv_enabled)) as cv_url,
    r.default_seo_title,
    r.default_seo_description,
    case when exists (select 1 from public.public_media_assets m where m.id = r.default_og_image_asset_id and m.visibility = 'public') then r.default_og_image end as default_og_image,
    case when exists (select 1 from public.public_media_assets m where m.id = r.default_og_image_asset_id and m.visibility = 'public') then r.default_og_image_asset_id end as default_og_image_asset_id,
    r.about_summary_markdown,
    r.about_profile_markdown,
    r.working_method_markdown,
    case when exists (select 1 from public.public_media_assets m where m.id = r.about_image_asset_id and m.visibility = 'public') then r.about_image_asset_id end as about_image_asset_id,
    r.canonical_base,
    r.robots_policy,
    r.timezone
  from public.site_settings r where true
),
snapshot_contact as (
  select r.id,
    case when r.email_visible then r.email end as email,
    case when r.whatsapp_visible then r.whatsapp_number end as whatsapp_number,
    case when r.whatsapp_visible then r.whatsapp_default_message end as whatsapp_default_message,
    r.cta_title,
    r.cta_description,
    r.form_enabled,
    r.cv_enabled,
    r.email_visible,
    r.whatsapp_visible,
    case when r.whatsapp_visible then r.whatsapp_cta_label end as whatsapp_cta_label
  from public.public_contact_settings r where true
),
snapshot_social_links as (
  select r.id,
    r.platform,
    r.label,
    r.url,
    r.icon,
    r.sort_order,
    r.visible
  from public.social_links r where r.visible
),
snapshot_projects as (
  select r.id,
    r.title,
    r.slug,
    r.subtitle,
    r.summary,
    r.problem,
    r.objective,
    r.solution,
    r.architecture,
    r.challenges,
    r.learnings,
    r.role,
    r.year,
    r.status,
    case when exists (select 1 from public.public_media_assets m where m.id = r.featured_image_asset_id and m.visibility = 'public') then r.featured_image_url end as featured_image_url,
    case when exists (select 1 from public.public_media_assets m where m.id = r.cover_image_asset_id and m.visibility = 'public') then r.cover_image_url end as cover_image_url,
    r.github_url,
    r.demo_url,
    r.documentation_url,
    r.featured,
    r.published,
    r.seo_title,
    r.seo_description,
    case when exists (select 1 from public.public_media_assets m where m.id = r.og_image_asset_id and m.visibility = 'public') then r.og_image_url end as og_image_url,
    r.published_at,
    r.canonical_url,
    r.robots_policy,
    r.before_markdown,
    r.after_markdown,
    r.sort_order,
    case when exists (select 1 from public.public_media_assets m where m.id = r.featured_image_asset_id and m.visibility = 'public') then r.featured_image_asset_id end as featured_image_asset_id,
    case when exists (select 1 from public.public_media_assets m where m.id = r.cover_image_asset_id and m.visibility = 'public') then r.cover_image_asset_id end as cover_image_asset_id,
    case when exists (select 1 from public.public_media_assets m where m.id = r.og_image_asset_id and m.visibility = 'public') then r.og_image_asset_id end as og_image_asset_id
  from public.projects r where r.published and r.status <> 'archived' and r.published_at <= statement_timestamp()
),
snapshot_posts as (
  select r.id,
    r.title,
    r.slug,
    r.excerpt,
    r.content_markdown,
    case when exists (select 1 from public.public_media_assets m where m.id = r.featured_image_asset_id and m.visibility = 'public') then r.featured_image_url end as featured_image_url,
    r.status,
    r.featured,
    r.reading_time,
    r.seo_title,
    r.seo_description,
    case when exists (select 1 from public.public_media_assets m where m.id = r.og_image_asset_id and m.visibility = 'public') then r.og_image_url end as og_image_url,
    r.published_at,
    r.canonical_url,
    r.robots_policy,
    r.popular_rank,
    case when exists (select 1 from public.public_media_assets m where m.id = r.featured_image_asset_id and m.visibility = 'public') then r.featured_image_asset_id end as featured_image_asset_id,
    case when exists (select 1 from public.public_media_assets m where m.id = r.og_image_asset_id and m.visibility = 'public') then r.og_image_asset_id end as og_image_asset_id
  from public.posts r where r.status = 'published' and r.published_at <= statement_timestamp()
),
snapshot_categories as (
  select r.id,
    r.name,
    r.slug,
    r.description,
    r.sort_order,
    r.visible
  from public.post_categories r where r.visible
),
snapshot_technologies as (
  select r.id,
    r.name,
    r.slug,
    r.category,
    r.description,
    r.icon,
    r.official_url,
    r.featured,
    r.visible,
    r.sort_order
  from public.technologies r where r.visible
),
snapshot_experiences as (
  select r.id,
    r.position,
    r.organization,
    r.organization_url,
    r.start_date,
    r.end_date,
    r.current,
    r.summary,
    r.description_markdown,
    r.visible,
    r.sort_order
  from public.experiences r where r.visible
),
snapshot_specialties as (
  select r.id,
    r.title,
    r.slug,
    r.description,
    r.icon,
    r.sort_order,
    r.visible
  from public.specialties r where r.visible
),
snapshot_principles as (
  select r.id,
    r.number,
    r.title,
    r.description,
    r.sort_order,
    r.visible
  from public.work_principles r where r.visible
),
snapshot_impact_metrics as (
  select r.id,
    r.value,
    r.label,
    r.description,
    r.sort_order,
    r.visible
  from public.impact_metrics r where r.visible
),
snapshot_project_features as (
  select r.id,
    r.project_id,
    r.title,
    r.description,
    r.icon,
    r.sort_order
  from public.project_features r where r.project_id in (select id from snapshot_projects)
),
snapshot_project_images as (
  select r.id,
    r.project_id,
    r.asset_id,
    r.public_url,
    r.alt_text,
    r.caption,
    r.sort_order,
    r.featured
  from public.project_images r where r.project_id in (select id from snapshot_projects) and r.asset_id in (select id from public.public_media_assets where visibility = 'public')
),
snapshot_project_metrics as (
  select r.id,
    r.project_id,
    r.value,
    r.label,
    r.description,
    r.sort_order,
    r.visible
  from public.project_metrics r where r.visible and r.project_id in (select id from snapshot_projects)
),
snapshot_project_challenges as (
  select r.id,
    r.project_id,
    r.title,
    r.problem,
    r.solution,
    r.sort_order
  from public.project_challenges r where r.project_id in (select id from snapshot_projects)
),
snapshot_project_technologies as (
  select r.project_id,
    r.technology_id,
    r.sort_order
  from public.project_technologies r where r.project_id in (select id from snapshot_projects) and r.technology_id in (select id from snapshot_technologies)
),
snapshot_post_category_relations as (
  select r.post_id,
    r.category_id
  from public.post_category_relations r where r.post_id in (select id from snapshot_posts) and r.category_id in (select id from snapshot_categories)
),
snapshot_tags as (
  select r.id,
    r.name,
    r.slug
  from public.tags r where r.id in (select pt.tag_id from public.post_tags pt join snapshot_posts p on p.id = pt.post_id)
),
snapshot_post_tags as (
  select r.post_id,
    r.tag_id
  from public.post_tags r where r.post_id in (select id from snapshot_posts)
),
snapshot_experience_highlights as (
  select r.id,
    r.experience_id,
    r.title,
    r.description,
    r.sort_order
  from public.experience_highlights r where r.experience_id in (select id from snapshot_experiences)
),
snapshot_experience_projects as (
  select r.experience_id,
    r.project_id
  from public.experience_projects r where r.experience_id in (select id from snapshot_experiences) and r.project_id in (select id from snapshot_projects)
),
snapshot_experience_technologies as (
  select r.experience_id,
    r.technology_id
  from public.experience_technologies r where r.experience_id in (select id from snapshot_experiences) and r.technology_id in (select id from snapshot_technologies)
),
snapshot_documents as (
  select r.id,
    r.type,
    r.title,
    r.asset_id,
    r.public_url,
    r.active
  from public.documents r where r.active and exists (select 1 from public.public_contact_settings where cv_enabled) and r.asset_id in (select id from public.public_media_assets where visibility = 'public')
),
snapshot_media_references as (
  select r.asset_id,
    r.entity_type,
    r.entity_id,
    r.field
  from public.media_references r where r.asset_id in (select id from public.public_media_assets where visibility = 'public') and (
  r.project_id in (select id from snapshot_projects) or
  r.post_id in (select id from snapshot_posts) or
  r.settings_id in (select id from snapshot_settings) or
  r.project_image_id in (select id from snapshot_project_images) or
  r.document_id in (select id from snapshot_documents))
),
snapshot_media_assets as (
  select r.id,
    r.public_url,
    r.filename,
    r.mime_type,
    r.file_size,
    r.width,
    r.height,
    r.alt_text,
    r.caption,
    r.category,
    r.visibility
  from public.public_media_assets r where r.visibility = 'public' and r.id in (select asset_id from snapshot_media_references)
)
select jsonb_build_object(
  'schema_version', 1,
  'generated_at', statement_timestamp(),
  'settings', (select to_jsonb(v) from snapshot_settings v),
  'contact', (select to_jsonb(v) from snapshot_contact v),
  'social_links', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_social_links v), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_projects v), '[]'::jsonb),
  'project_features', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_project_features v), '[]'::jsonb),
  'project_images', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_project_images v), '[]'::jsonb),
  'project_metrics', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_project_metrics v), '[]'::jsonb),
  'project_challenges', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_project_challenges v), '[]'::jsonb),
  'project_technologies', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, project_id, technology_id) from snapshot_project_technologies v), '[]'::jsonb),
  'posts', coalesce((select jsonb_agg(to_jsonb(v) order by published_at desc, id) from snapshot_posts v), '[]'::jsonb),
  'categories', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_categories v), '[]'::jsonb),
  'post_category_relations', coalesce((select jsonb_agg(to_jsonb(v) order by post_id, category_id) from snapshot_post_category_relations v), '[]'::jsonb),
  'tags', coalesce((select jsonb_agg(to_jsonb(v) order by id) from snapshot_tags v), '[]'::jsonb),
  'post_tags', coalesce((select jsonb_agg(to_jsonb(v) order by post_id, tag_id) from snapshot_post_tags v), '[]'::jsonb),
  'experiences', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_experiences v), '[]'::jsonb),
  'experience_highlights', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_experience_highlights v), '[]'::jsonb),
  'experience_projects', coalesce((select jsonb_agg(to_jsonb(v) order by experience_id, project_id) from snapshot_experience_projects v), '[]'::jsonb),
  'experience_technologies', coalesce((select jsonb_agg(to_jsonb(v) order by experience_id, technology_id) from snapshot_experience_technologies v), '[]'::jsonb),
  'technologies', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_technologies v), '[]'::jsonb),
  'specialties', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_specialties v), '[]'::jsonb),
  'principles', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_principles v), '[]'::jsonb),
  'impact_metrics', coalesce((select jsonb_agg(to_jsonb(v) order by sort_order, id) from snapshot_impact_metrics v), '[]'::jsonb),
  'media_assets', coalesce((select jsonb_agg(to_jsonb(v) order by id) from snapshot_media_assets v), '[]'::jsonb),
  'media_references', coalesce((select jsonb_agg(to_jsonb(v) order by asset_id, entity_id, field) from snapshot_media_references v), '[]'::jsonb),
  'documents', coalesce((select jsonb_agg(to_jsonb(v) order by id) from snapshot_documents v), '[]'::jsonb)
);
$$;
revoke all on function public.get_public_snapshot() from public;
grant execute on function public.get_public_snapshot() to anon, authenticated;
comment on function public.get_public_snapshot() is 'F6: public DTO, invoker RLS and redacted contact/media projections. No privileged fallback.';
commit;
