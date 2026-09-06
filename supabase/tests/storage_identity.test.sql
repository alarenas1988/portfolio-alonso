begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(1);
select is((
  select count(*) from pg_catalog.pg_constraint fk
  where fk.contype = 'f' and fk.confrelid = 'storage.objects'::regclass
    and not exists (
      select 1 from pg_catalog.pg_constraint pk
      where pk.conrelid = fk.confrelid and pk.contype = 'p' and pk.conkey = fk.confkey
    )
), 0::bigint, 'Application foreign keys reference only the managed Storage primary key');
select * from finish();
rollback;
