begin;
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  message text not null check (length(btrim(message)) between 1 and 10000),
  status text not null default 'new' check (status in ('new','read','replied','archived')),
  notification_status text not null default 'pending' check (notification_status in ('pending','sent','failed','disabled')),
  user_agent_summary text check (length(user_agent_summary) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  session_hash text not null check (session_hash ~ '^[a-f0-9]{64}$'),
  event_type text not null check (event_type in ('page_view','project_view','post_view','whatsapp_click','email_click','email_copy','github_click','linkedin_click','demo_click','cv_download','contact_submit','article_share')),
  pathname text not null check (pathname ~ '^/[^?#[:space:]]*$' and length(pathname) <= 2048),
  referrer_domain text check (length(referrer_domain) <= 253 and referrer_domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'),
  project_id uuid references public.projects(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  device_type text check (device_type in ('desktop','tablet','mobile','other','unknown')),
  browser_family text check (length(browser_family) between 1 and 80),
  created_at timestamptz not null default now(),
  check (num_nonnulls(project_id, post_id) <= 1)
);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;

create table public.analytics_daily (
  date date primary key,
  page_views bigint not null default 0 check (page_views >= 0),
  unique_sessions bigint not null default 0 check (unique_sessions >= 0),
  project_views bigint not null default 0 check (project_views >= 0),
  post_views bigint not null default 0 check (post_views >= 0),
  whatsapp_clicks bigint not null default 0 check (whatsapp_clicks >= 0),
  email_clicks bigint not null default 0 check (email_clicks >= 0),
  email_copies bigint not null default 0 check (email_copies >= 0),
  github_clicks bigint not null default 0 check (github_clicks >= 0),
  linkedin_clicks bigint not null default 0 check (linkedin_clicks >= 0),
  demo_clicks bigint not null default 0 check (demo_clicks >= 0),
  cv_downloads bigint not null default 0 check (cv_downloads >= 0),
  contact_submits bigint not null default 0 check (contact_submits >= 0),
  article_shares bigint not null default 0 check (article_shares >= 0)
);
alter table public.analytics_daily enable row level security;
revoke all on public.analytics_daily from public, anon, authenticated;

create table public.analytics_daily_content (
  date date not null,
  content_type text not null check (content_type in ('project','post')),
  content_id uuid not null,
  views bigint not null default 0 check (views >= 0),
  unique_sessions bigint not null default 0 check (unique_sessions >= 0),
  primary key (date, content_type, content_id)
);
alter table public.analytics_daily_content enable row level security;
revoke all on public.analytics_daily_content from public, anon, authenticated;

create table private.analytics_daily_dimensions (
  date date not null,
  dimension text not null check (dimension in ('pathname','referrer_domain','device_type','browser_family')),
  value text not null check (length(value) between 1 and 2048),
  page_views bigint not null default 0 check (page_views >= 0),
  unique_sessions bigint not null default 0 check (unique_sessions >= 0),
  project_views bigint not null default 0 check (project_views >= 0),
  post_views bigint not null default 0 check (post_views >= 0),
  whatsapp_clicks bigint not null default 0 check (whatsapp_clicks >= 0),
  email_clicks bigint not null default 0 check (email_clicks >= 0),
  email_copies bigint not null default 0 check (email_copies >= 0),
  github_clicks bigint not null default 0 check (github_clicks >= 0),
  linkedin_clicks bigint not null default 0 check (linkedin_clicks >= 0),
  demo_clicks bigint not null default 0 check (demo_clicks >= 0),
  cv_downloads bigint not null default 0 check (cv_downloads >= 0),
  contact_submits bigint not null default 0 check (contact_submits >= 0),
  article_shares bigint not null default 0 check (article_shares >= 0),
  primary key (date, dimension, value)
);
alter table private.analytics_daily_dimensions enable row level security;
revoke all on private.analytics_daily_dimensions from public, anon, authenticated;

create table private.analytics_daily_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  session_hash text not null check (session_hash ~ '^[a-f0-9]{64}$'),
  content_type text not null default 'site' check (content_type in ('site','project','post')),
  content_id uuid,
  check ((content_type = 'site') = (content_id is null)),
  unique nulls not distinct (date, session_hash, content_type, content_id)
);
alter table private.analytics_daily_sessions enable row level security;
revoke all on private.analytics_daily_sessions from public, anon, authenticated;

create table private.rate_limit_buckets (
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  action text not null check (action in ('contact','analytics','publish')),
  window_start timestamptz not null,
  expires_at timestamptz not null check (expires_at > window_start),
  hits integer not null default 0 check (hits >= 0),
  primary key (key_hash, action, window_start)
);
alter table private.rate_limit_buckets enable row level security;
revoke all on private.rate_limit_buckets from public, anon, authenticated;

create table public.admin_activity (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_profiles(id) on delete restrict,
  action text not null check (length(btrim(action)) between 1 and 80),
  entity_type text not null check (length(btrim(entity_type)) between 1 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096),
  created_at timestamptz not null default now()
);
alter table public.admin_activity enable row level security;
revoke all on public.admin_activity from public, anon, authenticated;

create table public.site_builds (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  trigger_type text not null check (trigger_type in ('push','manual','content_change','retry')),
  entity_type text check (entity_type in ('project','post','experience','settings','media','document','profile','contact','technology')),
  entity_id uuid,
  github_run_id bigint check (github_run_id > 0),
  github_run_attempt integer check (github_run_attempt > 0),
  github_run_url text check (github_run_url ~ '^https://github\.com/[^[:space:]]+/actions/runs/[0-9]+$'),
  status text not null default 'queued' check (status in ('queued','building','success','failed')),
  commit_sha text check (commit_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text check (length(failure_reason) between 1 and 500),
  deployment_id text check (length(deployment_id) between 1 and 200),
  content_snapshot_hash text check (content_snapshot_hash ~ '^[a-f0-9]{64}$'),
  retry_of uuid references public.site_builds(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (github_run_id, github_run_attempt),
  check ((github_run_id is null) = (github_run_attempt is null)),
  check ((entity_type is null) = (entity_id is null)),
  check (retry_of is null or retry_of <> id),
  check ((trigger_type = 'retry') = (retry_of is not null)),
  check (completed_at is null or (started_at is null and status = 'failed') or (started_at is not null and completed_at >= started_at)),
  check (status in ('success','failed') or completed_at is null),
  check (status <> 'building' or started_at is not null),
  check (status not in ('success','failed') or completed_at is not null),
  check (status <> 'success' or (started_at is not null and github_run_id is not null and deployment_id is not null and failure_reason is null)),
  check (status <> 'failed' or failure_reason is not null)
);
alter table public.site_builds enable row level security;
revoke all on public.site_builds from public, anon, authenticated;

-- History content IDs intentionally survive editorial deletion; they are not live joins.
comment on column public.analytics_daily_content.content_id is 'Historical identity; intentionally no cascading FK.';
comment on column public.admin_activity.metadata is 'Service-authored allowlisted metadata only; never message bodies, tokens, or passwords.';
commit;
