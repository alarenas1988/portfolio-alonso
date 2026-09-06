begin;
-- Public rows must never cache a URL to private media, even in direct table queries.
create or replace function private.sync_asset_columns() returns trigger
language plpgsql set search_path = '' as $$
declare
  source_id uuid;
  asset public.media_assets%rowtype;
  i integer;
  patch jsonb := '{}'::jsonb;
begin
  for i in 0..(tg_nargs / 2 - 1) loop
    source_id := (to_jsonb(new)->>tg_argv[i * 2])::uuid;
    if source_id is not null then
      select * into strict asset from public.media_assets where id = source_id for share;
      if tg_table_name = 'documents' then
        if asset.mime_type <> 'application/pdf' then
          raise check_violation using message = 'CV documents require a PDF asset';
        end if;
      elsif asset.mime_type not like 'image/%' then
        raise check_violation using message = 'Editorial image requires an image asset';
      end if;
    else
      asset := null;
    end if;
    if asset.visibility is distinct from 'public' then
      asset.public_url := null;
    end if;
    if tg_argv[i * 2 + 1] <> '' then
      patch := patch || jsonb_build_object(tg_argv[i * 2 + 1], asset.public_url);
    end if;
    if tg_table_name in ('documents','project_images') then
      patch := patch || jsonb_build_object('storage_path', asset.storage_path);
    end if;
  end loop;
  new := jsonb_populate_record(new, patch);
  return new;
end;
$$;


create or replace function private.derive_cv_url() returns trigger
language plpgsql set search_path = '' as $$
begin
  select d.public_url into new.cv_url from public.documents d
    join public.media_assets m on m.id=d.asset_id
    where d.type='cv' and d.active and m.visibility='public'
    and exists(select 1 from public.contact_settings c where c.cv_enabled);
  return new;
end;
$$;
create function private.refresh_media_visibility() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.projects set featured_image_asset_id=featured_image_asset_id
    where new.id in (featured_image_asset_id,cover_image_asset_id,og_image_asset_id);
  update public.posts set featured_image_asset_id=featured_image_asset_id
    where new.id in (featured_image_asset_id,og_image_asset_id);
  update public.project_images set asset_id=asset_id where asset_id=new.id;
  update public.documents set asset_id=asset_id where asset_id=new.id;
  update public.site_settings set about_image_asset_id=about_image_asset_id;
  return null;
end;
$$;
create trigger refresh_media_visibility after update of visibility on public.media_assets
for each row when (old.visibility is distinct from new.visibility) execute function private.refresh_media_visibility();
create trigger refresh_contact_cv after update of cv_enabled on public.contact_settings
for each statement execute function private.refresh_cv_url();
revoke all on function private.refresh_media_visibility() from public, anon, authenticated;
-- Recompute existing caches during the migration under administrative privileges.
update public.projects set featured_image_asset_id=featured_image_asset_id;
update public.posts set featured_image_asset_id=featured_image_asset_id;
update public.project_images set asset_id=asset_id;
update public.documents set asset_id=asset_id;
update public.site_settings set cv_url=null;
commit;
