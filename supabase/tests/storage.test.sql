begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
-- Emulate the Storage service transaction flag; fixtures contain no actual stored bytes.
select set_config('storage.allow_delete_query','true',true);
create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$select md5('portfolio-f6-storage:'||label)::uuid$$;
create function pg_temp.affected(statement text) returns bigint language plpgsql as $$
declare n bigint; begin execute statement; get diagnostics n=row_count; return n; end $$;
insert into auth.users(id) values(pg_temp.fixture_id('owner')),(pg_temp.fixture_id('normal')),(pg_temp.fixture_id('inactive'));
insert into public.admin_profiles(id,display_name,active) values(pg_temp.fixture_id('owner'),'Test',true),(pg_temp.fixture_id('inactive'),'Test inactive',false);
-- Bucket fixtures are rolled back. F8 creates actual application buckets.
insert into storage.buckets(id,name,public) values
('portfolio-public','portfolio-public',true),('blog','blog',true),('documents','documents',true),('private','private',false);
insert into storage.objects(bucket_id,name,owner_id) values
('portfolio-public','projects/public.png',pg_temp.fixture_id('owner')::text),
('private','temporary/owner.png',pg_temp.fixture_id('owner')::text),
('private','temporary/other.png',pg_temp.fixture_id('normal')::text);
select ok((select relrowsecurity from pg_class where oid='storage.objects'::regclass),'Supabase Storage RLS stays enabled');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select is((select count(*) from storage.objects where bucket_id='private'),0::bigint,'anon: no private listing');
select is((select count(*) from storage.objects where bucket_id='portfolio-public'),1::bigint,'anon: public listing permitted');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values ('private','temporary/attack.png',pg_temp.fixture_id('anon')::text)$attack$,'42501',null,'anon: upload denied');
select is(pg_temp.affected($q$update storage.objects set name='projects/changed.png' where bucket_id='portfolio-public'$q$),0::bigint,'anon: replace denied by RLS');
select is(pg_temp.affected($q$delete from storage.objects where bucket_id='portfolio-public'$q$),0::bigint,'anon: delete denied by RLS');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values ('portfolio-public','projects/public.png',pg_temp.fixture_id('anon')::text) on conflict(bucket_id,name) do update set name=excluded.name$attack$,'42501',null,'anon: upsert denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('normal')::text,true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='private'),0::bigint,'normal: no private listing');
select is((select count(*) from storage.objects where bucket_id='portfolio-public'),1::bigint,'normal: public listing permitted');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values ('private','temporary/attack.png',pg_temp.fixture_id('normal')::text)$attack$,'42501',null,'normal: upload denied');
select is(pg_temp.affected($q$update storage.objects set name='projects/changed.png' where bucket_id='portfolio-public'$q$),0::bigint,'normal: replace denied by RLS');
select is(pg_temp.affected($q$delete from storage.objects where bucket_id='portfolio-public'$q$),0::bigint,'normal: delete denied by RLS');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values ('portfolio-public','projects/public.png',pg_temp.fixture_id('normal')::text) on conflict(bucket_id,name) do update set name=excluded.name$attack$,'42501',null,'normal: upsert denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('inactive')::text,true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='private'),0::bigint,'inactive: no private listing');
select is((select count(*) from storage.objects where bucket_id='portfolio-public'),1::bigint,'inactive: public listing permitted');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values ('private','temporary/attack.png',pg_temp.fixture_id('inactive')::text)$attack$,'42501',null,'inactive: upload denied');
select is(pg_temp.affected($q$update storage.objects set name='projects/changed.png' where bucket_id='portfolio-public'$q$),0::bigint,'inactive: replace denied by RLS');
select is(pg_temp.affected($q$delete from storage.objects where bucket_id='portfolio-public'$q$),0::bigint,'inactive: delete denied by RLS');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values ('portfolio-public','projects/public.png',pg_temp.fixture_id('inactive')::text) on conflict(bucket_id,name) do update set name=excluded.name$attack$,'42501',null,'inactive: upsert denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('owner')::text,true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='private'),1::bigint,'Owner lists only owned private objects');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('portfolio-public','projects/allowed.png',pg_temp.fixture_id('owner')::text)$op$,'Owner insert portfolio-public');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('portfolio-public','projects/allowed.png',pg_temp.fixture_id('owner')::text) on conflict(bucket_id,name) do update set name=excluded.name$op$,'Owner upsert portfolio-public');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('blog','posts/allowed.webp',pg_temp.fixture_id('owner')::text)$op$,'Owner insert blog');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('blog','posts/allowed.webp',pg_temp.fixture_id('owner')::text) on conflict(bucket_id,name) do update set name=excluded.name$op$,'Owner upsert blog');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('documents','cv/allowed.pdf',pg_temp.fixture_id('owner')::text)$op$,'Owner insert documents');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('documents','cv/allowed.pdf',pg_temp.fixture_id('owner')::text) on conflict(bucket_id,name) do update set name=excluded.name$op$,'Owner upsert documents');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('private','temporary/allowed.png',pg_temp.fixture_id('owner')::text)$op$,'Owner insert private');
select lives_ok($op$insert into storage.objects(bucket_id,name,owner_id) values('private','temporary/allowed.png',pg_temp.fixture_id('owner')::text) on conflict(bucket_id,name) do update set name=excluded.name$op$,'Owner upsert private');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values('private','wrong/file.png',pg_temp.fixture_id('owner')::text)$attack$,'42501',null,'Invalid Storage bucket/path private/wrong/file.png');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values('private','temporary/../escape.png',pg_temp.fixture_id('owner')::text)$attack$,'42501',null,'Invalid Storage bucket/path private/temporary/../escape.png');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values('blog','posts/evil.html',pg_temp.fixture_id('owner')::text)$attack$,'42501',null,'Invalid Storage bucket/path blog/posts/evil.html');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values('portfolio-public','projects/evil.svg',pg_temp.fixture_id('owner')::text)$attack$,'42501',null,'Invalid Storage bucket/path portfolio-public/projects/evil.svg');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values('documents','cv/not-pdf.png',pg_temp.fixture_id('owner')::text)$attack$,'42501',null,'Invalid Storage bucket/path documents/cv/not-pdf.png');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values('other','temporary/file.png',pg_temp.fixture_id('owner')::text)$attack$,'42501',null,'Invalid Storage bucket/path other/temporary/file.png');
select throws_ok($attack$update storage.objects set bucket_id='blog',name='wrong/file.png' where bucket_id='private' and name='temporary/allowed.png'$attack$,'42501',null,'WITH CHECK prevents move to invalid path');
select throws_ok($attack$update storage.objects set owner_id=pg_temp.fixture_id('normal')::text where bucket_id='private' and name='temporary/allowed.png'$attack$,'42501',null,'WITH CHECK prevents owner reassignment');
select throws_ok($attack$insert into storage.objects(bucket_id,name,owner_id) values('private','temporary/forged.png',pg_temp.fixture_id('normal')::text)$attack$,'42501',null,'Forged Storage owner_id denied');
select is(pg_temp.affected($q$update storage.objects set name='temporary/stolen.png' where name='temporary/other.png'$q$),0::bigint,'Owner cannot change another identity object');
select is(pg_temp.affected($q$delete from storage.objects where name='temporary/other.png'$q$),0::bigint,'Owner cannot delete another identity object');
select is(pg_temp.affected($q$update storage.objects set name='temporary/replaced.png' where name='temporary/allowed.png'$q$),1::bigint,'Owner can replace own allowed path');
select is(pg_temp.affected($q$delete from storage.objects where name='temporary/replaced.png'$q$),1::bigint,'Owner can delete own object');
reset role;
select * from finish();
rollback;
