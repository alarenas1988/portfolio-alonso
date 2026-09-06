begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select set_config('storage.allow_delete_query','true',true);
insert into auth.users(id) values('80000000-0000-4000-8000-000000000001'),('80000000-0000-4000-8000-000000000002');
insert into public.admin_profiles(id,display_name,active) values('80000000-0000-4000-8000-000000000001','Media fixture owner',true);
insert into storage.objects(bucket_id,name,owner_id) values
('portfolio-public','general/80000000-0000-4000-8000-000000000011.png','80000000-0000-4000-8000-000000000001'),
('portfolio-public','general/80000000-0000-4000-8000-000000000012.png','80000000-0000-4000-8000-000000000001'),
('documents','cv/80000000-0000-4000-8000-000000000013.pdf','80000000-0000-4000-8000-000000000001'),
('documents','cv/80000000-0000-4000-8000-000000000014.pdf','80000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into public.media_assets(id,storage_bucket,storage_path,public_url,filename,mime_type,file_size,width,height,alt_text,visibility) values
('80000000-0000-4000-8000-000000000011','portfolio-public','general/80000000-0000-4000-8000-000000000011.png','https://example.com/storage/v1/object/public/portfolio-public/general/80000000-0000-4000-8000-000000000011.png','informativa.png','image/png',100,10,10,'Imagen informativa','public'),
('80000000-0000-4000-8000-000000000012','portfolio-public','general/80000000-0000-4000-8000-000000000012.png','https://example.com/storage/v1/object/public/portfolio-public/general/80000000-0000-4000-8000-000000000012.png','nueva.png','image/png',100,10,10,'Nueva imagen','public'),
('80000000-0000-4000-8000-000000000013','documents','cv/80000000-0000-4000-8000-000000000013.pdf','https://example.com/storage/v1/object/public/documents/cv/80000000-0000-4000-8000-000000000013.pdf','CV.pdf','application/pdf',100,null,null,null,'public'),
('80000000-0000-4000-8000-000000000014','documents','cv/80000000-0000-4000-8000-000000000014.pdf','https://example.com/storage/v1/object/public/documents/cv/80000000-0000-4000-8000-000000000014.pdf','CV nuevo.pdf','application/pdf',100,null,null,null,'public');
select throws_ok($q$update public.media_assets set alt_text=null where mime_type='image/png'$q$,'23514',null,'Informative image cannot omit alt');
select throws_ok($q$update public.media_assets set alt_text='' where mime_type='image/png'$q$,'23514',null,'Empty alt requires decorative flag');
select lives_ok($q$update public.media_assets set alt_text='',decorative=true where id='80000000-0000-4000-8000-000000000012'$q$,'Explicit decorative image permits empty alt');
select throws_ok($q$update public.media_assets set visibility='private' where id='80000000-0000-4000-8000-000000000011'$q$,'42501',null,'Owner cannot pretend public bytes are private');
select throws_ok($q$delete from storage.objects where name='general/80000000-0000-4000-8000-000000000011.png'$q$,'23503',null,'Registered object cannot be removed directly through Storage');
insert into public.projects(id,title,slug,featured_image_asset_id,solution) values
('80000000-0000-4000-8000-000000000021','Fixture project','media-fixture-project','80000000-0000-4000-8000-000000000011','![Figura](media:80000000-0000-4000-8000-000000000011)');
insert into public.posts(id,title,slug,content_markdown) values
('80000000-0000-4000-8000-000000000022','Fixture post','media-fixture-post','![Figura](media:80000000-0000-4000-8000-000000000011) ![Repetida](media:80000000-0000-4000-8000-000000000011)');
insert into public.technologies(id,name,slug,category,visible,icon_asset_id) values('80000000-0000-4000-8000-000000000023','Fixture technology','media-fixture-tech','test',true,'80000000-0000-4000-8000-000000000011');
select is((select count(*) from public.media_references where asset_id='80000000-0000-4000-8000-000000000011'),4::bigint,'Project FK and multiple Markdown uses tracked without duplicates per field');
select throws_ok($q$delete from public.media_assets where id='80000000-0000-4000-8000-000000000011'$q$,'23503',null,'Asset in use cannot be deleted');
select throws_ok($q$update public.posts set content_markdown='![Missing](media:80000000-0000-4000-8000-000000000099)' where id='80000000-0000-4000-8000-000000000022'$q$,'23503',null,'Markdown cannot reference nonexistent asset');
select throws_ok($q$select public.replace_media_asset('80000000-0000-4000-8000-000000000011','80000000-0000-4000-8000-000000000012','2000-01-01')$q$,'40001',null,'Stale revision rejects replacement');
select throws_ok($q$select public.replace_media_asset('80000000-0000-4000-8000-000000000011','80000000-0000-4000-8000-000000000012',null)$q$,'40001',null,'Null revision cannot bypass conflict detection');
select lives_ok($q$select public.replace_media_asset('80000000-0000-4000-8000-000000000011','80000000-0000-4000-8000-000000000012',(select updated_at from public.media_assets where id='80000000-0000-4000-8000-000000000011'))$q$,'Atomic replacement updates all editorial references');
select is((select count(*) from public.media_references where asset_id='80000000-0000-4000-8000-000000000011'),0::bigint,'Previous asset is unlinked');
select is((select count(*) from public.media_references where asset_id='80000000-0000-4000-8000-000000000012'),4::bigint,'Replacement inherits all usages');
select ok((select content_markdown like '%media:80000000-0000-4000-8000-000000000012%' from public.posts where id='80000000-0000-4000-8000-000000000022'),'Replacement rewrites Markdown');
select is((select icon_asset_id from public.technologies where id='80000000-0000-4000-8000-000000000023'),'80000000-0000-4000-8000-000000000012'::uuid,'Technology icon participates in atomic replacement');
select is((select count(*) from public.media_assets where id='80000000-0000-4000-8000-000000000011'),1::bigint,'Replacement retains previous asset for explicit retirement');
select lives_ok($q$delete from public.media_assets where id='80000000-0000-4000-8000-000000000011'$q$,'Unlinked metadata can be deleted');
select lives_ok($q$delete from storage.objects where name='general/80000000-0000-4000-8000-000000000011.png'$q$,'Unregistered object can be explicitly removed');
insert into public.documents(id,title,type,asset_id) values
('80000000-0000-4000-8000-000000000031','First CV','cv','80000000-0000-4000-8000-000000000013'),
('80000000-0000-4000-8000-000000000032','Next CV','cv','80000000-0000-4000-8000-000000000014');
insert into public.documents(id,title,type,asset_id,active) values('80000000-0000-4000-8000-000000000033','Public document','document','80000000-0000-4000-8000-000000000013',true);
select ok(public.get_public_snapshot()->'documents' @> '[{"id":"80000000-0000-4000-8000-000000000033"}]'::jsonb,'General public document does not depend on CV visibility');
select lives_ok($q$select public.activate_cv('80000000-0000-4000-8000-000000000031')$q$,'First CV activated');
select lives_ok($q$select public.activate_cv('80000000-0000-4000-8000-000000000032')$q$,'New CV activation atomically retires previous selection');
select is((select count(*) from public.documents where type='cv' and active),1::bigint,'Exactly one active CV');
select throws_ok($q$select public.activate_cv('80000000-0000-4000-8000-000000000099')$q$,'23514',null,'Missing CV cannot replace current selection');
select ok((select active from public.documents where id='80000000-0000-4000-8000-000000000032'),'Failed CV activation preserves previous selection');
reset role;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($q$select public.activate_cv('80000000-0000-4000-8000-000000000031')$q$,'42501',null,'Nonowner cannot invoke CV RPC');
select throws_ok($q$select public.replace_media_asset('80000000-0000-4000-8000-000000000012','80000000-0000-4000-8000-000000000013',now())$q$,'42501',null,'Nonowner cannot invoke replacement RPC');
reset role;
set local role anon;
select throws_ok($q$select public.activate_cv('80000000-0000-4000-8000-000000000031')$q$,'42501',null,'Anon cannot invoke CV RPC');
select throws_ok($q$select public.replace_media_asset('80000000-0000-4000-8000-000000000012','80000000-0000-4000-8000-000000000013',now())$q$,'42501',null,'Anon cannot invoke replacement RPC');
reset role;
reset role;
select throws_ok($q$update public.media_assets set file_size=10485761 where id='80000000-0000-4000-8000-000000000012'$q$,'23514',null,'DB rejects oversized metadata even without UI');
select throws_ok($q$update public.media_assets set width=40000001,height=1 where id='80000000-0000-4000-8000-000000000012'$q$,'23514',null,'DB limits decoded dimensions');
select throws_ok($q$update public.media_assets set filename='disguised.html' where id='80000000-0000-4000-8000-000000000012'$q$,'23514',null,'Metadata filename must match format');
select throws_ok($q$update public.posts set content_markdown='![Malformed](media:not-a-uuid)' where id='80000000-0000-4000-8000-000000000022'$q$,'23514',null,'Malformed Markdown references rejected');
delete from public.media_references where asset_id='80000000-0000-4000-8000-000000000012';
select throws_ok($q$delete from public.media_assets where id='80000000-0000-4000-8000-000000000012'$q$,'23503','Asset is still referenced by Markdown; unlink the editorial content first','Deleting reference rows cannot bypass raw Markdown protection');
select * from finish();
rollback;
