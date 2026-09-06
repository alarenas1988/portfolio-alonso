begin;
-- PostgREST enables pg-safeupdate. A bounded singleton predicate is required even
-- inside invoker triggers; SQL-only tests do not exercise that HTTP session setting.
create or replace function private.refresh_cv_url() returns trigger
language plpgsql set search_path='' as $$
begin
 update public.site_settings set cv_url=null where singleton;
 return null;
end; $$;

-- Protect raw Markdown too if a caller manually removes a generated reference row.
create function private.protect_markdown_asset_delete() returns trigger
language plpgsql set search_path='' as $$
declare token text;
begin
 token:='media:'||old.id;
 if exists(select 1 from public.posts where strpos(coalesce(content_markdown,''),token)>0)
 or exists(select 1 from public.projects where
   strpos(concat_ws(' ',problem,objective,solution,architecture,challenges,learnings,before_markdown,after_markdown),token)>0)
 or exists(select 1 from public.site_settings where
   strpos(concat_ws(' ',about_summary_markdown,about_profile_markdown,working_method_markdown),token)>0)
 then raise foreign_key_violation using message='Asset is still referenced by Markdown; unlink the editorial content first';
 end if;
 return old;
end; $$;
create trigger protect_markdown_asset_delete before delete on public.media_assets
for each row execute function private.protect_markdown_asset_delete();
revoke all on function private.protect_markdown_asset_delete() from public,anon,authenticated;
commit;
