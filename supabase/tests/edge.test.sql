begin;
select no_plan();

select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity),'All application tables retain RLS');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'edge_%' and
  (p.prosecdef or not ('search_path=""'=any(p.proconfig)))),'Edge RPCs are invoker with empty search_path');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'edge_%' and
  (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),'No browser role can execute an Edge service RPC');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'edge_%' and has_function_privilege('service_role',p.oid,'EXECUTE')),5::bigint,'Five RPCs callable only by backend');
select ok(not has_table_privilege('anon','public.contact_messages','INSERT') and not has_table_privilege('authenticated','public.contact_messages','INSERT'),'No direct client contact inserts');
select ok(not has_table_privilege('anon','public.analytics_events','INSERT') and not has_table_privilege('authenticated','public.analytics_events','INSERT'),'No direct client event inserts');
select is((select count(*) from cron.job where jobname='portfolio-rate-limit-retention'),1::bigint,'Rate counter cleanup is scheduled, including idle periods');

create temp table edge_fixture_ids(label text primary key,id uuid not null default gen_random_uuid());
insert into edge_fixture_ids(label) values('owner'),('normal'),('inactive'),('contact'),('event'),('request'),('missing');
grant select on edge_fixture_ids to service_role;
insert into auth.users(id) select id from edge_fixture_ids where label in ('owner','normal','inactive');
insert into public.admin_profiles(id,display_name,role,active)
  select id,'F9 SQL fixture','owner',label='owner' from edge_fixture_ids where label in ('owner','inactive');
update public.contact_settings set form_enabled=true;
create function pg_temp.edge_id(label text) returns uuid language sql as $$select id from pg_temp.edge_fixture_ids where edge_fixture_ids.label=$1$$;
create function pg_temp.contact(p_message text default 'Texto local de prueba con suficiente longitud.') returns jsonb language sql as $$
  select public.edge_record_contact(pg_temp.edge_id('contact'),'Fixture SQL','fixture@example.test','Prueba de contacto',$1,repeat('a',64),repeat('b',64),repeat('c',64));
$$;
create function pg_temp.request_build(actor text default 'owner') returns jsonb language sql as $$
  select public.edge_request_build(pg_temp.edge_id('request'),pg_temp.edge_id($1),'manual');
$$;

set local role anon;
select throws_ok($$select public.edge_record_contact(gen_random_uuid(),'Fixture','fixture@example.test','Prueba','Mensaje sintético suficientemente largo.',repeat('a',64),repeat('b',64),repeat('c',64))$$,'42501',null,'Anon RPC bypass denied');
set local role authenticated;
select throws_ok($$select public.edge_request_build(gen_random_uuid(),gen_random_uuid(),'manual')$$,'42501',null,'Authenticated cannot bypass Edge owner verification');
set local role service_role;

select is(pg_temp.contact()->>'outcome','accepted','Contact persisted by service');
select is(pg_temp.contact()->>'created','false','Duplicate contact returns acceptance without insert');
select is((select count(*) from public.contact_messages where submission_id=pg_temp.edge_id('contact')),1::bigint,'Exactly one message');
select is((select count(*) from public.analytics_events where event_id=pg_temp.edge_id('contact')),1::bigint,'Exactly one server conversion');
select is((select notification_status from public.contact_messages where submission_id=pg_temp.edge_id('contact')),'disabled','No email provider required');
select is(pg_temp.contact('Different valid content for same request ID.')->>'outcome','conflict','Changed payload cannot reuse submission UUID');
select ok(private.consume_edge_limit(repeat('d',64),'contact',2,900),'First atomic slot');
select ok(private.consume_edge_limit(repeat('d',64),'contact',2,900),'Second atomic slot');
select ok(not private.consume_edge_limit(repeat('d',64),'contact',2,900),'Atomic rate ceiling blocks third');
select is((select hits from private.rate_limit_buckets where key_hash=repeat('d',64)),3,'Counter capped at limit+1');
select ok(not private.consume_edge_limit(repeat('d',64),'contact',2,900),'Repeated abuse stays blocked');
select is((select hits from private.rate_limit_buckets where key_hash=repeat('d',64)),3,'Counter cannot overflow from repeated abuse');
select ok(not exists(select 1 from private.rate_limit_buckets where expires_at-window_start>interval '1 hour'),'Counter windows are bounded');
select throws_ok($$select private.consume_edge_limit(repeat('e',64),'contact',100,86400)$$,'23514',null,'Cannot create an eternal tracking bucket');

select is(public.edge_record_event(pg_temp.edge_id('event'),repeat('f',64),'page_view','/portfolio-alonso/',repeat('1',64),repeat('2',64))->>'outcome','accepted','Allowed event persisted');
select is(public.edge_record_event(pg_temp.edge_id('event'),repeat('f',64),'page_view','/portfolio-alonso/',repeat('1',64),repeat('2',64))->>'created','false','Event UUID idempotent');
select is(public.edge_record_event(pg_temp.edge_id('event'),repeat('3',64),'page_view','/portfolio-alonso/',repeat('1',64),repeat('2',64))->>'outcome','conflict','Event identity reuse with different session denied');
select is(public.edge_record_event(gen_random_uuid(),repeat('f',64),'page_view','/portfolio-alonso/person-name/',repeat('1',64),repeat('2',64))->>'outcome','invalid','Unknown potentially identifying pathname not stored');
select throws_ok($$select public.edge_record_event(gen_random_uuid(),repeat('f',64),'contact_submit','/portfolio-alonso/contacto/',repeat('1',64),repeat('2',64))$$,'23514',null,'Contact conversion not accepted through tracking intake');

select is(pg_temp.request_build('normal')->>'outcome','forbidden','Noowner denied by transactional owner check');
select is(pg_temp.request_build('inactive')->>'outcome','forbidden','Inactive owner denied inside transaction');
select is(pg_temp.request_build()->>'dispatch','true','Active owner reserves exactly one dispatch');
select is(pg_temp.request_build()->>'dispatch','false','Repeated request does not dispatch again');
select is(public.edge_request_build(gen_random_uuid(),pg_temp.edge_id('owner'),'manual')->>'dispatch','false','An active snapshot build is reused instead of a storm');
select is((select count(*) from public.site_builds where request_id=pg_temp.edge_id('request')),1::bigint,'One build row');

reset role;
create temp table edge_callback_fixture as select id as build_id,now() as started_at from public.site_builds where request_id=pg_temp.edge_id('request');
grant select on edge_callback_fixture to service_role;
create function pg_temp.callback(p_status text,p_sha text default repeat('a',40),p_run bigint default 1001) returns jsonb language sql as $$
  select public.edge_update_build_status(build_id,$1,$3,1,$2,
    'https://github.com/alarenas1988/portfolio-alonso/actions/runs/'||$3,started_at,
    case when $1<>'building' then started_at end,
    case when $1='success' then 'fixture-deployment' end,
    case when $1='failed' then 'build_failed' end) from pg_temp.edge_callback_fixture;
$$;
set local role service_role;
select is(pg_temp.callback('building')->>'outcome','accepted','Queued to building');
select is(pg_temp.callback('building')->>'duplicate','true','Repeated building callback is idempotent');
select is(pg_temp.callback('building',repeat('b',40))->>'outcome','conflict','Changing correlated commit denied');
select is(pg_temp.callback('building',repeat('a',40),1002)->>'outcome','conflict','Changing correlated run denied');
select is(pg_temp.callback('success')->>'outcome','accepted','Building to success');
select is(pg_temp.callback('success')->>'duplicate','true','Repeated success remains successful');
select is(pg_temp.callback('building')->>'outcome','conflict','Replay cannot downgrade success');
select is(pg_temp.callback('failed')->>'outcome','conflict','Late failed callback cannot replace success');
select is(public.edge_update_build_status(pg_temp.edge_id('missing'),'building',9999,1,repeat('a',40),'https://github.com/alarenas1988/portfolio-alonso/actions/runs/9999',now())->>'outcome','missing','Unknown build is not created by callback');
select lives_ok($$select public.edge_dispatch_failed((select build_id from pg_temp.edge_callback_fixture),'dispatch_failed')$$,'Lost dispatch result does not overwrite a real completed run');
select is((select status from public.site_builds where request_id=pg_temp.edge_id('request')),'success','Successful state preserved');
select is(public.edge_request_build(gen_random_uuid(),pg_temp.edge_id('owner'),'manual')->>'outcome','limited','Publication cooldown applies after completion');

reset role;
select * from finish();
rollback;
