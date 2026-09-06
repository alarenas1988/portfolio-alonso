begin;
-- Own-table lock: keep the old FK protecting all objects throughout the backfill.
lock table public.media_assets in access exclusive mode;
alter table public.media_assets add column storage_object_id uuid;
update public.media_assets a set storage_object_id = o.id
from storage.objects o
where a.storage_bucket = o.bucket_id and a.storage_path = o.name;
-- Fail atomically if legacy data cannot be resolved; never discard metadata.
alter table public.media_assets alter column storage_object_id set not null;
alter table public.media_assets add constraint media_assets_storage_object_id_key
  unique (storage_object_id);
alter table public.media_assets add constraint media_assets_storage_object_id_fkey
  foreign key (storage_object_id) references storage.objects(id)
  on update restrict on delete restrict;
-- Only remove our non-PK dependency after the replacement has been validated.
alter table public.media_assets drop constraint media_assets_storage_object_fk;

create function private.validate_storage_object_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare object_bucket text; object_path text;
begin
  if tg_op = 'UPDATE' then
    if new.storage_object_id is distinct from old.storage_object_id then
      raise check_violation using message = 'Storage identity is immutable; create a replacement asset';
    end if;
    return new;
  end if;
  -- Fail before inspecting Storage for a caller already excluded by owner RLS.
  if current_user = 'authenticated' and
    (not private.is_portfolio_admin() or new.created_by is distinct from auth.uid()) then
    raise insufficient_privilege using message = 'Active owner and matching asset author required';
  end if;
  -- Legacy SQL/editorial callers may omit the new column. Resolve an existing
  -- object, never generate a UUID pretending that an upload occurred.
  if new.storage_object_id is null then
    new.storage_object_id := (select o.id from storage.objects o
      where o.bucket_id = new.storage_bucket and o.name = new.storage_path);
  end if;
  -- API callers supply upload.data.id. Check its application location as well.
  -- This is a read, not a managed constraint/index or a Storage file operation.
  select o.bucket_id, o.name into object_bucket, object_path
  from storage.objects o where o.id = new.storage_object_id;
  if not found or object_bucket is distinct from new.storage_bucket
    or object_path is distinct from new.storage_path then
    raise foreign_key_violation using message = 'Storage object identity and location must match an accessible existing object';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_storage_object_identity() from public, anon, authenticated;
create trigger validate_storage_object_identity before insert or update on public.media_assets
for each row execute function private.validate_storage_object_identity();
comment on column public.media_assets.storage_object_id is
  'Storage API object UUID, referencing only its managed primary key. Immutable; metadata must be unlinked and removed before Storage API deletion.';
comment on constraint media_assets_storage_object_id_fkey on public.media_assets is
  'No cascade. Registered objects are protected from Storage API deletion; app lifecycle reports cleanup if byte removal fails after metadata deletion.';
commit;
