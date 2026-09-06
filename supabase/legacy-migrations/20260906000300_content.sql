begin;
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtitle text,
  summary text,
  problem text,
  objective text,
  solution text,
  architecture text,
  challenges text,
  learnings text,
  role text,
  year smallint check (year between 1900 and 2200),
  status text not null default 'concept' check (status in ('concept','development','production','completed','archived')),
  featured_image_url text,
  cover_image_url text,
  github_url text check (github_url ~ '^https://[^[:space:]]+$'),
  demo_url text check (demo_url ~ '^https://[^[:space:]]+$'),
  documentation_url text check (documentation_url ~ '^https://[^[:space:]]+$'),
  featured boolean not null default false,
  published boolean not null default false,
  seo_title text,
  seo_description text,
  og_image_url text,
  published_at timestamptz,
  canonical_url text check (canonical_url ~ '^https://[^[:space:]]+$'),
  robots_policy text check (robots_policy in ('index,follow','noindex,follow','noindex,nofollow','index,nofollow')),
  before_markdown text,
  after_markdown text,
  sort_order integer not null default 0 check (sort_order >= 0),
  featured_image_asset_id uuid references public.media_assets(id) on delete restrict,
  cover_image_asset_id uuid references public.media_assets(id) on delete restrict,
  og_image_asset_id uuid references public.media_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not published or published_at is not null)
);
alter table public.projects enable row level security;
revoke all on public.projects from public, anon, authenticated;

create table public.technologies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (length(btrim(category)) between 1 and 80),
  description text,
  icon text,
  official_url text check (official_url ~ '^https://[^[:space:]]+$'),
  featured boolean not null default false,
  visible boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.technologies enable row level security;
revoke all on public.technologies from public, anon, authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text,
  content_markdown text not null default '',
  featured_image_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  reading_time integer check (reading_time > 0),
  seo_title text,
  seo_description text,
  og_image_url text,
  published_at timestamptz,
  canonical_url text check (canonical_url ~ '^https://[^[:space:]]+$'),
  robots_policy text check (robots_policy in ('index,follow','noindex,follow','noindex,nofollow','index,nofollow')),
  popular_rank integer check (popular_rank > 0),
  featured_image_asset_id uuid references public.media_assets(id) on delete restrict,
  og_image_asset_id uuid references public.media_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
alter table public.posts enable row level security;
revoke all on public.posts from public, anon, authenticated;

create table public.post_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.post_categories enable row level security;
revoke all on public.post_categories from public, anon, authenticated;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tags enable row level security;
revoke all on public.tags from public, anon, authenticated;

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  position text not null check (length(btrim(position)) between 1 and 200),
  organization text not null check (length(btrim(organization)) between 1 and 200),
  organization_url text check (organization_url ~ '^https://[^[:space:]]+$'),
  start_date date not null,
  end_date date,
  current boolean not null default false,
  summary text,
  description_markdown text,
  visible boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (not current or end_date is null)
);
alter table public.experiences enable row level security;
revoke all on public.experiences from public, anon, authenticated;

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  icon text,
  sort_order integer not null default 0 check (sort_order >= 0),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.specialties enable row level security;
revoke all on public.specialties from public, anon, authenticated;

create table public.work_principles (
  id uuid primary key default gen_random_uuid(),
  number smallint not null unique check (number > 0),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.work_principles enable row level security;
revoke all on public.work_principles from public, anon, authenticated;

create table public.impact_metrics (
  id uuid primary key default gen_random_uuid(),
  value text not null check (length(btrim(value)) between 1 and 50),
  label text not null check (length(btrim(label)) between 1 and 120),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.impact_metrics enable row level security;
revoke all on public.impact_metrics from public, anon, authenticated;

commit;
