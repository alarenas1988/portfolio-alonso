begin;
alter table public.media_assets add column decorative boolean not null default false;
alter table public.media_assets drop constraint media_assets_public_url_check;
alter table public.media_assets add constraint media_assets_public_url_check check (
 public_url is null or public_url ~ '^(https://[^[:space:]?#]+|http://(127\.0\.0\.1|localhost):[0-9]+/[^[:space:]?#]+)$'
);
alter table public.media_assets add constraint media_assets_upload_contract check (
 private.storage_path_allowed(storage_bucket,storage_path)
 and file_size between 1 and 10485760
 and mime_type in ('image/jpeg','image/png','image/webp','image/avif','application/pdf')
 and (caption is null or length(caption)<=2000)
 and lower(filename) ~ case mime_type when 'image/jpeg' then '\.(jpg|jpeg)$' when 'image/png' then '\.png$' when 'image/webp' then '\.webp$' when 'image/avif' then '\.avif$' else '\.pdf$' end
 and storage_path like '%.' || case mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/avif' then 'avif' else 'pdf' end
 and ((storage_bucket='private' and visibility='private' and public_url is null)
   or (storage_bucket<>'private' and visibility='public' and public_url is not null
     and right(public_url,length('/storage/v1/object/public/'||storage_bucket||'/'||storage_path))='/storage/v1/object/public/'||storage_bucket||'/'||storage_path))
 and ((mime_type='application/pdf' and width is null and height is null and not decorative)
   or (mime_type like 'image/%' and width is not null and height is not null
     and width::bigint*height<=40000000
     and alt_text is not null and ((decorative and alt_text='') or (not decorative and length(btrim(alt_text)) between 1 and 500))))
);
grant update(decorative) on public.media_assets to authenticated;
-- Restrict file metadata updates too: only editorial fields are mutable.
revoke update(width,height,file_size,visibility) on public.media_assets from authenticated;
alter table public.documents drop constraint documents_type_check;
alter table public.documents add constraint documents_type_check check(type in ('cv','document'));
drop index public.documents_one_active_cv;
create unique index documents_one_active_cv on public.documents(type) where active and type='cv';

alter table public.technologies add column icon_asset_id uuid references public.media_assets(id) on delete restrict;
alter table public.technologies add column icon_url text;
create index technologies_icon_asset_idx on public.technologies(icon_asset_id);
alter table public.media_references add column technology_id uuid references public.technologies(id) on delete cascade;
create index media_references_technology_idx on public.media_references(technology_id);
alter table public.media_references drop constraint media_references_check;
alter table public.media_references add constraint media_references_check check(num_nonnulls(project_id,post_id,settings_id,project_image_id,document_id,technology_id)=1);
alter table public.media_references alter column entity_type set expression as (case when project_id is not null then 'project' when post_id is not null then 'post' when settings_id is not null then 'settings' when project_image_id is not null then 'project_image' when document_id is not null then 'document' when technology_id is not null then 'technology' end);
alter table public.media_references alter column entity_id set expression as (coalesce(project_id,post_id,settings_id,project_image_id,document_id,technology_id));
create trigger sync_asset_columns before insert or update on public.technologies for each row execute function private.sync_asset_columns('icon_asset_id','icon_url');
create trigger sync_asset_references after insert or update on public.technologies for each row execute function private.sync_asset_references('technology_id','icon_asset_id');

create function private.sync_markdown_media() returns trigger language plpgsql set search_path='' as $$
declare field_name text; target uuid; token text; i integer;
begin
 for i in 1..tg_nargs-1 loop
  field_name:=tg_argv[i];
  execute format('delete from public.media_references where %I=$1 and field=$2',tg_argv[0]) using new.id,field_name;
  for token in select distinct m[1] from regexp_matches(coalesce(to_jsonb(new)->>field_name,''),'media:([[:alnum:]-]+)','g') m loop
   if token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise check_violation using message='Markdown media references require canonical lowercase UUIDs'; end if;
   target:=token::uuid;
   execute format('insert into public.media_references(asset_id,%I,field) values($1,$2,$3) on conflict do nothing',tg_argv[0])
    using target,new.id,field_name;
  end loop;
 end loop;
 return new;
end; $$;
create trigger sync_markdown_media after insert or update on public.projects for each row execute function private.sync_markdown_media(
 'project_id','problem','objective','solution','architecture','challenges','learnings','before_markdown','after_markdown');
create trigger sync_markdown_media after insert or update on public.posts for each row execute function private.sync_markdown_media('post_id','content_markdown');
create trigger sync_markdown_media after insert or update on public.site_settings for each row execute function private.sync_markdown_media(
 'settings_id','about_summary_markdown','about_profile_markdown','working_method_markdown');
revoke all on function private.sync_markdown_media() from public,anon,authenticated;

-- Invoker RPC: RLS/grants apply even to direct calls, with an explicit authorization check.
create function public.replace_media_asset(previous_id uuid,replacement_id uuid,expected_updated_at timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare previous public.media_assets%rowtype; replacement public.media_assets%rowtype;
begin
 if not private.is_portfolio_admin() then raise insufficient_privilege using message='Owner required'; end if;
 if previous_id=replacement_id then raise check_violation using message='Replacement must have a new immutable location'; end if;
 -- Serialize media lifecycle transactions; content triggers acquire row locks through their FKs.
 perform pg_catalog.pg_advisory_xact_lock(816008);
 select * into strict previous from public.media_assets where id=previous_id for update;
 select * into strict replacement from public.media_assets where id=replacement_id for update;
 if expected_updated_at is null or previous.updated_at<>expected_updated_at then raise serialization_failure using message='Asset revision conflict'; end if;
 if (previous.mime_type='application/pdf')<>(replacement.mime_type='application/pdf')
  or (previous.visibility='public' and replacement.visibility<>'public') then
  raise check_violation using message='Replacement must preserve media kind and public availability';
 end if;
 update public.technologies set icon_asset_id=replacement_id where icon_asset_id=previous_id;
 update public.projects set
  featured_image_asset_id=case when featured_image_asset_id=previous_id then replacement_id else featured_image_asset_id end,
  cover_image_asset_id=case when cover_image_asset_id=previous_id then replacement_id else cover_image_asset_id end,
  og_image_asset_id=case when og_image_asset_id=previous_id then replacement_id else og_image_asset_id end,
  problem=replace(problem,'media:'||previous_id,'media:'||replacement_id),
  objective=replace(objective,'media:'||previous_id,'media:'||replacement_id),
  solution=replace(solution,'media:'||previous_id,'media:'||replacement_id),
  architecture=replace(architecture,'media:'||previous_id,'media:'||replacement_id),
  challenges=replace(challenges,'media:'||previous_id,'media:'||replacement_id),
  learnings=replace(learnings,'media:'||previous_id,'media:'||replacement_id),
  before_markdown=replace(before_markdown,'media:'||previous_id,'media:'||replacement_id),
  after_markdown=replace(after_markdown,'media:'||previous_id,'media:'||replacement_id)
 where id in(select project_id from public.media_references where asset_id=previous_id);
 update public.posts set
  featured_image_asset_id=case when featured_image_asset_id=previous_id then replacement_id else featured_image_asset_id end,
  og_image_asset_id=case when og_image_asset_id=previous_id then replacement_id else og_image_asset_id end,
  content_markdown=replace(content_markdown,'media:'||previous_id,'media:'||replacement_id)
 where id in(select post_id from public.media_references where asset_id=previous_id);
 update public.site_settings set
  about_image_asset_id=case when about_image_asset_id=previous_id then replacement_id else about_image_asset_id end,
  default_og_image_asset_id=case when default_og_image_asset_id=previous_id then replacement_id else default_og_image_asset_id end,
  about_summary_markdown=replace(about_summary_markdown,'media:'||previous_id,'media:'||replacement_id),
  about_profile_markdown=replace(about_profile_markdown,'media:'||previous_id,'media:'||replacement_id),
  working_method_markdown=replace(working_method_markdown,'media:'||previous_id,'media:'||replacement_id)
 where id in(select settings_id from public.media_references where asset_id=previous_id);
 update public.project_images set asset_id=replacement_id where asset_id=previous_id;
 update public.documents set asset_id=replacement_id where asset_id=previous_id;
 -- Explicitly registered uses without an editorial FK remain conservatively protected.
 if exists(select 1 from public.media_references where asset_id=previous_id) then
  raise check_violation using message='Unresolved media references; unlink explicitly';
 end if;
 -- Retain the previous asset and bytes; removal is a separate deliberate operation.
end; $$;
create function public.activate_cv(document_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_portfolio_admin() then raise insufficient_privilege using message='Owner required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(816009);
 perform 1 from public.documents d join public.media_assets a on a.id=d.asset_id
  where d.id=document_id and d.type='cv' and a.mime_type='application/pdf' and a.visibility='public' for update of d;
 if not found then raise check_violation using message='An existing public PDF CV is required'; end if;
 update public.documents set active=false where type='cv' and active and id<>document_id;
 update public.documents set active=true where id=document_id;
end; $$;
revoke all on function public.replace_media_asset(uuid,uuid,timestamptz),public.activate_cv(uuid) from public,anon,authenticated;
grant execute on function public.replace_media_asset(uuid,uuid,timestamptz),public.activate_cv(uuid) to authenticated;
commit;
