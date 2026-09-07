begin;
select no_plan();

create temp table publication_ids(label text primary key, id uuid default gen_random_uuid());
insert into publication_ids(label) values ('owner'), ('first'), ('latest');
grant select on publication_ids to service_role;
insert into auth.users(id) select id from publication_ids where label='owner';
insert into public.admin_profiles(id,display_name,role,active)
  select id,'F11 local publication fixture','owner',true from publication_ids where label='owner';
create function pg_temp.request_publication(label text) returns jsonb language sql as $$
  select public.edge_request_build(
    (select id from pg_temp.publication_ids where label=$1),
    (select id from pg_temp.publication_ids where label='owner'),'manual');
$$;
set local role service_role;
select is(pg_temp.request_publication('first')->>'dispatch','true','First request reserves dispatch');
select is(pg_temp.request_publication('first')->>'dispatch','false','Technical retry reserves no second dispatch');
select is(pg_temp.request_publication('latest')->>'outcome','limited','Distinct immediate requests respect cooldown');
reset role;
-- Simulate a running workflow whose snapshot predates the owner's next change.
update public.site_builds set created_at=now()-interval '31 seconds',
  started_at=now()-interval '10 seconds',status='building'
  where request_id=(select id from publication_ids where label='first');
set local role service_role;
select is(pg_temp.request_publication('latest')->>'dispatch','true','New content request gets a fresh build after cooldown');
select is((select count(*) from public.site_builds where request_id in
  (select id from publication_ids where label in ('first','latest'))),2::bigint,'Distinct accepted request IDs remain durable');
select is(pg_temp.request_publication('latest')->>'dispatch','false','Lost response retry retains latest request identity');
select is(pg_temp.request_publication('first')->>'status','building','Original request remains correlated to original workflow');
select isnt(pg_temp.request_publication('first')->>'build_id',pg_temp.request_publication('latest')->>'build_id','A prior snapshot cannot stand in for new publication');
reset role;
select ok(not has_function_privilege('anon','public.edge_request_build(uuid,uuid,text,text,uuid,uuid)','EXECUTE'),'Anon cannot reserve builds');
select ok(not has_function_privilege('authenticated','public.edge_request_build(uuid,uuid,text,text,uuid,uuid)','EXECUTE'),'Browser cannot bypass Edge authorization');
select ok(not (select prosecdef from pg_proc where oid='public.edge_request_build(uuid,uuid,text,text,uuid,uuid)'::regprocedure),'Reservation still uses invoker security');
select * from finish();
rollback;
