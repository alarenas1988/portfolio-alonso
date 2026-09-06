begin;

-- F9: invoker RPCs. Only the server role can execute; no client RLS/policy changes.
grant select on public.contact_messages, public.analytics_events to service_role;
grant select (form_enabled) on public.contact_settings to service_role;
grant select (id, slug, published, published_at, status) on public.projects to service_role;
grant select (id, slug, status, published_at) on public.posts to service_role;

create index rate_limit_buckets_expiry on private.rate_limit_buckets (expires_at);

create function private.consume_edge_limit(p_hash text, p_action text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_start timestamptz; v_hits integer;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  if p_hash !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 10000
    or p_seconds not between 1 and 3600 then raise check_violation; end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_seconds) * p_seconds);
  delete from private.rate_limit_buckets where expires_at <= now();
  insert into private.rate_limit_buckets(key_hash,action,window_start,expires_at,hits)
  values (p_hash,p_action,v_start,v_start+make_interval(secs=>p_seconds),1)
  on conflict (key_hash,action,window_start) do update
    set hits=least(private.rate_limit_buckets.hits+1,p_limit+1)
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
revoke all on function private.consume_edge_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function private.consume_edge_limit(text,text,integer,integer) to service_role;

create function public.edge_record_contact(
  p_submission_id uuid, p_name text, p_email text, p_subject text, p_message text,
  p_origin_hash text, p_global_hash text, p_session_hash text,
  p_global_limit integer default 100, p_notify boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_previous public.contact_messages%rowtype;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  if p_submission_id is null or length(p_name) not between 2 and 120
    or length(p_subject) not between 3 and 200 or length(p_message) not between 20 and 5000
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_session_hash !~ '^[a-f0-9]{64}$' then raise check_violation; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('contact:'||p_submission_id,0));
  select * into v_previous from public.contact_messages where submission_id=p_submission_id;
  if found then
    if (v_previous.name,v_previous.email,v_previous.subject,v_previous.message)
      is distinct from (p_name,p_email,p_subject,p_message)
      or v_previous.created_at < now()-interval '24 hours' then
      return jsonb_build_object('outcome','conflict');
    end if;
    return jsonb_build_object('outcome','accepted','created',false);
  end if;
  if not coalesce((select form_enabled from public.contact_settings),false) then
    return jsonb_build_object('outcome','unavailable');
  end if;
  -- A global ceiling bounds storage even when clients spoof or rotate network signals.
  if not private.consume_edge_limit(p_global_hash,'contact',p_global_limit,3600)
    or not private.consume_edge_limit(p_origin_hash,'contact',5,900) then
    return jsonb_build_object('outcome','limited','retry_after',900);
  end if;
  insert into public.contact_messages(submission_id,name,email,subject,message,notification_status)
    values(p_submission_id,p_name,p_email,p_subject,p_message,case when p_notify then 'pending' else 'disabled' end);
  -- Server-authored conversion; browser track-event cannot forge contact conversions.
  insert into public.analytics_events(event_id,session_hash,event_type,pathname)
    values(p_submission_id,p_session_hash,'contact_submit','/portfolio-alonso/contacto/');
  return jsonb_build_object('outcome','accepted','created',true);
end;
$$;
revoke all on function public.edge_record_contact(uuid,text,text,text,text,text,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.edge_record_contact(uuid,text,text,text,text,text,text,text,integer,boolean) to service_role;

create function public.edge_record_event(
  p_event_id uuid, p_session_hash text, p_event_type text, p_pathname text,
  p_origin_hash text, p_global_hash text, p_project_id uuid default null,
  p_post_id uuid default null, p_referrer text default null,
  p_device text default 'unknown', p_browser text default 'unknown'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_previous public.analytics_events%rowtype; v_slug text;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  if p_event_type='contact_submit' or p_event_type not in
    ('page_view','project_view','post_view','whatsapp_click','email_click','email_copy',
     'github_click','linkedin_click','demo_click','cv_download','article_share')
    or p_event_id is null or p_session_hash !~ '^[a-f0-9]{64}$' then raise check_violation; end if;
  if p_project_id is not null then
    select slug into v_slug from public.projects where id=p_project_id and published
      and status<>'archived' and published_at<=now();
    if not found or p_pathname <> '/portfolio-alonso/proyectos/'||v_slug||'/' then
      return jsonb_build_object('outcome','invalid');
    end if;
  elsif p_post_id is not null then
    select slug into v_slug from public.posts where id=p_post_id and status='published' and published_at<=now();
    if not found or p_pathname <> '/portfolio-alonso/blog/'||v_slug||'/' then
      return jsonb_build_object('outcome','invalid');
    end if;
  elsif p_pathname not in ('/portfolio-alonso/','/portfolio-alonso/proyectos/',
    '/portfolio-alonso/blog/','/portfolio-alonso/sobre-mi/','/portfolio-alonso/contacto/') then
    return jsonb_build_object('outcome','invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event:'||p_event_id,0));
  select * into v_previous from public.analytics_events where event_id=p_event_id;
  if found then
    if (v_previous.session_hash,v_previous.event_type,v_previous.pathname,v_previous.project_id,v_previous.post_id)
      is distinct from (p_session_hash,p_event_type,p_pathname,p_project_id,p_post_id) then
      return jsonb_build_object('outcome','conflict');
    end if;
    return jsonb_build_object('outcome','accepted','created',false);
  end if;
  if not private.consume_edge_limit(p_global_hash,'analytics',10000,3600)
    or not private.consume_edge_limit(p_origin_hash,'analytics',120,60)
    or not private.consume_edge_limit(p_session_hash,'analytics',60,60) then
    return jsonb_build_object('outcome','limited','retry_after',60);
  end if;
  insert into public.analytics_events(event_id,session_hash,event_type,pathname,project_id,post_id,referrer_domain,device_type,browser_family)
    values(p_event_id,p_session_hash,p_event_type,p_pathname,p_project_id,p_post_id,p_referrer,p_device,p_browser);
  return jsonb_build_object('outcome','accepted','created',true);
end;
$$;
revoke all on function public.edge_record_event(uuid,text,text,text,text,text,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.edge_record_event(uuid,text,text,text,text,text,uuid,uuid,text,text,text) to service_role;

-- Expired counters never authorize requests; traffic prunes them immediately.
-- Platform cron also prunes during idle periods (no analytics aggregation).
create extension if not exists pg_cron;
select cron.schedule('portfolio-rate-limit-retention','*/15 * * * *',
  'delete from private.rate_limit_buckets where expires_at <= now()');

commit;
