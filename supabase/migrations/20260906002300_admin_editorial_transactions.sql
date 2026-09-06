-- F7: bounded editorial transactions. No new tables, grants on data, or SECURITY DEFINER.
-- JSON is transport only: explicit column allowlists write the existing relational schema.
begin;

create function public.save_project(p_id uuid, p_expected timestamptz, p_record jsonb, p_relations jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.projects%rowtype; next_row public.projects%rowtype; item jsonb;
begin
 if not private.is_portfolio_admin() then raise insufficient_privilege using message='Owner required'; end if;
 if p_id is null or p_record is null or p_relations is null or jsonb_typeof(p_record)<>'object' or jsonb_typeof(p_relations)<>'object'
  or octet_length(p_record::text)>1000000 or octet_length(p_relations::text)>1000000
  or exists(select 1 from jsonb_object_keys(p_record) k where not(k=any(array['title','slug','subtitle','summary','role','year','status','featured','published','published_at','sort_order','featured_image_asset_id','cover_image_asset_id','github_url','demo_url','documentation_url','problem','objective','solution','architecture','challenges','learnings','before_markdown','after_markdown','seo_title','seo_description','canonical_url','robots_policy','og_image_asset_id']::text[])))
  or exists(select 1 from jsonb_object_keys(p_relations) k where not(k=any(array['features','metrics','challenges','images','technologies']::text[])))
 then raise invalid_parameter_value using message='Invalid editorial payload'; end if;
 select * into current_row from public.projects where id=p_id for update;
 if found then
  if p_expected is null or current_row.updated_at<>p_expected then raise sqlstate 'PT409' using message='Editorial revision conflict'; end if;
  next_row:=jsonb_populate_record(current_row,p_record);
  update public.projects set (title,slug,subtitle,summary,role,year,status,featured,published,published_at,sort_order,featured_image_asset_id,cover_image_asset_id,github_url,demo_url,documentation_url,problem,objective,solution,architecture,challenges,learnings,before_markdown,after_markdown,seo_title,seo_description,canonical_url,robots_policy,og_image_asset_id)=(next_row.title,next_row.slug,next_row.subtitle,next_row.summary,next_row.role,next_row.year,next_row.status,next_row.featured,next_row.published,next_row.published_at,next_row.sort_order,next_row.featured_image_asset_id,next_row.cover_image_asset_id,next_row.github_url,next_row.demo_url,next_row.documentation_url,next_row.problem,next_row.objective,next_row.solution,next_row.architecture,next_row.challenges,next_row.learnings,next_row.before_markdown,next_row.after_markdown,next_row.seo_title,next_row.seo_description,next_row.canonical_url,next_row.robots_policy,next_row.og_image_asset_id) where id=p_id;
 else
  if p_expected is not null then raise sqlstate 'PT409' using message='Editorial record no longer exists'; end if;
  next_row:=jsonb_populate_record(null::public.projects,'{"status":"concept","featured":false,"published":false,"sort_order":0}'::jsonb || p_record);
  insert into public.projects(id,title,slug,subtitle,summary,role,year,status,featured,published,published_at,sort_order,featured_image_asset_id,cover_image_asset_id,github_url,demo_url,documentation_url,problem,objective,solution,architecture,challenges,learnings,before_markdown,after_markdown,seo_title,seo_description,canonical_url,robots_policy,og_image_asset_id) values(p_id,next_row.title,next_row.slug,next_row.subtitle,next_row.summary,next_row.role,next_row.year,next_row.status,next_row.featured,next_row.published,next_row.published_at,next_row.sort_order,next_row.featured_image_asset_id,next_row.cover_image_asset_id,next_row.github_url,next_row.demo_url,next_row.documentation_url,next_row.problem,next_row.objective,next_row.solution,next_row.architecture,next_row.challenges,next_row.learnings,next_row.before_markdown,next_row.after_markdown,next_row.seo_title,next_row.seo_description,next_row.canonical_url,next_row.robots_policy,next_row.og_image_asset_id);
 end if;
 if p_relations ? 'features' then
  if jsonb_typeof(p_relations->'features')<>'array' or jsonb_array_length(p_relations->'features')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'features') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['id','title','description','icon','sort_order']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;
   if exists(select 1 from public.project_features where id=(item->>'id')::uuid and project_id<>p_id) then raise insufficient_privilege using message='Relation identity belongs to another record'; end if;
  end loop;
  delete from public.project_features where project_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'features') loop
   item:='{"sort_order":0}'::jsonb || item || jsonb_build_object('id',coalesce(item->>'id',gen_random_uuid()::text));
   insert into public.project_features(project_id,id,title,description,icon,sort_order)
   select p_id,r.id,r.title,r.description,r.icon,r.sort_order from jsonb_populate_record(null::public.project_features,item) r;
  end loop;
 end if;
 if p_relations ? 'metrics' then
  if jsonb_typeof(p_relations->'metrics')<>'array' or jsonb_array_length(p_relations->'metrics')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'metrics') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['id','value','label','description','visible','sort_order']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;
   if exists(select 1 from public.project_metrics where id=(item->>'id')::uuid and project_id<>p_id) then raise insufficient_privilege using message='Relation identity belongs to another record'; end if;
  end loop;
  delete from public.project_metrics where project_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'metrics') loop
   item:='{"visible":false,"sort_order":0}'::jsonb || item || jsonb_build_object('id',coalesce(item->>'id',gen_random_uuid()::text));
   insert into public.project_metrics(project_id,id,value,label,description,visible,sort_order)
   select p_id,r.id,r.value,r.label,r.description,r.visible,r.sort_order from jsonb_populate_record(null::public.project_metrics,item) r;
  end loop;
 end if;
 if p_relations ? 'challenges' then
  if jsonb_typeof(p_relations->'challenges')<>'array' or jsonb_array_length(p_relations->'challenges')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'challenges') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['id','title','problem','solution','sort_order']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;
   if exists(select 1 from public.project_challenges where id=(item->>'id')::uuid and project_id<>p_id) then raise insufficient_privilege using message='Relation identity belongs to another record'; end if;
  end loop;
  delete from public.project_challenges where project_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'challenges') loop
   item:='{"sort_order":0}'::jsonb || item || jsonb_build_object('id',coalesce(item->>'id',gen_random_uuid()::text));
   insert into public.project_challenges(project_id,id,title,problem,solution,sort_order)
   select p_id,r.id,r.title,r.problem,r.solution,r.sort_order from jsonb_populate_record(null::public.project_challenges,item) r;
  end loop;
 end if;
 if p_relations ? 'images' then
  if jsonb_typeof(p_relations->'images')<>'array' or jsonb_array_length(p_relations->'images')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'images') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['id','asset_id','alt_text','caption','featured','sort_order']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;
   if exists(select 1 from public.project_images where id=(item->>'id')::uuid and project_id<>p_id) then raise insufficient_privilege using message='Relation identity belongs to another record'; end if;
  end loop;
  delete from public.project_images where project_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'images') loop
   item:='{"featured":false,"sort_order":0}'::jsonb || item || jsonb_build_object('id',coalesce(item->>'id',gen_random_uuid()::text));
   insert into public.project_images(project_id,id,asset_id,alt_text,caption,featured,sort_order,storage_path)
   select p_id,r.id,r.asset_id,r.alt_text,r.caption,r.featured,r.sort_order,'' from jsonb_populate_record(null::public.project_images,item) r;
  end loop;
 end if;
 if p_relations ? 'technologies' then
  if jsonb_typeof(p_relations->'technologies')<>'array' or jsonb_array_length(p_relations->'technologies')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'technologies') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['technology_id','sort_order']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;

  end loop;
  delete from public.project_technologies where project_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'technologies') loop
   item:='{"sort_order":0}'::jsonb || item ;
   insert into public.project_technologies(project_id,technology_id,sort_order)
   select p_id,r.technology_id,r.sort_order from jsonb_populate_record(null::public.project_technologies,item) r;
  end loop;
 end if;
 return (select to_jsonb(r) from public.projects r where id=p_id);
end; $$;
revoke all on function public.save_project(uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_project(uuid,timestamptz,jsonb,jsonb) to authenticated;

create function public.save_post(p_id uuid, p_expected timestamptz, p_record jsonb, p_relations jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.posts%rowtype; next_row public.posts%rowtype; item jsonb;
begin
 if not private.is_portfolio_admin() then raise insufficient_privilege using message='Owner required'; end if;
 if p_id is null or p_record is null or p_relations is null or jsonb_typeof(p_record)<>'object' or jsonb_typeof(p_relations)<>'object'
  or octet_length(p_record::text)>1000000 or octet_length(p_relations::text)>1000000
  or exists(select 1 from jsonb_object_keys(p_record) k where not(k=any(array['title','slug','excerpt','status','featured','published_at','reading_time','featured_image_asset_id','content_markdown','seo_title','seo_description','canonical_url','robots_policy','og_image_asset_id']::text[])))
  or exists(select 1 from jsonb_object_keys(p_relations) k where not(k=any(array['categories','tags']::text[])))
 then raise invalid_parameter_value using message='Invalid editorial payload'; end if;
 select * into current_row from public.posts where id=p_id for update;
 if found then
  if p_expected is null or current_row.updated_at<>p_expected then raise sqlstate 'PT409' using message='Editorial revision conflict'; end if;
  next_row:=jsonb_populate_record(current_row,p_record);
  update public.posts set (title,slug,excerpt,status,featured,published_at,reading_time,featured_image_asset_id,content_markdown,seo_title,seo_description,canonical_url,robots_policy,og_image_asset_id)=(next_row.title,next_row.slug,next_row.excerpt,next_row.status,next_row.featured,next_row.published_at,next_row.reading_time,next_row.featured_image_asset_id,next_row.content_markdown,next_row.seo_title,next_row.seo_description,next_row.canonical_url,next_row.robots_policy,next_row.og_image_asset_id) where id=p_id;
 else
  if p_expected is not null then raise sqlstate 'PT409' using message='Editorial record no longer exists'; end if;
  next_row:=jsonb_populate_record(null::public.posts,'{"status":"draft","featured":false,"content_markdown":""}'::jsonb || p_record);
  insert into public.posts(id,title,slug,excerpt,status,featured,published_at,reading_time,featured_image_asset_id,content_markdown,seo_title,seo_description,canonical_url,robots_policy,og_image_asset_id) values(p_id,next_row.title,next_row.slug,next_row.excerpt,next_row.status,next_row.featured,next_row.published_at,next_row.reading_time,next_row.featured_image_asset_id,next_row.content_markdown,next_row.seo_title,next_row.seo_description,next_row.canonical_url,next_row.robots_policy,next_row.og_image_asset_id);
 end if;
 if p_relations ? 'categories' then
  if jsonb_typeof(p_relations->'categories')<>'array' or jsonb_array_length(p_relations->'categories')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'categories') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['category_id']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;

  end loop;
  delete from public.post_category_relations where post_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'categories') loop
   item:='{}'::jsonb || item ;
   insert into public.post_category_relations(post_id,category_id)
   select p_id,r.category_id from jsonb_populate_record(null::public.post_category_relations,item) r;
  end loop;
 end if;
 if p_relations ? 'tags' then
  if jsonb_typeof(p_relations->'tags')<>'array' or jsonb_array_length(p_relations->'tags')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'tags') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['tag_id']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;

  end loop;
  delete from public.post_tags where post_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'tags') loop
   item:='{}'::jsonb || item ;
   insert into public.post_tags(post_id,tag_id)
   select p_id,r.tag_id from jsonb_populate_record(null::public.post_tags,item) r;
  end loop;
 end if;
 return (select to_jsonb(r) from public.posts r where id=p_id);
end; $$;
revoke all on function public.save_post(uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_post(uuid,timestamptz,jsonb,jsonb) to authenticated;

create function public.save_experience(p_id uuid, p_expected timestamptz, p_record jsonb, p_relations jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.experiences%rowtype; next_row public.experiences%rowtype; item jsonb;
begin
 if not private.is_portfolio_admin() then raise insufficient_privilege using message='Owner required'; end if;
 if p_id is null or p_record is null or p_relations is null or jsonb_typeof(p_record)<>'object' or jsonb_typeof(p_relations)<>'object'
  or octet_length(p_record::text)>1000000 or octet_length(p_relations::text)>1000000
  or exists(select 1 from jsonb_object_keys(p_record) k where not(k=any(array['position','organization','organization_url','start_date','end_date','current','summary','description_markdown','visible','sort_order']::text[])))
  or exists(select 1 from jsonb_object_keys(p_relations) k where not(k=any(array['highlights','projects','technologies']::text[])))
 then raise invalid_parameter_value using message='Invalid editorial payload'; end if;
 select * into current_row from public.experiences where id=p_id for update;
 if found then
  if p_expected is null or current_row.updated_at<>p_expected then raise sqlstate 'PT409' using message='Editorial revision conflict'; end if;
  next_row:=jsonb_populate_record(current_row,p_record);
  update public.experiences set (position,organization,organization_url,start_date,end_date,current,summary,description_markdown,visible,sort_order)=(next_row.position,next_row.organization,next_row.organization_url,next_row.start_date,next_row.end_date,next_row.current,next_row.summary,next_row.description_markdown,next_row.visible,next_row.sort_order) where id=p_id;
 else
  if p_expected is not null then raise sqlstate 'PT409' using message='Editorial record no longer exists'; end if;
  next_row:=jsonb_populate_record(null::public.experiences,'{"visible":false,"current":false,"sort_order":0}'::jsonb || p_record);
  insert into public.experiences(id,position,organization,organization_url,start_date,end_date,current,summary,description_markdown,visible,sort_order) values(p_id,next_row.position,next_row.organization,next_row.organization_url,next_row.start_date,next_row.end_date,next_row.current,next_row.summary,next_row.description_markdown,next_row.visible,next_row.sort_order);
 end if;
 if p_relations ? 'highlights' then
  if jsonb_typeof(p_relations->'highlights')<>'array' or jsonb_array_length(p_relations->'highlights')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'highlights') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['id','title','description','sort_order']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;
   if exists(select 1 from public.experience_highlights where id=(item->>'id')::uuid and experience_id<>p_id) then raise insufficient_privilege using message='Relation identity belongs to another record'; end if;
  end loop;
  delete from public.experience_highlights where experience_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'highlights') loop
   item:='{"sort_order":0}'::jsonb || item || jsonb_build_object('id',coalesce(item->>'id',gen_random_uuid()::text));
   insert into public.experience_highlights(experience_id,id,title,description,sort_order)
   select p_id,r.id,r.title,r.description,r.sort_order from jsonb_populate_record(null::public.experience_highlights,item) r;
  end loop;
 end if;
 if p_relations ? 'projects' then
  if jsonb_typeof(p_relations->'projects')<>'array' or jsonb_array_length(p_relations->'projects')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'projects') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['project_id']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;

  end loop;
  delete from public.experience_projects where experience_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'projects') loop
   item:='{}'::jsonb || item ;
   insert into public.experience_projects(experience_id,project_id)
   select p_id,r.project_id from jsonb_populate_record(null::public.experience_projects,item) r;
  end loop;
 end if;
 if p_relations ? 'technologies' then
  if jsonb_typeof(p_relations->'technologies')<>'array' or jsonb_array_length(p_relations->'technologies')>200 then raise invalid_parameter_value using message='Invalid relation collection'; end if;
  for item in select value from jsonb_array_elements(p_relations->'technologies') loop
   if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where not(k=any(array['technology_id']::text[]))) then raise invalid_parameter_value using message='Invalid relation fields'; end if;

  end loop;
  delete from public.experience_technologies where experience_id=p_id;
  for item in select value from jsonb_array_elements(p_relations->'technologies') loop
   item:='{}'::jsonb || item ;
   insert into public.experience_technologies(experience_id,technology_id)
   select p_id,r.technology_id from jsonb_populate_record(null::public.experience_technologies,item) r;
  end loop;
 end if;
 return (select to_jsonb(r) from public.experiences r where id=p_id);
end; $$;
revoke all on function public.save_experience(uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_experience(uuid,timestamptz,jsonb,jsonb) to authenticated;

-- Relation writes through REST also advance the parent's revision, so a CMS save cannot
-- silently replace a relation edited by another tab/client. Cascading parent deletion is a no-op.
create function private.touch_editorial_parent() returns trigger language plpgsql security invoker set search_path='' as $$
declare target uuid; previous_target uuid;
begin
 target:=(case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end ->>tg_argv[1])::uuid;
 execute format('update public.%I set updated_at=clock_timestamp() where id=$1',tg_argv[0]) using target;
 if tg_op='UPDATE' then
  previous_target:=(to_jsonb(old)->>tg_argv[1])::uuid;
  if previous_target<>target then execute format('update public.%I set updated_at=clock_timestamp() where id=$1',tg_argv[0]) using previous_target; end if;
 end if;
 return null;
end; $$;
revoke all on function private.touch_editorial_parent() from public,anon,authenticated;
create trigger touch_editorial_parent after insert or update or delete on public.project_features for each row execute function private.touch_editorial_parent('projects','project_id');
create trigger touch_editorial_parent after insert or update or delete on public.project_metrics for each row execute function private.touch_editorial_parent('projects','project_id');
create trigger touch_editorial_parent after insert or update or delete on public.project_challenges for each row execute function private.touch_editorial_parent('projects','project_id');
create trigger touch_editorial_parent after insert or update or delete on public.project_images for each row execute function private.touch_editorial_parent('projects','project_id');
create trigger touch_editorial_parent after insert or update or delete on public.project_technologies for each row execute function private.touch_editorial_parent('projects','project_id');
create trigger touch_editorial_parent after insert or update or delete on public.post_category_relations for each row execute function private.touch_editorial_parent('posts','post_id');
create trigger touch_editorial_parent after insert or update or delete on public.post_tags for each row execute function private.touch_editorial_parent('posts','post_id');
create trigger touch_editorial_parent after insert or update or delete on public.experience_highlights for each row execute function private.touch_editorial_parent('experiences','experience_id');
create trigger touch_editorial_parent after insert or update or delete on public.experience_projects for each row execute function private.touch_editorial_parent('experiences','experience_id');
create trigger touch_editorial_parent after insert or update or delete on public.experience_technologies for each row execute function private.touch_editorial_parent('experiences','experience_id');

commit;
