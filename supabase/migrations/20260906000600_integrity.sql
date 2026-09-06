begin;
-- Locations are immutable. Replacements create a new asset and reassign editorial FKs.
create function private.protect_asset_location() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.storage_bucket, new.storage_path, new.public_url, new.mime_type)
     is distinct from (old.storage_bucket, old.storage_path, old.public_url, old.mime_type) then
    raise check_violation using message = 'Asset locations and MIME types are immutable; create a replacement asset';
  end if;
  return new;
end;
$$;
create trigger protect_asset_location before update on public.media_assets
for each row execute function private.protect_asset_location();

-- Generic trigger plumbing only; editorial data remains in explicit relational columns.
create function private.sync_asset_columns() returns trigger
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

create function private.sync_asset_references() returns trigger
language plpgsql set search_path = '' as $$
declare
  i integer;
  source_id uuid;
begin
  for i in 1..(tg_nargs - 1) loop
    execute format('delete from public.media_references where %I = $1 and field = $2', tg_argv[0])
      using new.id, tg_argv[i];
    source_id := (to_jsonb(new)->>tg_argv[i])::uuid;
    if source_id is not null then
      execute format('insert into public.media_references (asset_id, %I, field) values ($1, $2, $3)', tg_argv[0])
        using source_id, new.id, tg_argv[i];
    end if;
  end loop;
  return new;
end;
$$;

create function private.derive_cv_url() returns trigger
language plpgsql set search_path = '' as $$
begin
  select d.public_url into new.cv_url
    from public.documents d where d.type = 'cv' and d.active;
  return new;
end;
$$;
create function private.refresh_cv_url() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.site_settings set cv_url = null;
  return null;
end;
$$;
create trigger derive_cv_url before insert or update on public.site_settings
for each row execute function private.derive_cv_url();
create trigger refresh_cv_url after insert or update or delete on public.documents
for each statement execute function private.refresh_cv_url();
create trigger sync_asset_columns before insert or update on public.projects
for each row execute function private.sync_asset_columns('featured_image_asset_id', 'featured_image_url', 'cover_image_asset_id', 'cover_image_url', 'og_image_asset_id', 'og_image_url');
create trigger sync_asset_references after insert or update on public.projects
for each row execute function private.sync_asset_references('project_id', 'featured_image_asset_id', 'cover_image_asset_id', 'og_image_asset_id');
create trigger sync_asset_columns before insert or update on public.posts
for each row execute function private.sync_asset_columns('featured_image_asset_id', 'featured_image_url', 'og_image_asset_id', 'og_image_url');
create trigger sync_asset_references after insert or update on public.posts
for each row execute function private.sync_asset_references('post_id', 'featured_image_asset_id', 'og_image_asset_id');
create trigger sync_asset_columns before insert or update on public.site_settings
for each row execute function private.sync_asset_columns('default_og_image_asset_id', 'default_og_image', 'about_image_asset_id', '');
create trigger sync_asset_references after insert or update on public.site_settings
for each row execute function private.sync_asset_references('settings_id', 'default_og_image_asset_id', 'about_image_asset_id');
create trigger sync_asset_columns before insert or update on public.project_images
for each row execute function private.sync_asset_columns('asset_id', 'public_url');
create trigger sync_asset_references after insert or update on public.project_images
for each row execute function private.sync_asset_references('project_image_id', 'asset_id');
create trigger sync_asset_columns before insert or update on public.documents
for each row execute function private.sync_asset_columns('asset_id', 'public_url');
create trigger sync_asset_references after insert or update on public.documents
for each row execute function private.sync_asset_references('document_id', 'asset_id');

-- Every mutable application row gets monotonic timestamps.
do $$
declare item record;
begin
  for item in select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', item.table_name);
  end loop;
end;
$$;

-- Index each FK unless an existing index already has that FK as its leading column(s).
do $$
declare item record;
begin
  for item in
    select c.conrelid, c.conname, c.conkey, n.nspname, t.relname,
      (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
       from unnest(c.conkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as columns
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname in ('public','private')
  loop
    if not exists (select 1 from pg_index i where i.indrelid = item.conrelid
      and i.indpred is null and (i.indkey::smallint[])[0:cardinality(item.conkey)-1] @> item.conkey) then
      execute format('create index %I on %I.%I (%s)', item.conname || '_idx', item.nspname, item.relname, item.columns);
    end if;
  end loop;
end;
$$;

create index projects_public_order on public.projects (sort_order, published_at desc, id)
  where published and status <> 'archived';
create index posts_public_date on public.posts (published_at desc, id) where status = 'published';
create index posts_popular_rank on public.posts (popular_rank) where status = 'published' and popular_rank is not null;
create index experiences_visible_order on public.experiences (sort_order, start_date desc) where visible;
create index technologies_visible_order on public.technologies (sort_order, name) where visible;
create index social_links_visible_order on public.social_links (sort_order) where visible;
create index contact_messages_status_date on public.contact_messages (status, created_at desc);
create index analytics_events_type_date on public.analytics_events (event_type, created_at);
create index analytics_events_session_date on public.analytics_events (session_hash, created_at);
create index admin_activity_created on public.admin_activity (created_at desc);
create index site_builds_status_created on public.site_builds (status, created_at desc);
create index rate_limit_expiry on private.rate_limit_buckets (expires_at);
create index analytics_daily_sessions_range on private.analytics_daily_sessions (session_hash, date);
revoke all on all functions in schema private from public, anon, authenticated;
commit;
