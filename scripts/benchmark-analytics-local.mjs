import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { localStatus, localSql } from './edge-local.mjs';

assert.equal(process.argv[2], '--local-only');
localStatus(); // Refuses every endpoint except the isolated loopback stack.
const query = `begin;
set local statement_timeout='60s';
select pg_advisory_xact_lock(71010,1);
delete from public.analytics_events;
delete from public.analytics_daily;
delete from public.analytics_daily_content;
delete from private.analytics_daily_dimensions;
delete from private.analytics_daily_sessions;
create temp table bench_ids(kind text,n integer,id uuid default gen_random_uuid(),primary key(kind,n));
insert into bench_ids(kind,n) select kind,n from (values('project'),('post')) k(kind) cross join generate_series(0,7) n;
insert into bench_ids(kind,n) values('owner',0);
insert into auth.users(id) select id from bench_ids where kind='owner';
insert into public.admin_profiles(id,display_name,role,active) select id,'F10B LOCAL BENCH','owner',true from bench_ids where kind='owner';
insert into public.projects(id,title,slug,published,published_at) select id,'F10B BENCH','f10b-bench-project-'||n,true,now()-interval '100 days' from bench_ids where kind='project';
insert into public.posts(id,title,slug,status,published_at) select id,'F10B BENCH','f10b-bench-post-'||n,'published',now()-interval '100 days' from bench_ids where kind='post';
create function pg_temp.today() returns date language sql as $$select (now() at time zone 'America/Santiago')::date$$;
insert into public.analytics_events(event_id,session_hash,event_type,pathname,project_id,post_id,referrer_domain,device_type,browser_family,created_at)
select gen_random_uuid(),md5((g.n/1000)::text||':'||(g.n%200)::text)||md5((g.n/1000)::text||':'||(g.n%200)::text),event,
case when event in ('project_view','demo_click') then '/portfolio-alonso/proyectos/f10b-bench-project-'||p.n||'/'
 when event in ('post_view','article_share') then '/portfolio-alonso/blog/f10b-bench-post-'||b.n||'/'
 else (array['/portfolio-alonso/','/portfolio-alonso/proyectos/','/portfolio-alonso/blog/','/portfolio-alonso/sobre-mi/','/portfolio-alonso/contacto/'])[1+(g.n/12)%5] end,
case when event in ('project_view','demo_click') then p.id end,
case when event in ('post_view','article_share') then b.id end,
(array['same-site','google.com','github.com','linkedin.com',null])[1+(g.n/12)%5],
(array['desktop','mobile','tablet'])[1+(g.n/24)%3],(array['Chrome','Firefox','Safari'])[1+(g.n/36)%3],
((pg_temp.today()-g.n/1000)+time '12:00') at time zone 'America/Santiago'
from generate_series(0,94999) g(n)
cross join lateral (select (array['page_view','project_view','post_view','whatsapp_click','email_click','email_copy','github_click','linkedin_click','demo_click','cv_download','contact_submit','article_share'])[1+g.n%12] as event) e
join bench_ids p on p.kind='project' and p.n=(g.n/12)%8
join bench_ids b on b.kind='post' and b.n=(g.n/12)%8;
analyze public.analytics_events;
set local role service_role;
do $$begin for offset_day in 0..12 loop
 perform public.refresh_analytics(pg_temp.today()-least(89,offset_day*7+6),pg_temp.today()-offset_day*7);
end loop;end$$;
reset role;
analyze public.analytics_daily;
analyze public.analytics_daily_content;
analyze private.analytics_daily_dimensions;
analyze private.analytics_daily_sessions;
create temp table measurements(name text primary key,result jsonb);
grant select,insert on measurements to authenticated,service_role;
create function pg_temp.measure(label text,statement text) returns void language plpgsql as $$
declare plan jsonb;begin execute 'explain (analyze,buffers,format json) '||statement into plan;
insert into pg_temp.measurements values(label,plan);end$$;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',(select id from bench_ids where kind='owner'),'role','authenticated')::text,true);end$$;
set local role authenticated;
do $$begin
 perform pg_temp.measure('report_7_days','select public.get_analytics_report(pg_temp.today()-6,pg_temp.today())');
 perform pg_temp.measure('report_30_days','select public.get_analytics_report(pg_temp.today()-29,pg_temp.today())');
 perform pg_temp.measure('report_366_days','select public.get_analytics_report(pg_temp.today()-365,pg_temp.today())');
 perform pg_temp.measure('top_pages_30_days','select value,sum(page_views) as views from private.analytics_daily_dimensions where dimension=''pathname'' and date between pg_temp.today()-29 and pg_temp.today() group by value order by views desc,value limit 20');
 perform pg_temp.measure('distinct_sessions_30_days','select count(distinct session_hash) from private.analytics_daily_sessions where date between pg_temp.today()-29 and pg_temp.today() and content_type=''site''');
end$$;
reset role;
create temp table report_size as select octet_length(public.get_analytics_report(pg_temp.today()-29,pg_temp.today())::text) as bytes;
set local role service_role;
do $$begin
 perform pg_temp.measure('raw_recent_window','select event_type,count(*) from public.analytics_events where created_at >= ((pg_temp.today()-1)::timestamp at time zone ''America/Santiago'') group by event_type');
 perform pg_temp.measure('refresh_2_days','select public.refresh_analytics()');
 perform pg_temp.measure('maintenance_purge_5000','select public.maintain_analytics()');
end$$;
reset role;
select jsonb_build_object('dataset',jsonb_build_object('events',95000,'reporting_dates',95,'projects',8,'posts',8,'event_types',12,'daily_rows',(select count(*) from public.analytics_daily),'content_rows',(select count(*) from public.analytics_daily_content),'dimension_rows',(select count(*) from private.analytics_daily_dimensions),'session_rows',(select count(*) from private.analytics_daily_sessions)),
'raw_after_retention',(select count(*) from public.analytics_events),'report_30_bytes',(select bytes from report_size),
'plans',(select jsonb_object_agg(name,result) from measurements)) as evidence;
rollback;`;
const output = localSql(query)
  .split('\n')
  .find((line) => line.startsWith('{'));
assert(output, 'Benchmark evidence missing');
const evidence = JSON.parse(output);
assert.equal(evidence.raw_after_retention, 90000);
assert(evidence.report_30_bytes < 100000, 'Unexpectedly large aggregate report');
const result = {
  date: new Date().toISOString(),
  local_only: true,
  transaction_rolled_back: true,
  ...evidence,
};
mkdirSync('.tools/f10b', { recursive: true });
writeFileSync('.tools/f10b/performance.json', JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      dataset: result.dataset,
      report_30_bytes: result.report_30_bytes,
      execution_ms: Object.fromEntries(
        Object.entries(result.plans).map(([name, plan]) => [name, plan[0]['Execution Time']]),
      ),
      transaction_rolled_back: true,
    },
    null,
    2,
  ),
);
