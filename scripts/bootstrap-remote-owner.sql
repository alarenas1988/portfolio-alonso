-- One-time administrative bootstrap after the owner creates their Auth account.
-- No identity or credential is embedded. Run only against the verified project.
begin;
lock table public.admin_profiles in exclusive mode;
do $$
declare
  owner_id uuid;
begin
  if (select count(*) from auth.users) <> 1
     or (select count(*) from auth.users where email_confirmed_at is not null) <> 1
     or exists (select 1 from public.admin_profiles) then
    raise exception 'Bootstrap requires exactly one confirmed Auth user and no admin profiles';
  end if;
  select id into strict owner_id from auth.users where email_confirmed_at is not null;
  insert into public.admin_profiles (id, display_name, role, active)
  values (owner_id, 'Alonso Larenas', 'owner', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
end;
$$;
set local role authenticated;
select jsonb_build_object(
  'authorized', private.is_portfolio_admin(),
  'visible_profiles', (select count(*) from public.admin_profiles),
  'active_owner', (select count(*) from public.admin_profiles where active and role = 'owner')
) as bootstrap;
commit;
