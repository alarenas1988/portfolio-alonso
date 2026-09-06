begin;

-- F10: recompute owned aggregates from a stable raw set; no baseline/intake edits.
alter table public.analytics_daily_content add column interactions bigint not null default 0 check (interactions >= 0);
create index analytics_events_created_at on public.analytics_events(created_at);
grant delete on public.analytics_events, public.analytics_daily, public.analytics_daily_content to service_role;
grant select (popular_rank) on public.posts to service_role;

create function public.refresh_analytics(p_from date default null, p_to date default null)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_from date := coalesce(p_from,v_today-1);
  v_to date := coalesce(p_to,v_today);
  v_start timestamptz;
  v_end timestamptz;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  if (p_from is null) <> (p_to is null) or v_from<v_today-89 or v_to>v_today or v_to<v_from or v_to-v_from>6 then
    raise exception 'Invalid analytics range' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(71010,1);
  -- SHARE blocks raw writers briefly and makes every aggregate see the same rows.
  -- No independent Edge requests simulate a transaction.
  lock table public.analytics_events in share mode;
  v_start := v_from::timestamp at time zone 'America/Santiago';
  v_end := (v_to+1)::timestamp at time zone 'America/Santiago';
  delete from public.analytics_daily where date between v_from and v_to;
  delete from public.analytics_daily_content where date between v_from and v_to;
  delete from private.analytics_daily_dimensions where date between v_from and v_to;
  delete from private.analytics_daily_sessions where date between v_from and v_to;

  insert into public.analytics_daily(date,unique_sessions,page_views,project_views,post_views,whatsapp_clicks,email_clicks,email_copies,github_clicks,linkedin_clicks,demo_clicks,cv_downloads,contact_submits,article_shares)
    select (created_at at time zone 'America/Santiago')::date,
      count(distinct session_hash) filter(where event_type='page_view'),
      count(*) filter (where event_type='page_view') as page_views,
      count(*) filter (where event_type='project_view') as project_views,
      count(*) filter (where event_type='post_view') as post_views,
      count(*) filter (where event_type='whatsapp_click') as whatsapp_clicks,
      count(*) filter (where event_type='email_click') as email_clicks,
      count(*) filter (where event_type='email_copy') as email_copies,
      count(*) filter (where event_type='github_click') as github_clicks,
      count(*) filter (where event_type='linkedin_click') as linkedin_clicks,
      count(*) filter (where event_type='demo_click') as demo_clicks,
      count(*) filter (where event_type='cv_download') as cv_downloads,
      count(*) filter (where event_type='contact_submit') as contact_submits,
      count(*) filter (where event_type='article_share') as article_shares
    from public.analytics_events where created_at>=v_start and created_at<v_end group by 1;

  insert into public.analytics_daily_content(date,content_type,content_id,views,unique_sessions,interactions)
    select (created_at at time zone 'America/Santiago')::date,
      case when project_id is not null then 'project' else 'post' end,
      coalesce(project_id,post_id),
      count(*) filter(where event_type in ('project_view','post_view')),
      count(distinct session_hash) filter(where event_type in ('project_view','post_view')),
      count(*) filter(where event_type not in ('page_view','project_view','post_view','contact_submit'))
    from public.analytics_events where created_at>=v_start and created_at<v_end
      and (project_id is not null or post_id is not null) group by 1,2,3;

  insert into private.analytics_daily_dimensions(date,dimension,value,unique_sessions,page_views,project_views,post_views,whatsapp_clicks,email_clicks,email_copies,github_clicks,linkedin_clicks,demo_clicks,cv_downloads,contact_submits,article_shares)
    select (e.created_at at time zone 'America/Santiago')::date,d.dimension,d.value,
      count(distinct session_hash) filter(where event_type='page_view'),
      count(*) filter (where event_type='page_view') as page_views,
      count(*) filter (where event_type='project_view') as project_views,
      count(*) filter (where event_type='post_view') as post_views,
      count(*) filter (where event_type='whatsapp_click') as whatsapp_clicks,
      count(*) filter (where event_type='email_click') as email_clicks,
      count(*) filter (where event_type='email_copy') as email_copies,
      count(*) filter (where event_type='github_click') as github_clicks,
      count(*) filter (where event_type='linkedin_click') as linkedin_clicks,
      count(*) filter (where event_type='demo_click') as demo_clicks,
      count(*) filter (where event_type='cv_download') as cv_downloads,
      count(*) filter (where event_type='contact_submit') as contact_submits,
      count(*) filter (where event_type='article_share') as article_shares
    from public.analytics_events e
      cross join lateral (values
        ('pathname',e.pathname),('referrer_domain',coalesce(e.referrer_domain,'direct')),
        ('device_type',coalesce(e.device_type,'unknown')),('browser_family',coalesce(e.browser_family,'unknown'))
      ) d(dimension,value)
    where e.created_at>=v_start and e.created_at<v_end group by 1,2,3;

  -- Only actual views contribute session sets. A contact conversion isn't a visit.
  insert into private.analytics_daily_sessions(date,session_hash,content_type,content_id)
    select distinct (created_at at time zone 'America/Santiago')::date,session_hash,'site',null::uuid
    from public.analytics_events where created_at>=v_start and created_at<v_end and event_type='page_view';
  insert into private.analytics_daily_sessions(date,session_hash,content_type,content_id)
    select distinct (created_at at time zone 'America/Santiago')::date,session_hash,
      case when project_id is not null then 'project' else 'post' end,coalesce(project_id,post_id)
    from public.analytics_events where created_at>=v_start and created_at<v_end
      and event_type in ('project_view','post_view') and coalesce(project_id,post_id) is not null;
end;
$$;
revoke all on function public.refresh_analytics(date,date) from public,anon,authenticated;
grant execute on function public.refresh_analytics(date,date) to service_role;

-- Updating a post invokes existing editorial media triggers. This parameterless,
-- private definer computes only a rank, instead of granting server callers broad
-- media/reference CRUD. It cannot accept a rank, identity, table or SQL from callers.
create function private.update_analytics_popularity()
returns void language plpgsql security definer set search_path='' as $$
declare v_today date := (now() at time zone 'America/Santiago')::date;
begin
  with rankings as (
    select p.id,row_number() over(order by sum(a.views) desc,p.id)::integer as rank
    from public.posts p join public.analytics_daily_content a on a.content_id=p.id and a.content_type='post'
    where p.status='published' and p.published_at<=now() and a.date between v_today-29 and v_today
    group by p.id having sum(a.views)>0
  ), desired as (
    select p.id,r.rank from public.posts p left join rankings r on r.id=p.id
  )
  update public.posts p set popular_rank=d.rank from desired d
    where d.id=p.id and p.popular_rank is distinct from d.rank;
end;
$$;
alter function private.update_analytics_popularity() owner to postgres;
revoke all on function private.update_analytics_popularity() from public,anon,authenticated;
grant execute on function private.update_analytics_popularity() to service_role;

create function public.maintain_analytics()
returns void language plpgsql security invoker set search_path='' as $$
declare v_today date := (now() at time zone 'America/Santiago')::date;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  perform public.refresh_analytics();
  -- 90 reporting dates raw; 400 reporting dates aggregates/session sets.
  delete from public.analytics_events where created_at < ((v_today-89)::timestamp at time zone 'America/Santiago');
  delete from public.analytics_daily where date<v_today-399;
  delete from public.analytics_daily_content where date<v_today-399;
  delete from private.analytics_daily_dimensions where date<v_today-399;
  delete from private.analytics_daily_sessions where date<v_today-399;
  perform private.update_analytics_popularity();
end;
$$;
revoke all on function public.maintain_analytics() from public,anon,authenticated;
grant execute on function public.maintain_analytics() to service_role;
select cron.schedule('portfolio-analytics-maintenance','7 * * * *',
  'set local role service_role; select public.maintain_analytics()');

create function public.get_analytics_report(p_from date,p_to date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_today date := (now() at time zone 'America/Santiago')::date; v_result jsonb;
begin
  if not private.is_portfolio_admin() then raise insufficient_privilege; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 or p_from<v_today-399 or p_to>v_today then
    raise exception 'Invalid analytics range' using errcode='22023';
  end if;
  select jsonb_build_object(
    'from',p_from,'to',p_to,'timezone','America/Santiago',
    'summary',jsonb_build_object(
      'page_views',coalesce((select sum(page_views) from public.analytics_daily where date between p_from and p_to),0),
      'project_views',coalesce((select sum(project_views) from public.analytics_daily where date between p_from and p_to),0),
      'post_views',coalesce((select sum(post_views) from public.analytics_daily where date between p_from and p_to),0),
      'whatsapp_clicks',coalesce((select sum(whatsapp_clicks) from public.analytics_daily where date between p_from and p_to),0),
      'email_clicks',coalesce((select sum(email_clicks) from public.analytics_daily where date between p_from and p_to),0),
      'email_copies',coalesce((select sum(email_copies) from public.analytics_daily where date between p_from and p_to),0),
      'github_clicks',coalesce((select sum(github_clicks) from public.analytics_daily where date between p_from and p_to),0),
      'linkedin_clicks',coalesce((select sum(linkedin_clicks) from public.analytics_daily where date between p_from and p_to),0),
      'demo_clicks',coalesce((select sum(demo_clicks) from public.analytics_daily where date between p_from and p_to),0),
      'cv_downloads',coalesce((select sum(cv_downloads) from public.analytics_daily where date between p_from and p_to),0),
      'contact_submits',coalesce((select sum(contact_submits) from public.analytics_daily where date between p_from and p_to),0),
      'article_shares',coalesce((select sum(article_shares) from public.analytics_daily where date between p_from and p_to),0),
      'unique_sessions',(select count(distinct session_hash) from private.analytics_daily_sessions
        where date between p_from and p_to and content_type='site')),
    'daily',(select coalesce(jsonb_agg(to_jsonb(a) order by a.date),'[]'::jsonb)
      from public.analytics_daily a where date between p_from and p_to),
    'top_pages',(select coalesce(jsonb_agg(to_jsonb(a) order by a.views desc,a.pathname),'[]'::jsonb) from
      (select value as pathname,sum(page_views) as views from private.analytics_daily_dimensions
        where dimension='pathname' and date between p_from and p_to group by value order by views desc,value limit 20) a),
    'top_content',(select coalesce(jsonb_agg(to_jsonb(a) order by a.views desc,a.content_type,a.content_id),'[]'::jsonb) from
      (select content_type,content_id,views,interactions from
        (select content_type,content_id,sum(views) as views,sum(interactions) as interactions,
          row_number() over(partition by content_type order by sum(views) desc,content_id) as position
          from public.analytics_daily_content where date between p_from and p_to group by content_type,content_id) ranked
        where position<=20) a),
    'dimensions',(select coalesce(jsonb_agg(to_jsonb(a) order by a.dimension,a.views desc,a.value),'[]'::jsonb) from
      (select dimension,value,sum(page_views) as views from private.analytics_daily_dimensions
        where dimension<>'pathname' and date between p_from and p_to group by dimension,value) a)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_analytics_report(date,date) from public,anon,authenticated;
grant execute on function public.get_analytics_report(date,date) to authenticated;
comment on function public.get_analytics_report(date,date) is 'Owner-only aggregate report. Distinct rotating hashes are approximate sessions, not cross-day people.';
comment on function public.refresh_analytics(date,date) is 'Idempotent inclusive reporting dates; max seven raw-backed dates; scheduled current/previous day.';
commit;
