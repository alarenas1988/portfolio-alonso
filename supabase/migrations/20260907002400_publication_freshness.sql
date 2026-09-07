begin;

-- F11: preserve publication freshness without changing authorization or grants.
create or replace function public.edge_request_build(
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
  -- A different request represents a fresh snapshot; do not reuse an in-flight build.
  -- Exact request retries above remain idempotent, while distinct requests share cooldown.
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

commit;
