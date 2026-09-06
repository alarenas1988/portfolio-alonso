begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('portfolio-public','portfolio-public',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
('blog','blog',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
('documents','documents',true,10485760,array['application/pdf']),
('private','private',false,10485760,array['image/jpeg','image/png','image/webp','image/avif','application/pdf'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.storage_path_allowed(bucket text, object_name text) returns boolean
language sql immutable security invoker set search_path = '' as $$
select object_name is not null and (
 (bucket='portfolio-public' and object_name ~ '^(projects|technologies|profile|general)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|avif)$') or
 (bucket='blog' and object_name ~ '^posts/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|avif)$') or
 (bucket='documents' and object_name ~ '^(cv|general)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$') or
 (bucket='private' and object_name ~ '^(temporary|drafts|processing)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|avif|pdf)$')
);
$$;
-- New immutable paths replace files. In-place upsert/update/move is forbidden.
drop policy portfolio_owner_objects_update on storage.objects;
-- A tracked object cannot be deleted through Storage, even if the caller skips the UI.
-- PostgreSQL enforces this FK under every role and locks concurrent registrations/deletes.
alter table public.media_assets add constraint media_assets_storage_object_fk
 foreign key(storage_bucket,storage_path) references storage.objects(bucket_id,name) on delete restrict on update restrict;
comment on constraint media_assets_storage_object_fk on public.media_assets is
 'F8 depends on the managed Storage bucket/name unique key. Verify on platform upgrades. Delete metadata only after unlinking, then remove bytes.';
commit;
