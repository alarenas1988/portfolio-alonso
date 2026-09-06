-- F5 is local-only until F6 and explicit remote approval.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

create function private.check_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise check_violation using message = 'Invalid IANA timezone';
  end if;
  return new;
end;
$$;

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  avatar_url text check (avatar_url ~ '^https://[^[:space:]]+$'),
  role text not null default 'owner' check (role = 'owner'),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_profiles enable row level security;
revoke all on public.admin_profiles from public, anon, authenticated;
create unique index admin_profiles_one_active_owner on public.admin_profiles ((true)) where active;
commit;
