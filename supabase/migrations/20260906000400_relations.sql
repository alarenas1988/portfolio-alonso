begin;
create table public.project_features (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  icon text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_features enable row level security;
revoke all on public.project_features from public, anon, authenticated;

create table public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  storage_path text not null,
  public_url text,
  alt_text text not null check (length(btrim(alt_text)) between 1 and 500),
  caption text,
  sort_order integer not null default 0 check (sort_order >= 0),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_images enable row level security;
revoke all on public.project_images from public, anon, authenticated;

create unique index project_images_one_featured on public.project_images (project_id) where featured;
create table public.project_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  value text not null check (length(btrim(value)) between 1 and 50),
  label text not null check (length(btrim(label)) between 1 and 120),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_metrics enable row level security;
revoke all on public.project_metrics from public, anon, authenticated;

create table public.project_challenges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  problem text,
  solution text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_challenges enable row level security;
revoke all on public.project_challenges from public, anon, authenticated;

create table public.project_technologies (
  project_id uuid not null references public.projects(id) on delete cascade,
  technology_id uuid not null references public.technologies(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (project_id, technology_id)
);
alter table public.project_technologies enable row level security;
revoke all on public.project_technologies from public, anon, authenticated;

create table public.post_category_relations (
  post_id uuid not null references public.posts(id) on delete cascade,
  category_id uuid not null references public.post_categories(id) on delete restrict,
  primary key (post_id, category_id)
);
alter table public.post_category_relations enable row level security;
revoke all on public.post_category_relations from public, anon, authenticated;

create table public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  primary key (post_id, tag_id)
);
alter table public.post_tags enable row level security;
revoke all on public.post_tags from public, anon, authenticated;

create table public.experience_highlights (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.experience_highlights enable row level security;
revoke all on public.experience_highlights from public, anon, authenticated;

create table public.experience_projects (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (experience_id, project_id)
);
alter table public.experience_projects enable row level security;
revoke all on public.experience_projects from public, anon, authenticated;

create table public.experience_technologies (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  technology_id uuid not null references public.technologies(id) on delete restrict,
  primary key (experience_id, technology_id)
);
alter table public.experience_technologies enable row level security;
revoke all on public.experience_technologies from public, anon, authenticated;

create table public.media_references (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  project_id uuid references public.projects(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  settings_id uuid references public.site_settings(id) on delete cascade,
  project_image_id uuid references public.project_images(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  entity_type text generated always as (case
    when project_id is not null then 'project'
    when post_id is not null then 'post'
    when settings_id is not null then 'settings'
    when project_image_id is not null then 'project_image'
    when document_id is not null then 'document' end) stored,
  entity_id uuid generated always as (coalesce(project_id, post_id, settings_id, project_image_id, document_id)) stored,
  field text not null check (field ~ '^[a-z][a-z0-9_]*$' and length(field) <= 80),
  created_at timestamptz not null default now(),
  check (num_nonnulls(project_id, post_id, settings_id, project_image_id, document_id) = 1),
  unique (asset_id, entity_type, entity_id, field)
);
alter table public.media_references enable row level security;
revoke all on public.media_references from public, anon, authenticated;

commit;
