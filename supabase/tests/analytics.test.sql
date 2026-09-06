begin;
select no_plan();
delete from public.analytics_events;
delete from public.analytics_daily;
delete from public.analytics_daily_content;
delete from private.analytics_daily_dimensions;
delete from private.analytics_daily_sessions;
create temp table f10_ids(label text primary key,id uuid default gen_random_uuid());
insert into f10_ids(label) values('owner'),('inactive'),('normal'),('project'),('post'),('post2'),('draft'),('future'),('submission');
grant select on f10_ids to service_role,authenticated;
create function pg_temp.fid(text) returns uuid language sql as $$select id from pg_temp.f10_ids where label=$1$$;
create function pg_temp.today() returns date language sql as $$select (now() at time zone 'America/Santiago')::date$$;
insert into auth.users(id) select id from f10_ids where label in ('owner','inactive','normal');
insert into public.admin_profiles(id,display_name,role,active)
  select id,'F10 LOCAL SQL','owner',label='owner' from f10_ids where label in ('owner','inactive');
insert into public.projects(id,title,slug,published,published_at)
  values(pg_temp.fid('project'),'F10 Project','f10-sql-project',true,now()-interval '1 day');
insert into public.posts(id,title,slug,status,published_at) values
  (pg_temp.fid('post'),'F10 Post','f10-sql-post','published',now()-interval '1 day'),
  (pg_temp.fid('post2'),'F10 Other','f10-sql-other','published',now()-interval '1 day'),
  (pg_temp.fid('draft'),'F10 Draft','f10-sql-draft','draft',null),
  (pg_temp.fid('future'),'F10 Future','f10-sql-future','published',now()+interval '1 day');
update public.contact_settings set form_enabled=true;
insert into public.analytics_events(event_id,session_hash,event_type,pathname,created_at)
  select gen_random_uuid(),repeat('a',64),'page_view','/portfolio-alonso/',
    (pg_temp.today()+offset_days+time '12:00') at time zone 'America/Santiago' from (values(0),(-1)) x(offset_days);
insert into public.analytics_events(event_id,session_hash,event_type,pathname,project_id)
  select gen_random_uuid(),repeat('b',64),event,'/portfolio-alonso/proyectos/f10-sql-project/',pg_temp.fid('project')
    from (values('page_view'),('project_view'),('demo_click'),('github_click')) x(event);
insert into public.analytics_events(event_id,session_hash,event_type,pathname,post_id)
  select gen_random_uuid(),repeat('c',64),event,'/portfolio-alonso/blog/f10-sql-post/',pg_temp.fid('post')
    from (values('page_view'),('post_view'),('article_share')) x(event);
insert into public.analytics_events(event_id,session_hash,event_type,pathname)
  select gen_random_uuid(),repeat('a',64),event,'/portfolio-alonso/' from
    (values('whatsapp_click'),('email_click'),('email_copy'),('linkedin_click'),('cv_download')) x(event);

set local role service_role;
select is(public.edge_record_contact(pg_temp.fid('submission'),'F10 Fixture','fixture@example.test','F10 TEST','Temporary local message, removed by transaction rollback.',repeat('d',64),repeat('e',64),repeat('f',64))->>'outcome','accepted','Contact accepted');
select is(public.edge_record_contact(pg_temp.fid('submission'),'F10 Fixture','fixture@example.test','F10 TEST','Temporary local message, removed by transaction rollback.',repeat('d',64),repeat('e',64),repeat('f',64))->>'created','false','Contact retry does not create another conversion');
select lives_ok('select public.refresh_analytics()','Aggregation transaction succeeds with least service grants');
select is((select page_views from public.analytics_daily where date=pg_temp.today()),3::bigint,'Today has three actual page views');
select is((select unique_sessions from public.analytics_daily where date=pg_temp.today()),3::bigint,'Contacts/clicks do not invent visits');
select is((select project_views from public.analytics_daily where date=pg_temp.today()),1::bigint,'Project view is distinct from page view');
select is((select post_views from public.analytics_daily where date=pg_temp.today()),1::bigint,'Post view is distinct from page view');
select is((select contact_submits from public.analytics_daily where date=pg_temp.today()),1::bigint,'Exactly one server contact conversion');
select ok((select whatsapp_clicks=1 and email_clicks=1 and email_copies=1 and github_clicks=1 and linkedin_clicks=1 and demo_clicks=1 and cv_downloads=1 and article_shares=1 from public.analytics_daily where date=pg_temp.today()),'Every allowed interaction counted');
select is((select views from public.analytics_daily_content where content_id=pg_temp.fid('project')),1::bigint,'Content view not doubled by page_view');
select is((select interactions from public.analytics_daily_content where content_id=pg_temp.fid('project')),2::bigint,'Project demo/github interactions retained');
select is((select count(*) from private.analytics_daily_sessions where content_type='site'),4::bigint,'Minimal daily site session sets');
select is((select count(distinct session_hash) from private.analytics_daily_sessions where content_type='site'),3::bigint,'Range distinct differs from sum of daily unique counts');
select lives_ok('select public.refresh_analytics()','Repeated recomputation is idempotent');
select is((select sum(page_views) from public.analytics_daily),4::numeric,'Recomputation does not increment twice');
select is((select sum(page_views) from private.analytics_daily_dimensions where dimension='pathname'),4::numeric,'Path dimensions equal site views');
select throws_ok('select public.refresh_analytics(pg_temp.today()-90,pg_temp.today()-90)','22023',null,'Cannot erase historical aggregates outside raw retention');
select throws_ok('select public.refresh_analytics(pg_temp.today()-7,pg_temp.today())','22023',null,'Backfill limited to seven reporting dates');
select throws_ok('select public.refresh_analytics(null,pg_temp.today())','22023',null,'Partial dates rejected');

reset role;
select is(('2026-09-06 03:59:59+00'::timestamptz at time zone 'America/Santiago')::date,'2026-09-05'::date,'Chile spring DST instant before jump');
select is(('2026-09-06 04:00:00+00'::timestamptz at time zone 'America/Santiago')::date,'2026-09-06'::date,'Chile spring DST instant after jump');
select is(extract(epoch from ('2026-09-07'::timestamp at time zone 'America/Santiago')-('2026-09-06'::timestamp at time zone 'America/Santiago'))::integer,23*3600,'DST reporting day is not hardcoded to 24 hours');
select is(('2026-04-05 02:59:59+00'::timestamptz at time zone 'America/Santiago')::date,'2026-04-04'::date,'Chile autumn date before fallback');
select is(('2026-04-05 03:00:00+00'::timestamptz at time zone 'America/Santiago')::date,'2026-04-04'::date,'Repeated autumn hour remains same reporting date');

set local role anon;
select throws_ok('select public.get_analytics_report(pg_temp.today(),pg_temp.today())','42501',null,'Anon report denied');
select throws_ok('select public.refresh_analytics()','42501',null,'Anon maintenance denied');
select throws_ok('select private.update_analytics_popularity()','42501',null,'Anon cannot call the narrow definer');
select throws_ok('select * from public.analytics_daily','42501',null,'Anon aggregates denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fid('normal'),'role','authenticated')::text,true);
select throws_ok('select public.get_analytics_report(pg_temp.today(),pg_temp.today())','42501',null,'Authenticated noowner report denied');
select is((select count(*) from public.analytics_daily),0::bigint,'Noowner sees no daily rows');
select is((select count(*) from public.analytics_events),0::bigint,'Noowner sees no raw rows');
select is((select count(*) from public.admin_analytics_daily_sessions),0::bigint,'Noowner sees no hashes');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fid('inactive'),'role','authenticated')::text,true);
select throws_ok('select public.get_analytics_report(pg_temp.today(),pg_temp.today())','42501',null,'Inactive owner report denied');
select is((select count(*) from public.analytics_daily_content),0::bigint,'Inactive owner sees no content aggregates');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fid('owner'),'role','authenticated')::text,true);
select is(public.get_analytics_report(pg_temp.today()-1,pg_temp.today())->'summary'->>'unique_sessions','3','Owner range uses DISTINCT hashes, not summed daily uniques');
select is(public.get_analytics_report(pg_temp.today()-1,pg_temp.today())->'summary'->>'page_views','4','Owner report reflects full inclusive range');
select is(public.get_analytics_report(pg_temp.today()-8,pg_temp.today()-7)->'daily','[]'::jsonb,'Empty range is explicit');
select throws_ok('select public.get_analytics_report(pg_temp.today()-366,pg_temp.today())','22023',null,'Owner report bounded to 366 dates');
select throws_ok('select public.get_analytics_report(pg_temp.today(),pg_temp.today()+1)','22023',null,'Future range denied');
select throws_ok('select public.maintain_analytics()','42501',null,'Owner cannot run privileged retention');
select throws_ok('select private.update_analytics_popularity()','42501',null,'Owner cannot call the derived-ranking definer');
reset role;

-- Retention fixtures; all are local and rolled back.
insert into public.analytics_events(event_id,session_hash,event_type,pathname,created_at)
  values(gen_random_uuid(),repeat('1',64),'page_view','/portfolio-alonso/',
    (pg_temp.today()-90+time '12:00') at time zone 'America/Santiago');
insert into public.analytics_daily(date,page_views) values(pg_temp.today()-90,5),(pg_temp.today()-400,7),(pg_temp.today()-399,8);
insert into private.analytics_daily_sessions(date,session_hash) values(pg_temp.today()-400,repeat('2',64)),(pg_temp.today()-399,repeat('3',64));
set local role service_role;
select lives_ok('select public.maintain_analytics()','Scheduled maintenance runs under service role');
select is((select count(*) from public.analytics_events where created_at<((pg_temp.today()-89)::timestamp at time zone 'America/Santiago')),0::bigint,'Raw older than 90 reporting dates removed');
select is((select page_views from public.analytics_daily where date=pg_temp.today()-90),5::bigint,'Historical aggregate survives raw retention');
select is((select count(*) from public.analytics_daily where date=pg_temp.today()-400),0::bigint,'400-date aggregate retention enforced');
select is((select page_views from public.analytics_daily where date=pg_temp.today()-399),8::bigint,'Inclusive retention boundary retained');
select is((select count(*) from private.analytics_daily_sessions where date=pg_temp.today()-400),0::bigint,'Expired session sets removed');
select is((select popular_rank from public.posts where id=pg_temp.fid('post')),1,'Public post rank derived from recent views');
select is((select popular_rank from public.posts where id=pg_temp.fid('post2')),null::integer,'Unviewed post has no fabricated rank');
select lives_ok('select public.maintain_analytics()','Repeated retention/ranking is idempotent');
reset role;
select ok(not exists(select 1 from pg_proc where oid in ('public.refresh_analytics(date,date)'::regprocedure,'public.maintain_analytics()'::regprocedure,'public.get_analytics_report(date,date)'::regprocedure) and prosecdef),'Public analytics RPCs remain SECURITY INVOKER');
select ok((select prosecdef and 'search_path=""'=any(proconfig) and pg_get_userbyid(proowner)='postgres' from pg_proc where oid='private.update_analytics_popularity()'::regprocedure),'Ranking definer has controlled owner and empty search_path');
select ok(not has_column_privilege('service_role','public.posts','popular_rank','UPDATE'),'Server cannot directly choose a public rank');
select is((select count(*) from cron.job where jobname='portfolio-analytics-maintenance' and active),1::bigint,'Single hourly job scheduled');
select ok(not public.get_public_snapshot()::text like '%session_hash%','Snapshot never exposes session hashes');
select * from finish();
rollback;
