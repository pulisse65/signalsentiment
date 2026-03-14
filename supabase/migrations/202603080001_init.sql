create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tracked_entities (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  category text not null check (category in ('stock','sports','product')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references tracked_entities(id) on delete cascade,
  alias text not null,
  confidence numeric(5,4) not null default 0.8,
  created_at timestamptz not null default now(),
  unique(entity_id, alias)
);

create table if not exists sources (
  id smallserial primary key,
  source text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists searches (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  category text not null check (category in ('stock','sports','product')),
  time_range text not null check (time_range in ('24h','7d','30d','90d')),
  selected_sources text[] not null,
  language text not null default 'en',
  min_mentions integer not null default 3,
  entity_name text not null,
  entity_confidence numeric(5,4) not null default 0.7,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists searches_user_created_idx on searches(user_id, created_at desc);
create index if not exists searches_query_idx on searches using gin (to_tsvector('english', query));

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references searches(id) on delete cascade,
  source text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null check (status in ('success','error')),
  item_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_runs_search_idx on ingestion_runs(search_id, started_at desc);

create table if not exists source_items (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references searches(id) on delete cascade,
  source text not null,
  external_id text not null,
  url text not null,
  author text,
  title text,
  content text not null,
  normalized_content text not null,
  published_at timestamptz not null,
  language text not null,
  engagement jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(search_id, source, external_id)
);

create index if not exists source_items_search_idx on source_items(search_id, published_at desc);
create index if not exists source_items_content_idx on source_items using gin (to_tsvector('english', normalized_content));

create table if not exists sentiment_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null unique references searches(id) on delete cascade,
  overall_score numeric(7,2) not null,
  mention_volume integer not null,
  confidence_score numeric(5,4) not null,
  momentum text not null check (momentum in ('up','down','flat')),
  positive_pct integer not null,
  neutral_pct integer not null,
  negative_pct integer not null,
  source_breakdown jsonb not null default '[]'::jsonb,
  quality_notes text[] not null default '{}',
  anomalies text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sentiment_timeseries (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references searches(id) on delete cascade,
  bucket_time timestamptz not null,
  sentiment_score numeric(7,2) not null,
  mention_count integer not null,
  created_at timestamptz not null default now(),
  unique(search_id, bucket_time)
);

create index if not exists sentiment_timeseries_search_idx on sentiment_timeseries(search_id, bucket_time asc);

create table if not exists extracted_topics (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references searches(id) on delete cascade,
  theme text not null,
  sentiment text not null check (sentiment in ('positive','negative')),
  frequency integer not null,
  created_at timestamptz not null default now()
);

create index if not exists extracted_topics_search_idx on extracted_topics(search_id, frequency desc);

create table if not exists connector_status (
  source text primary key,
  enabled boolean not null default true,
  healthy boolean not null default false,
  last_run_at timestamptz,
  message text,
  updated_at timestamptz not null default now()
);

insert into sources (source, enabled)
values
  ('reddit', true),
  ('youtube', true),
  ('tiktok', true),
  ('facebook', true)
on conflict (source) do nothing;

alter table searches enable row level security;
alter table sentiment_results enable row level security;
alter table sentiment_timeseries enable row level security;
alter table source_items enable row level security;
alter table extracted_topics enable row level security;

create policy "users can read own searches"
  on searches for select
  using (auth.uid() = user_id);

create policy "users can insert own searches"
  on searches for insert
  with check (auth.uid() = user_id);

create policy "users can read own sentiment_results"
  on sentiment_results for select
  using (exists (select 1 from searches s where s.id = sentiment_results.search_id and s.user_id = auth.uid()));

create policy "users can read own timeseries"
  on sentiment_timeseries for select
  using (exists (select 1 from searches s where s.id = sentiment_timeseries.search_id and s.user_id = auth.uid()));

create policy "users can read own source_items"
  on source_items for select
  using (exists (select 1 from searches s where s.id = source_items.search_id and s.user_id = auth.uid()));

create policy "users can read own topics"
  on extracted_topics for select
  using (exists (select 1 from searches s where s.id = extracted_topics.search_id and s.user_id = auth.uid()));
