begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);
select is((
  select count(*) from pg_catalog.pg_constraint fk
  where fk.contype = 'f' and fk.confrelid = 'storage.objects'::regclass
    and not exists (
      select 1 from pg_catalog.pg_constraint pk
      where pk.conrelid = fk.confrelid and pk.contype = 'p' and pk.conkey = fk.confkey
    )
), 0::bigint, 'Application foreign keys reference only the managed Storage primary key');
select is((select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.media_assets'::regclass and conname='media_assets_storage_object_id_fkey'),
  'FOREIGN KEY (storage_object_id) REFERENCES storage.objects(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
  'Storage UUID FK is restrictive and never cascades');
select col_not_null('public','media_assets','storage_object_id','Every asset has a Storage identity');
select col_type_is('public','media_assets','storage_object_id','uuid','Storage identity is UUID');
select col_is_unique('public','media_assets','storage_object_id','One editorial asset per object');
select ok(not (select prosecdef from pg_proc where oid='private.validate_storage_object_identity()'::regprocedure),
  'Location consistency trigger is invoker and respects Storage RLS');
select ok(not has_function_privilege('anon','private.validate_storage_object_identity()','execute')
  and not has_function_privilege('authenticated','private.validate_storage_object_identity()','execute'),
  'Clients cannot invoke the identity trigger directly');
select * from finish();
rollback;
