begin;
select no_plan();
select pg_advisory_xact_lock(71010,1);
delete from public.analytics_events;
delete from public.analytics_daily;
delete from public.analytics_daily_content;
delete from private.analytics_daily_dimensions;
delete from private.analytics_daily_sessions;
create temp table f10b_ids(label text primary key,id uuid default gen_random_uuid());
insert into f10b_ids(label) values('project'),('post'),('other'),('historical');
grant select on f10b_ids to service_role;
create function pg_temp.fid(text) returns uuid language sql as $$select id from pg_temp.f10b_ids where label=$1$$;
create function pg_temp.today() returns date language sql as $$select (now() at time zone 'America/Santiago')::date$$;
insert into public.projects(id,title,slug,published,published_at) values(pg_temp.fid('project'),'F10B SQL','f10b-sql-project',true,now()-interval '10 days');
insert into public.posts(id,title,slug,status,published_at) values(pg_temp.fid('post'),'F10B SQL','f10b-sql-post','published',now()-interval '10 days'),(pg_temp.fid('other'),'F10B SQL other','f10b-sql-other','published',now()-interval '10 days');
create function pg_temp.ingest(kind text,slug text) returns jsonb language sql as $$
select public.edge_record_event(gen_random_uuid(),repeat('a',64),case when kind='project' then 'project_view' else 'post_view' end,
 '/portfolio-alonso/'||case when kind='project' then 'proyectos/' else 'blog/' end||slug||'/',repeat('b',64),repeat('c',64),
 case when kind='project' then pg_temp.fid(kind) end,case when kind<>'project' then pg_temp.fid(kind) end)$$;
set local role service_role;
select is(pg_temp.ingest('project','f10b-sql-project')->>'outcome','accepted','Published project intake');
select is(pg_temp.ingest('post','f10b-sql-post')->>'outcome','accepted','Published post intake');
select is(pg_temp.ingest('other','f10b-sql-other')->>'outcome','accepted','Second public post intake');
reset role;
update public.posts set slug='f10b-sql-renamed' where id=pg_temp.fid('post');
set local role service_role;
select is(pg_temp.ingest('post','f10b-sql-post')->>'outcome','invalid','Old slug cannot collect new events');
select is(pg_temp.ingest('post','f10b-sql-renamed')->>'outcome','accepted','New slug retains the same UUID');
select lives_ok('select public.refresh_analytics()','Refresh after slug change');
select is((select views from public.analytics_daily_content where content_id=pg_temp.fid('post')),2::bigint,'UUID preserves content continuity across slugs');
reset role;
update public.projects set status='archived' where id=pg_temp.fid('project');
set local role service_role;
select is(pg_temp.ingest('project','f10b-sql-project')->>'outcome','invalid','Archived project intake rejected');
reset role;
update public.projects set status='completed',published=false where id=pg_temp.fid('project');
set local role service_role;
select is(pg_temp.ingest('project','f10b-sql-project')->>'outcome','invalid','Unpublished project intake rejected');
select lives_ok('select public.maintain_analytics()','Ranking from existing public posts');
select is((select popular_rank from public.posts where id=pg_temp.fid('post')),1,'More viewed post ranks first');
reset role;
update public.posts set status='archived' where id=pg_temp.fid('post');
set local role service_role;
select is(pg_temp.ingest('post','f10b-sql-renamed')->>'outcome','invalid','Archived post intake rejected');
select lives_ok('select public.maintain_analytics()','Recompute after archive');
select is((select popular_rank from public.posts where id=pg_temp.fid('post')),null::integer,'Archived post has no public rank');
select is((select popular_rank from public.posts where id=pg_temp.fid('other')),1,'Remaining public rank is contiguous');
reset role;
update public.posts set status='published' where id=pg_temp.fid('post');
insert into public.analytics_events(event_id,session_hash,event_type,pathname,post_id,created_at) values
 (gen_random_uuid(),repeat('d',64),'post_view','/portfolio-alonso/blog/f10b-sql-renamed/',pg_temp.fid('post'),(pg_temp.today()-3+time '12:00') at time zone 'America/Santiago');
set local role service_role;
select lives_ok('select public.refresh_analytics(pg_temp.today()-3,pg_temp.today())','Bounded reconciliation recovers an older missed day');
reset role;
delete from public.posts where id=pg_temp.fid('post');
select is((select count(*) from public.analytics_events where event_type='post_view' and post_id is null),3::bigint,'Deletion nulls raw FK without cascading events');
select is((select sum(views) from public.analytics_daily_content where content_id=pg_temp.fid('post')),3::numeric,'Historical UUID aggregates survive editorial deletion');
set local role service_role;
select lives_ok('select public.refresh_analytics()','Current/previous-day refresh remains valid after deletion');
select is((select sum(post_views) from public.analytics_daily),4::numeric,'Site post-view totals survive deletion and recomputation');
select is((select views from public.analytics_daily_content where content_id=pg_temp.fid('post') and date=pg_temp.today()-3),1::bigint,'Untouched historical date keeps retired content UUID');
select is((select count(*) from public.analytics_daily_content where content_id=pg_temp.fid('post') and date=pg_temp.today()),0::bigint,'Rebuilt raw with null FK has no invented content identity');
reset role;

-- Exact retention boundaries and transactional failure recovery, all rolled back.
insert into public.analytics_events(event_id,session_hash,event_type,pathname,created_at) values
 (gen_random_uuid(),repeat('e',64),'page_view','/portfolio-alonso/',((pg_temp.today()-89)::timestamp at time zone 'America/Santiago')-interval '1 microsecond'),
 (gen_random_uuid(),repeat('f',64),'page_view','/portfolio-alonso/',(pg_temp.today()-89)::timestamp at time zone 'America/Santiago');
insert into public.analytics_daily(date,page_views) values(pg_temp.today()-400,9),(pg_temp.today()-399,8),(pg_temp.today()-90,7);
insert into public.analytics_daily_content(date,content_type,content_id,views) select pg_temp.today()+offset_day,'post',pg_temp.fid('historical'),5 from (values(-400),(-399)) d(offset_day);
insert into private.analytics_daily_dimensions(date,dimension,value,page_views) select pg_temp.today()+offset_day,'pathname','/historical/',5 from (values(-400),(-399)) d(offset_day);
insert into private.analytics_daily_sessions(date,session_hash) select pg_temp.today()+offset_day,repeat('9',64) from (values(-400),(-399)) d(offset_day);
create function pg_temp.fail_aggregate() returns trigger language plpgsql as $$begin
 if current_setting('f10b.inject_failure',true)='on' then raise exception 'F10B injected aggregation failure';end if;return new;end$$;
create trigger f10b_inject_failure before insert on public.analytics_daily for each row execute function pg_temp.fail_aggregate();
set local f10b.inject_failure='on';
set local role service_role;
select throws_ok('select public.maintain_analytics()','P0001','F10B injected aggregation failure','Failed aggregate aborts whole maintenance transaction');
select is((select page_views from public.analytics_daily where date=pg_temp.today()-400),9::bigint,'Failure did not purge historical aggregate prematurely');
select is((select count(*) from public.analytics_events where session_hash=repeat('e',64)),1::bigint,'Persisted raw survives failed job');
select is((select post_views from public.analytics_daily where date=pg_temp.today()),3::bigint,'Previous valid aggregate survives failed replacement');
set local f10b.inject_failure='off';
select lives_ok('select public.maintain_analytics()','Retry after failure reconciles without manual row edits');
select is((select count(*) from public.analytics_events where session_hash=repeat('e',64)),0::bigint,'One microsecond before 90-date cutoff is removed');
select is((select count(*) from public.analytics_events where session_hash=repeat('f',64)),1::bigint,'Exact 90-date cutoff is retained');
select is((select page_views from public.analytics_daily where date=pg_temp.today()-90),7::bigint,'Aggregates beyond raw window are preserved');
select is((select page_views from public.analytics_daily where date=pg_temp.today()-399),8::bigint,'400-date cutoff retained');
select is((select count(*) from public.analytics_daily_content where date=pg_temp.today()-400),0::bigint,'Expired content aggregate removed');
select is((select count(*) from private.analytics_daily_dimensions where date=pg_temp.today()-400),0::bigint,'Expired dimension aggregate removed');
select is((select count(*) from private.analytics_daily_sessions where date=pg_temp.today()-400),0::bigint,'Expired session set removed');
select is((select count(*) from private.analytics_daily_dimensions where date=pg_temp.today()-399),1::bigint,'Dimension boundary preserved');
select lives_ok('select public.maintain_analytics()','Repeated purge is idempotent');
select throws_ok('select public.refresh_analytics(pg_temp.today()-90,pg_temp.today()-90)','22023',null,'Reconciliation cannot silently destroy expired raw history');
reset role;
insert into f10b_ids(label) values('tie'),('expired-rank');
insert into public.posts(id,title,slug,status,published_at) select id,'F10B rank fixture','f10b-rank-'||label,'published',now()-interval '100 days' from f10b_ids where label in ('tie','expired-rank');
insert into public.analytics_events(event_id,session_hash,event_type,pathname,post_id,created_at)
select gen_random_uuid(),repeat('7',64),'post_view','/portfolio-alonso/blog/f10b-rank-'||label||'/',id,
 ((pg_temp.today()-case when label='tie' then 29 else 30 end)+time '12:00') at time zone 'America/Santiago'
from f10b_ids where label in ('tie','expired-rank');
set local role service_role;
select lives_ok('select public.refresh_analytics(pg_temp.today()-30,pg_temp.today()-29);select public.maintain_analytics()','Ranking recalculates a backfilled boundary');
select is((select popular_rank from public.posts where id=least(pg_temp.fid('tie'),pg_temp.fid('other'))),1,'Equal views break ties deterministically by UUID');
select is((select popular_rank from public.posts where id=pg_temp.fid('expired-rank')),null::integer,'Day thirty before today is outside the thirty-date rank window');
select lives_ok('select public.maintain_analytics()','Ranking repeat succeeds');
select is((select popular_rank from public.posts where id=greatest(pg_temp.fid('tie'),pg_temp.fid('other'))),2,'Tie order remains stable on repeated maintenance');
reset role;
select * from finish();
rollback;
