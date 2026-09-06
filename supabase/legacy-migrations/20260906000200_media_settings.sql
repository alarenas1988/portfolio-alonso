begin;
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null check (storage_bucket ~ '^[a-z0-9][a-z0-9-]*$'),
  storage_path text not null check (length(storage_path) between 1 and 1024 and storage_path !~ '(^/|(^|/)\.\.(/|$))'),
  public_url text check (public_url ~ '^https://[^[:space:]]+$'),
  filename text not null check (length(btrim(filename)) between 1 and 255),
  mime_type text not null check (mime_type ~ '^[a-z0-9.+-]+/[a-zA-Z0-9.+-]+$'),
  file_size bigint not null check (file_size > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  alt_text text,
  caption text,
  category text not null default 'general' check (category in ('project','blog','profile','document','general')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_by uuid references public.admin_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  check ((width is null) = (height is null)),
  check (visibility <> 'public' or public_url is not null)
);
alter table public.media_assets enable row level security;
revoke all on public.media_assets from public, anon, authenticated;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'cv' check (type = 'cv'),
  title text not null check (length(btrim(title)) between 1 and 200),
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  storage_path text not null,
  public_url text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.documents enable row level security;
revoke all on public.documents from public, anon, authenticated;

create unique index documents_one_active_cv on public.documents (type) where active;
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  site_name text not null check (length(btrim(site_name)) between 1 and 200),
  brand_short text not null check (length(btrim(brand_short)) between 1 and 20),
  professional_title text,
  hero_title text,
  hero_subtitle text,
  hero_description text,
  availability_enabled boolean not null default false,
  availability_text text,
  location_public text,
  cv_url text,
  default_seo_title text,
  default_seo_description text,
  default_og_image text,
  default_og_image_asset_id uuid references public.media_assets(id) on delete restrict,
  about_summary_markdown text,
  about_profile_markdown text,
  working_method_markdown text,
  about_image_asset_id uuid references public.media_assets(id) on delete restrict,
  canonical_base text check (canonical_base ~ '^https://[^[:space:]]+$'),
  robots_policy text not null default 'index,follow' check (robots_policy in ('index,follow','noindex,follow','noindex,nofollow','index,nofollow')),
  timezone text not null default 'America/Santiago',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;

create table public.contact_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  email text check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email) <= 254),
  whatsapp_number text check (whatsapp_number ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp_default_message text,
  cta_title text,
  cta_description text,
  form_enabled boolean not null default false,
  cv_enabled boolean not null default false,
  email_visible boolean not null default false,
  whatsapp_visible boolean not null default false,
  whatsapp_cta_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not email_visible or email is not null),
  check (not whatsapp_visible or whatsapp_number is not null)
);
alter table public.contact_settings enable row level security;
revoke all on public.contact_settings from public, anon, authenticated;

create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (length(btrim(platform)) between 1 and 50),
  label text not null check (length(btrim(label)) between 1 and 120),
  url text not null check (url ~ '^https://[^[:space:]]+$'),
  icon text,
  sort_order integer not null default 0 check (sort_order >= 0),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_links enable row level security;
revoke all on public.social_links from public, anon, authenticated;

create trigger validate_timezone before insert or update on public.site_settings for each row execute function private.check_timezone();
commit;
