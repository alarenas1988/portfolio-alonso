begin;
-- F8 creates exactly these four buckets. F6 installs security without creating buckets.
create function private.storage_path_allowed(bucket text, object_name text) returns boolean
language sql immutable security invoker set search_path = ''
as $$
  select object_name is not null
    and object_name !~ '(^/|(^|/)\.\.(/|$)|\\)'
    and (
      (bucket='portfolio-public' and object_name ~ '^(projects|technologies|profile)/[A-Za-z0-9_/-]+\.(jpg|jpeg|png|webp|avif)$') or
      (bucket='blog' and object_name ~ '^posts/[A-Za-z0-9_/-]+\.(jpg|jpeg|png|webp|avif)$') or
      (bucket='documents' and object_name ~ '^cv/[A-Za-z0-9_/-]+\.pdf$') or
      (bucket='private' and object_name ~ '^temporary/[A-Za-z0-9_/-]+\.(jpg|jpeg|png|webp|avif|pdf)$')
    );
$$;
revoke all on function private.storage_path_allowed(text,text) from public, anon, authenticated;
grant execute on function private.storage_path_allowed(text,text) to anon, authenticated;
-- Supabase owns this managed table: assert its RLS instead of altering ownership/state.
do $$ begin
  if not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then
    raise exception 'Storage objects must have RLS enabled by Supabase';
  end if;
end $$;
-- Platform-owned grants also exist and are not revoked by the migration role.
-- These explicit DML grants do not replace Storage's managed ACL; RLS gates its API.
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

create policy portfolio_public_objects on storage.objects for select to anon, authenticated
using (bucket_id in ('portfolio-public','blog','documents') and private.storage_path_allowed(bucket_id,name));
create policy portfolio_owner_objects_read on storage.objects for select to authenticated
using ((select private.is_portfolio_admin()) and owner_id=(select auth.uid())::text and private.storage_path_allowed(bucket_id,name));
create policy portfolio_owner_objects_insert on storage.objects for insert to authenticated
with check ((select private.is_portfolio_admin()) and owner_id=(select auth.uid())::text and private.storage_path_allowed(bucket_id,name));
create policy portfolio_owner_objects_update on storage.objects for update to authenticated
using ((select private.is_portfolio_admin()) and owner_id=(select auth.uid())::text and private.storage_path_allowed(bucket_id,name))
with check ((select private.is_portfolio_admin()) and owner_id=(select auth.uid())::text and private.storage_path_allowed(bucket_id,name));
create policy portfolio_owner_objects_delete on storage.objects for delete to authenticated
using ((select private.is_portfolio_admin()) and owner_id=(select auth.uid())::text and private.storage_path_allowed(bucket_id,name));
commit;
