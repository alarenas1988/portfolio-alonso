begin;
create function private.is_portfolio_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'owner'
  );
$$;
alter function private.is_portfolio_admin() owner to postgres;
revoke all on function private.is_portfolio_admin() from public, anon, authenticated;
grant execute on function private.is_portfolio_admin() to authenticated;
grant usage on schema private to authenticated;

grant select on public.admin_profiles to authenticated;
grant update (display_name, avatar_url) on public.admin_profiles to authenticated;
create policy owner_profile_read on public.admin_profiles for select to authenticated
  using (id = (select auth.uid()) and (select private.is_portfolio_admin()));
create policy owner_profile_edit on public.admin_profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.is_portfolio_admin()))
  with check (id = (select auth.uid()) and (select private.is_portfolio_admin()));

-- Field-level redaction cannot be expressed with RLS. These private, parameterless
-- functions expose only fixed public projections; their backing tables remain owner-only.
create function private.read_public_contact()
returns table (
  id uuid, email text, whatsapp_number text, whatsapp_default_message text,
  cta_title text, cta_description text, form_enabled boolean, cv_enabled boolean,
  email_visible boolean, whatsapp_visible boolean, whatsapp_cta_label text
)
language sql stable security definer set search_path = ''
as $$
  select c.id, case when c.email_visible then c.email end,
    case when c.whatsapp_visible then c.whatsapp_number end,
    case when c.whatsapp_visible then c.whatsapp_default_message end,
    c.cta_title, c.cta_description, c.form_enabled, c.cv_enabled,
    c.email_visible, c.whatsapp_visible,
    case when c.whatsapp_visible then c.whatsapp_cta_label end
  from public.contact_settings c;
$$;
create function private.read_public_media()
returns table (
  id uuid, public_url text, filename text, mime_type text, file_size bigint,
  width integer, height integer, alt_text text, caption text, category text, visibility text
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.public_url, a.filename, a.mime_type, a.file_size,
    a.width, a.height, a.alt_text, a.caption, a.category, a.visibility
  from public.media_assets a where a.visibility = 'public';
$$;
alter function private.read_public_contact() owner to postgres;
alter function private.read_public_media() owner to postgres;
revoke all on function private.read_public_contact(), private.read_public_media() from public, anon, authenticated;
grant execute on function private.read_public_contact(), private.read_public_media() to anon, authenticated;
create view public.public_contact_settings with (security_invoker = true, security_barrier = true)
as select * from private.read_public_contact();
create view public.public_media_assets with (security_invoker = true, security_barrier = true)
as select * from private.read_public_media();
revoke all on public.public_contact_settings, public.public_media_assets from public, anon, authenticated;
grant select on public.public_contact_settings, public.public_media_assets to anon, authenticated;
commit;
