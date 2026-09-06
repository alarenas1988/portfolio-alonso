-- Local pgTAP fixtures live only inside this rollback transaction.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('portfolio-f5-test-only:' || label)::uuid
$$;
select ok((select relrowsecurity from pg_class where oid = 'public.site_settings'::regclass), 'site_settings: RLS enabled');
select ok(not has_table_privilege('anon', 'public.site_settings', 'INSERT,UPDATE,DELETE'), 'site_settings: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.contact_settings'::regclass), 'contact_settings: RLS enabled');
select ok(not has_table_privilege('anon', 'public.contact_settings', 'INSERT,UPDATE,DELETE'), 'contact_settings: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.social_links'::regclass), 'social_links: RLS enabled');
select ok(not has_table_privilege('anon', 'public.social_links', 'INSERT,UPDATE,DELETE'), 'social_links: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.projects'::regclass), 'projects: RLS enabled');
select ok(not has_table_privilege('anon', 'public.projects', 'INSERT,UPDATE,DELETE'), 'projects: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.project_features'::regclass), 'project_features: RLS enabled');
select ok(not has_table_privilege('anon', 'public.project_features', 'INSERT,UPDATE,DELETE'), 'project_features: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.project_images'::regclass), 'project_images: RLS enabled');
select ok(not has_table_privilege('anon', 'public.project_images', 'INSERT,UPDATE,DELETE'), 'project_images: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.project_metrics'::regclass), 'project_metrics: RLS enabled');
select ok(not has_table_privilege('anon', 'public.project_metrics', 'INSERT,UPDATE,DELETE'), 'project_metrics: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.project_challenges'::regclass), 'project_challenges: RLS enabled');
select ok(not has_table_privilege('anon', 'public.project_challenges', 'INSERT,UPDATE,DELETE'), 'project_challenges: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.project_technologies'::regclass), 'project_technologies: RLS enabled');
select ok(not has_table_privilege('anon', 'public.project_technologies', 'INSERT,UPDATE,DELETE'), 'project_technologies: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.posts'::regclass), 'posts: RLS enabled');
select ok(not has_table_privilege('anon', 'public.posts', 'INSERT,UPDATE,DELETE'), 'posts: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.post_categories'::regclass), 'post_categories: RLS enabled');
select ok(not has_table_privilege('anon', 'public.post_categories', 'INSERT,UPDATE,DELETE'), 'post_categories: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.post_category_relations'::regclass), 'post_category_relations: RLS enabled');
select ok(not has_table_privilege('anon', 'public.post_category_relations', 'INSERT,UPDATE,DELETE'), 'post_category_relations: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.tags'::regclass), 'tags: RLS enabled');
select ok(not has_table_privilege('anon', 'public.tags', 'INSERT,UPDATE,DELETE'), 'tags: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.post_tags'::regclass), 'post_tags: RLS enabled');
select ok(not has_table_privilege('anon', 'public.post_tags', 'INSERT,UPDATE,DELETE'), 'post_tags: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.experiences'::regclass), 'experiences: RLS enabled');
select ok(not has_table_privilege('anon', 'public.experiences', 'INSERT,UPDATE,DELETE'), 'experiences: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.experience_highlights'::regclass), 'experience_highlights: RLS enabled');
select ok(not has_table_privilege('anon', 'public.experience_highlights', 'INSERT,UPDATE,DELETE'), 'experience_highlights: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.experience_projects'::regclass), 'experience_projects: RLS enabled');
select ok(not has_table_privilege('anon', 'public.experience_projects', 'INSERT,UPDATE,DELETE'), 'experience_projects: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.experience_technologies'::regclass), 'experience_technologies: RLS enabled');
select ok(not has_table_privilege('anon', 'public.experience_technologies', 'INSERT,UPDATE,DELETE'), 'experience_technologies: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.technologies'::regclass), 'technologies: RLS enabled');
select ok(not has_table_privilege('anon', 'public.technologies', 'INSERT,UPDATE,DELETE'), 'technologies: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.specialties'::regclass), 'specialties: RLS enabled');
select ok(not has_table_privilege('anon', 'public.specialties', 'INSERT,UPDATE,DELETE'), 'specialties: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.work_principles'::regclass), 'work_principles: RLS enabled');
select ok(not has_table_privilege('anon', 'public.work_principles', 'INSERT,UPDATE,DELETE'), 'work_principles: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.impact_metrics'::regclass), 'impact_metrics: RLS enabled');
select ok(not has_table_privilege('anon', 'public.impact_metrics', 'INSERT,UPDATE,DELETE'), 'impact_metrics: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.media_assets'::regclass), 'media_assets: RLS enabled');
select ok(not has_table_privilege('anon', 'public.media_assets', 'INSERT,UPDATE,DELETE'), 'media_assets: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.media_references'::regclass), 'media_references: RLS enabled');
select ok(not has_table_privilege('anon', 'public.media_references', 'INSERT,UPDATE,DELETE'), 'media_references: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.documents'::regclass), 'documents: RLS enabled');
select ok(not has_table_privilege('anon', 'public.documents', 'INSERT,UPDATE,DELETE'), 'documents: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_profiles'::regclass), 'admin_profiles: RLS enabled');
select ok(not has_table_privilege('anon', 'public.admin_profiles', 'INSERT,UPDATE,DELETE'), 'admin_profiles: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.contact_messages'::regclass), 'contact_messages: RLS enabled');
select ok(not has_table_privilege('anon', 'public.contact_messages', 'INSERT,UPDATE,DELETE'), 'contact_messages: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.analytics_events'::regclass), 'analytics_events: RLS enabled');
select ok(not has_table_privilege('anon', 'public.analytics_events', 'INSERT,UPDATE,DELETE'), 'analytics_events: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.analytics_daily'::regclass), 'analytics_daily: RLS enabled');
select ok(not has_table_privilege('anon', 'public.analytics_daily', 'INSERT,UPDATE,DELETE'), 'analytics_daily: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.analytics_daily_content'::regclass), 'analytics_daily_content: RLS enabled');
select ok(not has_table_privilege('anon', 'public.analytics_daily_content', 'INSERT,UPDATE,DELETE'), 'analytics_daily_content: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_activity'::regclass), 'admin_activity: RLS enabled');
select ok(not has_table_privilege('anon', 'public.admin_activity', 'INSERT,UPDATE,DELETE'), 'admin_activity: anon has no write grants');
select ok((select relrowsecurity from pg_class where oid = 'public.site_builds'::regclass), 'site_builds: RLS enabled');
select ok(not has_table_privilege('anon', 'public.site_builds', 'INSERT,UPDATE,DELETE'), 'site_builds: anon has no write grants');
select ok(has_function_privilege('anon','public.get_public_snapshot()','EXECUTE') and has_function_privilege('authenticated','public.get_public_snapshot()','EXECUTE'), 'F6 grants public snapshot execution');
select ok((select count(*) from pg_policies where schemaname in ('public','private')) > 0, 'F6 policies installed');
select ok(not has_schema_privilege('anon','private','USAGE') and has_schema_privilege('authenticated','private','USAGE'), 'Private schema usage restricted to authenticated backend access');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not exists (select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='p')), 'Every application table has a PK');
select is((select count(*) from public.site_settings), 1::bigint, 'Singleton settings seed');
select is((select count(*) from public.contact_settings), 1::bigint, 'Singleton contact seed');
select is((select count(*) from public.post_categories), 9::bigint, 'Nine approved blog categories');
select is((select count(*) from public.specialties), 6::bigint, 'Six approved specialties');
select is((select count(*) from public.work_principles), 4::bigint, 'Four approved principles');
select is((select count(*) from public.admin_profiles), 0::bigint, 'No owner seeded');
select is((select count(*) from public.projects) + (select count(*) from public.experiences) + (select count(*) from public.impact_metrics), 0::bigint, 'No invented achievements');
select throws_ok($test$insert into public.site_settings(site_name,brand_short) values ('Other','XX')$test$, '23505', null, 'Second settings row rejected');
select throws_ok($test$insert into public.contact_settings(singleton) values (false)$test$, '23514', null, 'Singleton false bypass rejected');
select throws_ok($test$update public.site_settings set timezone='Not/A_Timezone'$test$, '23514', null, 'Invalid timezone rejected');
select throws_ok($test$update public.site_settings set robots_policy='allow-all'$test$, '23514', null, 'Invalid robots policy rejected');
select throws_ok($test$update public.contact_settings set email_visible=true$test$, '23514', null, 'Visible email must exist');
select throws_ok($test$update public.contact_settings set whatsapp_number='123'$test$, '23514', null, 'Invalid WhatsApp rejected');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','Upper')$test$, '23514', null, 'Unsafe slug rejected: Upper');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','con-acénto')$test$, '23514', null, 'Unsafe slug rejected: con-acénto');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','has space')$test$, '23514', null, 'Unsafe slug rejected: has space');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','with_underscore')$test$, '23514', null, 'Unsafe slug rejected: with_underscore');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','-leading')$test$, '23514', null, 'Unsafe slug rejected: -leading');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','trailing-')$test$, '23514', null, 'Unsafe slug rejected: trailing-');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','double--dash')$test$, '23514', null, 'Unsafe slug rejected: double--dash');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','')$test$, '23514', null, 'Unsafe slug rejected: ');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$test$, '23514', null, 'Unsafe slug rejected: aaaaaaaaaaaaaaaaaaaaaaaaa');
insert into public.projects (id,title,slug,status,published,published_at)
values
(pg_temp.fixture_id('project') , 'Public fixture','test-only-public-project','production',true,now()-interval '1 day'),
(pg_temp.fixture_id('private-project'), 'PRIVATE_SENTINEL','test-only-private-project','concept',false,null),
(pg_temp.fixture_id('archived-project'), 'PRIVATE_SENTINEL','test-only-archived-project','archived',true,now()),
(pg_temp.fixture_id('future-project'), 'PRIVATE_SENTINEL','test-only-future-project','completed',true,now()+interval '1 day');
insert into public.posts(id,title,slug,status,published_at,content_markdown) values
(pg_temp.fixture_id('post'),'Public fixture','test-only-public-post','published',now()-interval '1 day','Public fixture body'),
(pg_temp.fixture_id('private-post'),'PRIVATE_SENTINEL','test-only-private-post','draft',null,'PRIVATE_SENTINEL'),
(pg_temp.fixture_id('future-post'),'PRIVATE_SENTINEL','test-only-future-post','published',now()+interval '1 day','PRIVATE_SENTINEL'),
(pg_temp.fixture_id('archived-post'),'PRIVATE_SENTINEL','test-only-archived-post','archived',now(),'PRIVATE_SENTINEL');
insert into public.technologies(id,name,slug,category,visible) values
(pg_temp.fixture_id('technology'),'Fixture visible','test-only-tech','testing',true),
(pg_temp.fixture_id('private-technology'),'PRIVATE_SENTINEL','test-only-private-tech','testing',false);
insert into public.experiences(id,position,organization,start_date,visible) values
(pg_temp.fixture_id('experience'),'Fixture','Test only','2020-01-01',true),
(pg_temp.fixture_id('private-experience'),'PRIVATE_SENTINEL','Test only','2020-01-01',false);
insert into public.media_assets(id,storage_bucket,storage_path,public_url,filename,mime_type,file_size,visibility)
values
(pg_temp.fixture_id('image'),'fixture-public','test-only.png','https://example.com/test-only.png','test-only.png','image/png',100,'public'),
(pg_temp.fixture_id('private-image'),'fixture-private','private.png','https://example.com/PRIVATE_SENTINEL.png','private.png','image/png',100,'private'),
(pg_temp.fixture_id('unused-image'),'fixture-public','unused.png','https://example.com/unused.png','unused.png','image/png',100,'public'),
(pg_temp.fixture_id('pdf'),'fixture-public','test-only.pdf','https://example.com/test-only.pdf','test-only.pdf','application/pdf',100,'public');
update public.projects set featured_image_asset_id=pg_temp.fixture_id('image'), cover_image_asset_id=pg_temp.fixture_id('private-image') where id=pg_temp.fixture_id('project');
insert into public.project_images(id,project_id,asset_id,alt_text) values
(pg_temp.fixture_id('gallery'),pg_temp.fixture_id('project'),pg_temp.fixture_id('image'),'Public fixture image'),
(pg_temp.fixture_id('private-gallery'),pg_temp.fixture_id('project'),pg_temp.fixture_id('private-image'),'PRIVATE_SENTINEL');
insert into public.documents(id,title,asset_id,active) values (pg_temp.fixture_id('cv'),'Fixture CV',pg_temp.fixture_id('pdf'),true);
update public.contact_settings set cv_enabled=true;
update public.contact_settings set email='PRIVATE_SENTINEL@example.com', whatsapp_number='+56912345678', whatsapp_default_message='PRIVATE_SENTINEL', whatsapp_cta_label='PRIVATE_SENTINEL';
insert into public.social_links(platform,label,url,visible) values ('test','Fixture','https://example.com',true), ('hidden','PRIVATE_SENTINEL','https://example.com',false);
insert into public.project_features(id,project_id,title) values (pg_temp.fixture_id('feature'),pg_temp.fixture_id('project'),'Fixture'),(pg_temp.fixture_id('hidden-feature'),pg_temp.fixture_id('private-project'),'PRIVATE_SENTINEL');
insert into public.project_challenges(project_id,title) values (pg_temp.fixture_id('project'),'Fixture'),(pg_temp.fixture_id('private-project'),'PRIVATE_SENTINEL');
insert into public.project_metrics(project_id,value,label,visible) values (pg_temp.fixture_id('project'),'-70%','Fixture',true),(pg_temp.fixture_id('project'),'PRIVATE_SENTINEL','Hidden',false);
insert into public.project_technologies(project_id,technology_id) values (pg_temp.fixture_id('project'),pg_temp.fixture_id('technology')),(pg_temp.fixture_id('project'),pg_temp.fixture_id('private-technology')),(pg_temp.fixture_id('private-project'),pg_temp.fixture_id('technology'));
insert into public.tags(id,name,slug) values (pg_temp.fixture_id('tag'),'Fixture','test-only-tag'),(pg_temp.fixture_id('private-tag'),'PRIVATE_SENTINEL','test-only-private-tag');
insert into public.post_tags(post_id,tag_id) values (pg_temp.fixture_id('post'),pg_temp.fixture_id('tag')),(pg_temp.fixture_id('private-post'),pg_temp.fixture_id('private-tag'));
insert into public.post_categories(id,name,slug,visible) values (pg_temp.fixture_id('private-category'),'PRIVATE_SENTINEL','test-only-hidden',false);
insert into public.post_category_relations(post_id,category_id) values (pg_temp.fixture_id('post'),(select id from public.post_categories where slug='datos')),(pg_temp.fixture_id('post'),pg_temp.fixture_id('private-category'));
insert into public.experience_highlights(experience_id,title) values (pg_temp.fixture_id('experience'),'Fixture'),(pg_temp.fixture_id('private-experience'),'PRIVATE_SENTINEL');
insert into public.experience_projects(experience_id,project_id) values (pg_temp.fixture_id('experience'),pg_temp.fixture_id('project')),(pg_temp.fixture_id('experience'),pg_temp.fixture_id('private-project')),(pg_temp.fixture_id('private-experience'),pg_temp.fixture_id('project'));
insert into public.experience_technologies(experience_id,technology_id) values (pg_temp.fixture_id('experience'),pg_temp.fixture_id('technology')),(pg_temp.fixture_id('experience'),pg_temp.fixture_id('private-technology'));
insert into public.contact_messages(submission_id,name,email,subject,message) values (pg_temp.fixture_id('submission'),'PRIVATE_SENTINEL','private@example.com','Private subject','PRIVATE_SENTINEL');
insert into public.analytics_events(event_id,session_hash,event_type,pathname,project_id) values (pg_temp.fixture_id('event'),repeat('a',64),'project_view','/test-only/',pg_temp.fixture_id('project'));
insert into public.site_builds(id,request_id,trigger_type) values (pg_temp.fixture_id('build'),pg_temp.fixture_id('request'),'manual');
insert into public.admin_activity(action,entity_type,entity_id,metadata) values ('test','project',pg_temp.fixture_id('project'),'{"note":"PRIVATE_SENTINEL"}');
select throws_ok($test$insert into public.projects(title,slug) values ('Fixture','test-only-public-project')$test$, '23505', null, 'Project slug unique');
select throws_ok($test$insert into public.projects(title,slug,status) values ('Fixture','invalid-status','draft')$test$, '23514', null, 'Project status separate from publication');
select throws_ok($test$insert into public.projects(title,slug,published) values ('Fixture','missing-date',true)$test$, '23514', null, 'Published project requires timestamp');
select throws_ok($test$insert into public.posts(title,slug,status) values ('Fixture','missing-date','published')$test$, '23514', null, 'Published post requires timestamp');
select throws_ok($test$insert into public.posts(title,slug,status) values ('Fixture','invalid-state','production')$test$, '23514', null, 'Post states constrained');
select throws_ok($test$update public.posts set popular_rank=0 where id=pg_temp.fixture_id('post')$test$, '23514', null, 'Popular rank positive');
select throws_ok($test$update public.projects set sort_order=-1 where id=pg_temp.fixture_id('project')$test$, '23514', null, 'Order nonnegative');
select throws_ok($test$update public.experiences set end_date='2019-01-01' where id=pg_temp.fixture_id('experience')$test$, '23514', null, 'Experience date range');
select throws_ok($test$update public.experiences set current=true,end_date='2021-01-01' where id=pg_temp.fixture_id('experience')$test$, '23514', null, 'Current experience cannot have end date');
select throws_ok($test$insert into public.project_features(project_id,title) values (pg_temp.fixture_id('missing'),'Orphan')$test$, '23503', null, 'Missing parent FK rejected');
select throws_ok($test$insert into public.project_technologies(project_id,technology_id) values (pg_temp.fixture_id('project'),pg_temp.fixture_id('technology'))$test$, '23505', null, 'Composite join uniqueness');
select throws_ok($test$delete from public.technologies where id=pg_temp.fixture_id('technology')$test$, '23503', null, 'Reusable technology protected');
select throws_ok($test$delete from public.media_assets where id=pg_temp.fixture_id('image')$test$, '23503', null, 'Referenced asset protected');
select throws_ok($test$update public.media_assets set public_url='https://example.com/replaced.png' where id=pg_temp.fixture_id('image')$test$, '23514', null, 'Asset URL immutable');
select throws_ok($test$insert into public.documents(title,asset_id,active) values ('Second CV',pg_temp.fixture_id('pdf'),true)$test$, '23505', null, 'Single active CV');
select throws_ok($test$insert into public.documents(title,asset_id) values ('Not PDF',pg_temp.fixture_id('image'))$test$, '23514', null, 'CV requires PDF');
select is((select featured_image_url from public.projects where id=pg_temp.fixture_id('project')), 'https://example.com/test-only.png', 'Image URL derived from FK');
update public.projects set featured_image_url='https://example.com/forged.png' where id=pg_temp.fixture_id('project');
select is((select featured_image_url from public.projects where id=pg_temp.fixture_id('project')), 'https://example.com/test-only.png', 'Cannot override derived image URL');
select is((select cv_url from public.site_settings), 'https://example.com/test-only.pdf', 'CV URL synchronized');
update public.site_settings set cv_url='https://example.com/forged.pdf';
select is((select cv_url from public.site_settings), 'https://example.com/test-only.pdf', 'Cannot override derived CV');
select ok(exists(select 1 from public.media_references where project_id=pg_temp.fixture_id('project') and asset_id=pg_temp.fixture_id('image')), 'Direct FK registered as media reference');
select throws_ok($test$insert into public.media_references(asset_id,project_id,field) values (pg_temp.fixture_id('image'),pg_temp.fixture_id('project'),'featured_image_asset_id')$test$, '23505', null, 'Media references unique');
select throws_ok($test$insert into public.media_references(asset_id,project_id,post_id,field) values (pg_temp.fixture_id('image'),pg_temp.fixture_id('project'),pg_temp.fixture_id('post'),'content_markdown')$test$, '23514', null, 'Media reference has exactly one parent');
select lives_ok($test$insert into public.media_references(asset_id,post_id,field) values (pg_temp.fixture_id('image'),pg_temp.fixture_id('post'),'content_markdown')$test$, 'Markdown reference supported');
create temporary table timestamp_before as select id,updated_at from public.projects where id=pg_temp.fixture_id('project');
update public.projects set title=title where id=pg_temp.fixture_id('project');
select ok((select p.updated_at > b.updated_at from public.projects p join timestamp_before b using(id)), 'updated_at advances within same transaction');
select throws_ok($test$update public.contact_messages set status='deleted'$test$, '23514', null, 'Contact state');
select throws_ok($test$update public.contact_messages set notification_status='unknown'$test$, '23514', null, 'Notification state');
select throws_ok($test$update public.analytics_events set event_type='click_anything'$test$, '23514', null, 'Event allowlist');
select throws_ok($test$update public.analytics_events set session_hash='raw-session'$test$, '23514', null, 'Hash format');
select throws_ok($test$update public.analytics_events set pathname='/path?email=private'$test$, '23514', null, 'Analytics query strings rejected');
select throws_ok($test$insert into public.analytics_daily(date,page_views) values ('2020-01-01',-1)$test$, '23514', null, 'Negative counters');
select throws_ok($test$update public.site_builds set status='cancelled'$test$, '23514', null, 'Build status');
select throws_ok($test$update public.site_builds set status='building'$test$, '23514', null, 'Building start required');
select throws_ok($test$update public.site_builds set status='success',completed_at=now()$test$, '23514', null, 'Success requires deployment evidence');
select throws_ok($test$update public.site_builds set status='failed',completed_at=now()$test$, '23514', null, 'Failure reason required');
select throws_ok($test$update public.site_builds set github_run_id=1$test$, '23514', null, 'Run requires attempt');
select throws_ok($test$update public.site_builds set retry_of=id,trigger_type='retry'$test$, '23514', null, 'Self retry rejected');
select throws_ok($test$update public.site_builds set started_at=now(),completed_at=now()-interval '1 day'$test$, '23514', null, 'Build date ordering');
select throws_ok($test$insert into public.contact_messages(submission_id,name,email,subject,message) values (pg_temp.fixture_id('submission'),'Test','a@example.com','Test','Test')$test$, '23505', null, 'Contact idempotency');
select throws_ok($test$insert into public.analytics_events(event_id,session_hash,event_type,pathname) values (pg_temp.fixture_id('event'),repeat('a',64),'page_view','/')$test$, '23505', null, 'Event idempotency');
select throws_ok($test$insert into public.site_builds(request_id,trigger_type) values (pg_temp.fixture_id('request'),'manual')$test$, '23505', null, 'Build request idempotency');
select throws_ok($test$update public.site_builds set completed_at=now()$test$, '23514', null, 'Queued build cannot be completed with null start');
select throws_ok($test$update public.site_builds set started_at=now(),completed_at=now()$test$, '23514', null, 'Nonterminal build cannot carry completion');
select lives_ok($test$update public.site_builds set github_run_id=123,github_run_attempt=1,started_at=now(),completed_at=now(),deployment_id='fixture',status='success'$test$, 'Valid completed build');
select throws_ok($test$insert into public.site_builds(request_id,trigger_type,github_run_id,github_run_attempt) values (pg_temp.fixture_id('request2'),'manual',123,1)$test$, '23505', null, 'Unique run and attempt');
select lives_ok($test$insert into private.analytics_daily_sessions(date,session_hash) values ('2020-01-01',repeat('a',64))$test$, 'Site daily session');
select throws_ok($test$insert into private.analytics_daily_sessions(date,session_hash) values ('2020-01-01',repeat('a',64))$test$, '23505', null, 'NULL site scope cannot duplicate daily session');
update public.contact_settings set cv_enabled=false;
select is((public.get_public_snapshot()->>'schema_version')::integer, 1, 'Snapshot version');
select is(jsonb_array_length(public.get_public_snapshot()->'projects'), 1, 'Snapshot projects: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'posts'), 1, 'Snapshot posts: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'technologies'), 1, 'Snapshot technologies: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'experiences'), 1, 'Snapshot experiences: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'social_links'), 1, 'Snapshot social_links: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'project_features'), 1, 'Snapshot project_features: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'project_images'), 1, 'Snapshot project_images: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'project_metrics'), 1, 'Snapshot project_metrics: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'project_challenges'), 1, 'Snapshot project_challenges: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'project_technologies'), 1, 'Snapshot project_technologies: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'tags'), 1, 'Snapshot tags: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'post_tags'), 1, 'Snapshot post_tags: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'post_category_relations'), 1, 'Snapshot post_category_relations: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'experience_highlights'), 1, 'Snapshot experience_highlights: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'experience_projects'), 1, 'Snapshot experience_projects: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'experience_technologies'), 1, 'Snapshot experience_technologies: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'media_assets'), 1, 'Snapshot media_assets: only public related records');
select is(jsonb_array_length(public.get_public_snapshot()->'documents'), 0, 'Disabled CV omitted');
select ok((public.get_public_snapshot()#>'{settings,cv_url}') = 'null'::jsonb, 'CV URL omitted while contact CV disabled');
select ok((public.get_public_snapshot()#>'{contact,email}') = 'null'::jsonb, 'Hidden contact email omitted');
select ok((public.get_public_snapshot()#>'{contact,whatsapp_number}') = 'null'::jsonb, 'Hidden contact whatsapp_number omitted');
select ok((public.get_public_snapshot()#>'{contact,whatsapp_default_message}') = 'null'::jsonb, 'Hidden contact whatsapp_default_message omitted');
select ok((public.get_public_snapshot()#>'{contact,whatsapp_cta_label}') = 'null'::jsonb, 'Hidden contact whatsapp_cta_label omitted');
select ok(public.get_public_snapshot()::text not like '%PRIVATE_SENTINEL%', 'No private fixture data in snapshot');
select ok(not (public.get_public_snapshot() ?| array['contact_messages','analytics_events','site_builds','admin_activity','admin_profiles']), 'No private top-level tables');
select ok(public.get_public_snapshot()::text not like '%created_by%' and public.get_public_snapshot()::text not like '%storage_path%', 'No administrative media fields');
select ok((public.get_public_snapshot()#>'{projects,0,cover_image_url}') = 'null'::jsonb, 'Private image URL removed');
update public.contact_settings set cv_enabled=true;
select is(jsonb_array_length(public.get_public_snapshot()->'documents'), 1, 'Enabled active public CV included');
update public.media_assets set visibility='private' where id=pg_temp.fixture_id('pdf');
select is(jsonb_array_length(public.get_public_snapshot()->'documents'), 0, 'Private CV omitted');
select ok((public.get_public_snapshot()#>'{settings,cv_url}') = 'null'::jsonb, 'Private CV URL removed');
update public.documents set active=false where id=pg_temp.fixture_id('cv');
select ok((select cv_url is null from public.site_settings), 'Deactivated CV clears cache');
delete from public.projects where id=pg_temp.fixture_id('project');
select is((select count(*) from public.project_features where project_id=pg_temp.fixture_id('project')), 0::bigint, 'project_features: editorial cascade');
select is((select count(*) from public.project_images where project_id=pg_temp.fixture_id('project')), 0::bigint, 'project_images: editorial cascade');
select is((select count(*) from public.project_metrics where project_id=pg_temp.fixture_id('project')), 0::bigint, 'project_metrics: editorial cascade');
select is((select count(*) from public.project_challenges where project_id=pg_temp.fixture_id('project')), 0::bigint, 'project_challenges: editorial cascade');
select is((select count(*) from public.project_technologies where project_id=pg_temp.fixture_id('project')), 0::bigint, 'project_technologies: editorial cascade');
select is((select count(*) from public.experience_projects where project_id=pg_temp.fixture_id('project')), 0::bigint, 'experience_projects: editorial cascade');
select is((select count(*) from public.media_assets where id=pg_temp.fixture_id('image')), 1::bigint, 'Cascade preserves reusable media');
select is((select count(*) from public.admin_activity), 1::bigint, 'Cascade preserves audit');
select ok((select project_id is null from public.analytics_events), 'Event retained with null live FK');
insert into public.analytics_daily_content(date,content_type,content_id) values ('2020-01-01','project',pg_temp.fixture_id('project'));
select is((select count(*) from public.analytics_daily_content), 1::bigint, 'Historical content aggregates survive deletion');
-- Test-only role and grants are rolled back. No F6 policies are installed.
create role f5_snapshot_test nologin;
grant f5_snapshot_test to postgres;
grant usage on schema public, extensions to f5_snapshot_test;
grant select on all tables in schema public to f5_snapshot_test;
grant execute on function public.get_public_snapshot() to f5_snapshot_test;
grant execute on function private.read_public_contact(), private.read_public_media() to f5_snapshot_test;
set local role f5_snapshot_test;
select is(jsonb_array_length(public.get_public_snapshot()->'posts'), 0, 'SECURITY INVOKER honors RLS with no policies');
select ok((public.get_public_snapshot()->'settings') = 'null'::jsonb, 'Invoker cannot bypass settings RLS');
reset role;
set local role anon;
select lives_ok($test$select public.get_public_snapshot()$test$, 'Anon can read public snapshot in F6');
select throws_ok($test$select * from public.contact_messages$test$, '42501', null, 'Anon cannot read messages');
select throws_ok($test$insert into public.posts(title,slug) values ('Attack','attack')$test$, '42501', null, 'Anon cannot write content');
reset role;
set local role authenticated;
select lives_ok($test$select public.get_public_snapshot()$test$, 'Authenticated can read public snapshot in F6');
select is((select count(*) from public.site_builds), 0::bigint, 'Authenticated nonowner cannot read builds');
reset role;
-- Temporary Auth identities are test fixtures, rolled back with the transaction.
insert into auth.users(id) values (pg_temp.fixture_id('owner1')), (pg_temp.fixture_id('owner2'));
select lives_ok($test$insert into public.admin_profiles(id,display_name,active) values (pg_temp.fixture_id('owner1'),'Test owner',true)$test$, 'One active owner allowed');
select throws_ok($test$insert into public.admin_profiles(id,display_name,active) values (pg_temp.fixture_id('owner2'),'Other owner',true)$test$, '23505', null, 'Second active owner denied');
select throws_ok($test$update public.admin_profiles set role='admin'$test$, '23514', null, 'Owner role constrained');
select throws_ok($test$delete from auth.users where id=pg_temp.fixture_id('owner1')$test$, '23503', null, 'Auth identity protected by profile FK');
insert into public.admin_activity(admin_id,action,entity_type) values (pg_temp.fixture_id('owner1'),'fixture','profile');
select throws_ok($test$delete from public.admin_profiles where id=pg_temp.fixture_id('owner1')$test$, '23503', null, 'Audit protects admin identity');
select throws_ok($test$insert into public.admin_profiles(id,display_name) values (pg_temp.fixture_id('missing-auth'),'Orphan')$test$, '23503', null, 'Profile requires Auth identity');
select ok(not exists (
  select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  where c.contype='f' and n.nspname in ('public','private')
  and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indpred is null
    and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)
), 'All foreign keys have a leading index');
select ok(not exists (
  select 1 from information_schema.columns c where c.table_schema='public' and c.column_name='updated_at'
  and not exists (select 1 from pg_trigger t where t.tgrelid=('public.' || c.table_name)::regclass and t.tgname='set_updated_at')
), 'All mutable rows have updated_at triggers');
select * from finish();
rollback;
