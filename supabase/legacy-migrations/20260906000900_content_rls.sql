begin;
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
create policy public_read on public.site_settings for select to anon, authenticated using (true);
grant insert, delete on public.site_settings to authenticated;
grant update on public.site_settings to authenticated;
create policy owner_read on public.site_settings for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.site_settings for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.site_settings for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.site_settings for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.social_links enable row level security;
grant select on public.social_links to anon, authenticated;
create policy public_read on public.social_links for select to anon, authenticated using (visible);
grant insert, delete on public.social_links to authenticated;
grant update on public.social_links to authenticated;
create policy owner_read on public.social_links for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.social_links for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.social_links for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.social_links for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.projects enable row level security;
grant select on public.projects to anon, authenticated;
create policy public_read on public.projects for select to anon, authenticated using (published and status <> 'archived' and published_at <= now());
grant insert, delete on public.projects to authenticated;
grant update on public.projects to authenticated;
create policy owner_read on public.projects for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.projects for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.projects for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.projects for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.posts enable row level security;
grant select on public.posts to anon, authenticated;
create policy public_read on public.posts for select to anon, authenticated using (status = 'published' and published_at <= now());
grant insert, delete on public.posts to authenticated;
grant update on public.posts to authenticated;
create policy owner_read on public.posts for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.posts for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.posts for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.posts for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.technologies enable row level security;
grant select on public.technologies to anon, authenticated;
create policy public_read on public.technologies for select to anon, authenticated using (visible);
grant insert, delete on public.technologies to authenticated;
grant update on public.technologies to authenticated;
create policy owner_read on public.technologies for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.technologies for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.technologies for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.technologies for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.post_categories enable row level security;
grant select on public.post_categories to anon, authenticated;
create policy public_read on public.post_categories for select to anon, authenticated using (visible);
grant insert, delete on public.post_categories to authenticated;
grant update on public.post_categories to authenticated;
create policy owner_read on public.post_categories for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.post_categories for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.post_categories for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.post_categories for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.experiences enable row level security;
grant select on public.experiences to anon, authenticated;
create policy public_read on public.experiences for select to anon, authenticated using (visible);
grant insert, delete on public.experiences to authenticated;
grant update on public.experiences to authenticated;
create policy owner_read on public.experiences for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.experiences for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.experiences for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.experiences for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.specialties enable row level security;
grant select on public.specialties to anon, authenticated;
create policy public_read on public.specialties for select to anon, authenticated using (visible);
grant insert, delete on public.specialties to authenticated;
grant update on public.specialties to authenticated;
create policy owner_read on public.specialties for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.specialties for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.specialties for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.specialties for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.work_principles enable row level security;
grant select on public.work_principles to anon, authenticated;
create policy public_read on public.work_principles for select to anon, authenticated using (visible);
grant insert, delete on public.work_principles to authenticated;
grant update on public.work_principles to authenticated;
create policy owner_read on public.work_principles for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.work_principles for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.work_principles for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.work_principles for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.impact_metrics enable row level security;
grant select on public.impact_metrics to anon, authenticated;
create policy public_read on public.impact_metrics for select to anon, authenticated using (visible);
grant insert, delete on public.impact_metrics to authenticated;
grant update on public.impact_metrics to authenticated;
create policy owner_read on public.impact_metrics for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.impact_metrics for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.impact_metrics for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.impact_metrics for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.project_features enable row level security;
grant select on public.project_features to anon, authenticated;
create policy public_read on public.project_features for select to anon, authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.published and p.status <> 'archived' and p.published_at <= now()));
grant insert, delete on public.project_features to authenticated;
grant update on public.project_features to authenticated;
create policy owner_read on public.project_features for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.project_features for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.project_features for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.project_features for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.project_challenges enable row level security;
grant select on public.project_challenges to anon, authenticated;
create policy public_read on public.project_challenges for select to anon, authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.published and p.status <> 'archived' and p.published_at <= now()));
grant insert, delete on public.project_challenges to authenticated;
grant update on public.project_challenges to authenticated;
create policy owner_read on public.project_challenges for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.project_challenges for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.project_challenges for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.project_challenges for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.project_metrics enable row level security;
grant select on public.project_metrics to anon, authenticated;
create policy public_read on public.project_metrics for select to anon, authenticated using (visible and exists (select 1 from public.projects p where p.id = project_id and p.published and p.status <> 'archived' and p.published_at <= now()));
grant insert, delete on public.project_metrics to authenticated;
grant update on public.project_metrics to authenticated;
create policy owner_read on public.project_metrics for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.project_metrics for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.project_metrics for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.project_metrics for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.project_images enable row level security;
grant select on public.project_images to anon, authenticated;
create policy public_read on public.project_images for select to anon, authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.published and p.status <> 'archived' and p.published_at <= now()) and exists (select 1 from public.public_media_assets m where m.id = asset_id));
grant insert, delete on public.project_images to authenticated;
grant update on public.project_images to authenticated;
create policy owner_read on public.project_images for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.project_images for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.project_images for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.project_images for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.project_technologies enable row level security;
grant select on public.project_technologies to anon, authenticated;
create policy public_read on public.project_technologies for select to anon, authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.published and p.status <> 'archived' and p.published_at <= now()) and exists (select 1 from public.technologies t where t.id = technology_id and t.visible));
grant insert, delete on public.project_technologies to authenticated;
grant update on public.project_technologies to authenticated;
create policy owner_read on public.project_technologies for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.project_technologies for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.project_technologies for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.project_technologies for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.post_tags enable row level security;
grant select on public.post_tags to anon, authenticated;
create policy public_read on public.post_tags for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id and p.status = 'published' and p.published_at <= now()));
grant insert, delete on public.post_tags to authenticated;
grant update on public.post_tags to authenticated;
create policy owner_read on public.post_tags for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.post_tags for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.post_tags for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.post_tags for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.post_category_relations enable row level security;
grant select on public.post_category_relations to anon, authenticated;
create policy public_read on public.post_category_relations for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id and p.status = 'published' and p.published_at <= now()) and exists (select 1 from public.post_categories c where c.id = category_id and c.visible));
grant insert, delete on public.post_category_relations to authenticated;
grant update on public.post_category_relations to authenticated;
create policy owner_read on public.post_category_relations for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.post_category_relations for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.post_category_relations for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.post_category_relations for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.tags enable row level security;
grant select on public.tags to anon, authenticated;
create policy public_read on public.tags for select to anon, authenticated using (exists (select 1 from public.post_tags pt join public.posts p on p.id = pt.post_id where pt.tag_id = tags.id and p.status = 'published' and p.published_at <= now()));
grant insert, delete on public.tags to authenticated;
grant update on public.tags to authenticated;
create policy owner_read on public.tags for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.tags for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.tags for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.tags for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.experience_highlights enable row level security;
grant select on public.experience_highlights to anon, authenticated;
create policy public_read on public.experience_highlights for select to anon, authenticated using (exists (select 1 from public.experiences e where e.id = experience_id and e.visible));
grant insert, delete on public.experience_highlights to authenticated;
grant update on public.experience_highlights to authenticated;
create policy owner_read on public.experience_highlights for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.experience_highlights for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.experience_highlights for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.experience_highlights for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.experience_projects enable row level security;
grant select on public.experience_projects to anon, authenticated;
create policy public_read on public.experience_projects for select to anon, authenticated using (exists (select 1 from public.experiences e where e.id = experience_id and e.visible) and exists (select 1 from public.projects p where p.id = project_id and p.published and p.status <> 'archived' and p.published_at <= now()));
grant insert, delete on public.experience_projects to authenticated;
grant update on public.experience_projects to authenticated;
create policy owner_read on public.experience_projects for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.experience_projects for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.experience_projects for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.experience_projects for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.experience_technologies enable row level security;
grant select on public.experience_technologies to anon, authenticated;
create policy public_read on public.experience_technologies for select to anon, authenticated using (exists (select 1 from public.experiences e where e.id = experience_id and e.visible) and exists (select 1 from public.technologies t where t.id = technology_id and t.visible));
grant insert, delete on public.experience_technologies to authenticated;
grant update on public.experience_technologies to authenticated;
create policy owner_read on public.experience_technologies for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.experience_technologies for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.experience_technologies for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.experience_technologies for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.documents enable row level security;
grant select on public.documents to anon, authenticated;
create policy public_read on public.documents for select to anon, authenticated using (active and exists (select 1 from public.public_contact_settings c where c.cv_enabled) and exists (select 1 from public.public_media_assets m where m.id = asset_id));
grant insert, delete on public.documents to authenticated;
grant update on public.documents to authenticated;
create policy owner_read on public.documents for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.documents for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.documents for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.documents for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.media_references enable row level security;
grant select on public.media_references to anon, authenticated;
create policy public_read on public.media_references for select to anon, authenticated using (exists (select 1 from public.public_media_assets m where m.id = asset_id) and (
    exists (select 1 from public.projects p where p.id = project_id and p.published and p.status <> 'archived' and p.published_at <= now()) or
    exists (select 1 from public.posts p where p.id = post_id and p.status = 'published' and p.published_at <= now()) or
    exists (select 1 from public.site_settings s where s.id = settings_id) or
    exists (select 1 from public.project_images i join public.projects p on p.id=i.project_id where i.id=project_image_id and p.published and p.status<>'archived' and p.published_at<=now()) or
    exists (select 1 from public.documents d where d.id = document_id and d.active and exists (select 1 from public.public_contact_settings c where c.cv_enabled))
  ));
grant insert, delete on public.media_references to authenticated;
grant update on public.media_references to authenticated;
create policy owner_read on public.media_references for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.media_references for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.media_references for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.media_references for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.contact_settings enable row level security;
grant select on public.contact_settings to authenticated;
grant insert, delete on public.contact_settings to authenticated;
grant update on public.contact_settings to authenticated;
create policy owner_read on public.contact_settings for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.contact_settings for insert to authenticated
  with check ((select private.is_portfolio_admin()));
create policy owner_update on public.contact_settings for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.contact_settings for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.media_assets enable row level security;
grant select on public.media_assets to authenticated;
grant insert, delete on public.media_assets to authenticated;
grant update (visibility, filename, file_size, width, height, alt_text, caption, category) on public.media_assets to authenticated;
create policy owner_read on public.media_assets for select to authenticated using ((select private.is_portfolio_admin()));
create policy owner_insert on public.media_assets for insert to authenticated
  with check ((select private.is_portfolio_admin()) and created_by = (select auth.uid()));
create policy owner_update on public.media_assets for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
create policy owner_delete on public.media_assets for delete to authenticated using ((select private.is_portfolio_admin()));

alter table public.media_assets alter column created_by set default auth.uid();
-- Owner identity, operational records and author attribution are not content CRUD.
commit;
