begin;

grant select (id,role,active) on public.admin_profiles to service_role;
grant select (id) on public.experiences,public.site_settings,public.media_assets,
  public.documents,public.contact_settings,public.technologies to service_role;

create function public.edge_request_build(
  p_request_id uuid, p_actor uuid, p_trigger text,
  p_entity_type text default null, p_entity_id uuid default null, p_retry_of uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_build public.site_builds%rowtype; v_exists boolean;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  if not exists(select 1 from public.admin_profiles where id=p_actor and active and role='owner') then
    return jsonb_build_object('outcome','forbidden');
  end if;
  if p_request_id is null or p_trigger not in ('manual','content_change','retry')
    or (p_entity_type is null) <> (p_entity_id is null)
    or (p_trigger='retry') <> (p_retry_of is not null) then raise check_violation; end if;
  -- One publication decision at a time, including different request UUIDs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portfolio:publish',0));
  select * into v_build from public.site_builds where request_id=p_request_id;
  if found then
    if (v_build.trigger_type,v_build.entity_type,v_build.entity_id,v_build.retry_of)
      is distinct from (p_trigger,p_entity_type,p_entity_id,p_retry_of) then
      return jsonb_build_object('outcome','conflict');
    end if;
    return jsonb_build_object('outcome','accepted','build_id',v_build.id,'status',v_build.status,'dispatch',false);
  end if;
  if p_entity_type is not null then
    v_exists := case p_entity_type
      when 'project' then exists(select 1 from public.projects where id=p_entity_id)
      when 'post' then exists(select 1 from public.posts where id=p_entity_id)
      when 'experience' then exists(select 1 from public.experiences where id=p_entity_id)
      when 'settings' then exists(select 1 from public.site_settings where id=p_entity_id)
      when 'media' then exists(select 1 from public.media_assets where id=p_entity_id)
      when 'document' then exists(select 1 from public.documents where id=p_entity_id)
      when 'profile' then p_entity_id=p_actor
      when 'contact' then exists(select 1 from public.contact_settings where id=p_entity_id)
      when 'technology' then exists(select 1 from public.technologies where id=p_entity_id)
      else false end;
    if not v_exists then return jsonb_build_object('outcome','invalid'); end if;
  end if;
  if p_retry_of is not null and not exists(select 1 from public.site_builds where id=p_retry_of and status='failed') then
    return jsonb_build_object('outcome','invalid');
  end if;
  select * into v_build from public.site_builds where status in ('queued','building') order by created_at desc limit 1;
  if found then
    return jsonb_build_object('outcome','accepted','build_id',v_build.id,'status',v_build.status,'dispatch',false);
  end if;
  if exists(select 1 from public.site_builds where created_at>now()-interval '30 seconds') then
    return jsonb_build_object('outcome','limited','retry_after',30);
  end if;
  insert into public.site_builds(request_id,trigger_type,entity_type,entity_id,retry_of)
    values(p_request_id,p_trigger,p_entity_type,p_entity_id,p_retry_of) returning * into v_build;
  insert into public.admin_activity(admin_id,action,entity_type,entity_id)
    values(p_actor,'publish_requested','site_build',v_build.id);
  return jsonb_build_object('outcome','accepted','build_id',v_build.id,'status','queued','dispatch',true);
end;
$$;
revoke all on function public.edge_request_build(uuid,uuid,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.edge_request_build(uuid,uuid,text,text,uuid,uuid) to service_role;

create function public.edge_dispatch_failed(p_build_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  if p_reason not in ('dispatch_failed','dispatch_timeout') then raise check_violation; end if;
  update public.site_builds set status='failed',failure_reason=p_reason,completed_at=now()
    where id=p_build_id and status='queued' and github_run_id is null;
end;
$$;
revoke all on function public.edge_dispatch_failed(uuid,text) from public,anon,authenticated;
grant execute on function public.edge_dispatch_failed(uuid,text) to service_role;

create function public.edge_update_build_status(
  p_build_id uuid, p_status text, p_run_id bigint, p_run_attempt integer,
  p_commit_sha text, p_run_url text, p_started_at timestamptz,
  p_completed_at timestamptz default null, p_deployment_id text default null,
  p_failure_reason text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_build public.site_builds%rowtype;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  select * into v_build from public.site_builds where id=p_build_id for update;
  if not found then return jsonb_build_object('outcome','missing'); end if;
  if p_status not in ('building','success','failed') or p_run_id<=0 or p_run_attempt<=0
    or p_commit_sha !~ '^([a-f0-9]{40}|[a-f0-9]{64})$'
    or p_started_at is null or p_started_at<v_build.created_at-interval '5 minutes'
    or p_started_at>now()+interval '30 seconds'
    or p_completed_at>now()+interval '30 seconds'
    or p_completed_at<p_started_at then return jsonb_build_object('outcome','invalid'); end if;
  if v_build.github_run_id is not null and
    (v_build.github_run_id,v_build.github_run_attempt,v_build.commit_sha,v_build.started_at)
      is distinct from (p_run_id,p_run_attempt,p_commit_sha,p_started_at) then
    return jsonb_build_object('outcome','conflict');
  end if;
  if v_build.status=p_status then
    if (v_build.github_run_id,v_build.github_run_attempt,v_build.commit_sha,v_build.started_at,
      v_build.completed_at,v_build.deployment_id,v_build.failure_reason)
      is not distinct from (p_run_id,p_run_attempt,p_commit_sha,p_started_at,
      p_completed_at,p_deployment_id,p_failure_reason) then
      return jsonb_build_object('outcome','accepted','status',v_build.status,'duplicate',true);
    end if;
    return jsonb_build_object('outcome','conflict');
  end if;
  if v_build.status in ('success','failed') then return jsonb_build_object('outcome','conflict'); end if;
  update public.site_builds set status=p_status,github_run_id=p_run_id,github_run_attempt=p_run_attempt,
    commit_sha=p_commit_sha,github_run_url=p_run_url,started_at=p_started_at,completed_at=p_completed_at,
    deployment_id=p_deployment_id,failure_reason=p_failure_reason where id=p_build_id;
  return jsonb_build_object('outcome','accepted','status',p_status,'duplicate',false);
end;
$$;
revoke all on function public.edge_update_build_status(uuid,text,bigint,integer,text,text,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.edge_update_build_status(uuid,text,bigint,integer,text,text,timestamptz,timestamptz,text,text) to service_role;

commit;
