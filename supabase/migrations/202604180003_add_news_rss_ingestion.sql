alter table if exists source_items
  add column if not exists metadata jsonb not null default '{}'::jsonb;

insert into sources (source, enabled)
values ('news', true)
on conflict (source) do nothing;

create table if not exists news_articles (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null,
  primary_source text not null,
  guid text,
  fingerprint text not null unique,
  title text not null,
  summary text,
  author text,
  published_at timestamptz not null,
  source_priority integer not null default 1,
  ticker_matches text[] not null default '{}',
  company_matches text[] not null default '{}',
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists news_articles_guid_unq on news_articles(guid) where guid is not null;
create index if not exists news_articles_canonical_url_idx on news_articles(canonical_url);
create index if not exists news_articles_published_idx on news_articles(published_at desc);

create table if not exists search_news_articles (
  search_id uuid not null references searches(id) on delete cascade,
  news_article_id uuid not null references news_articles(id) on delete cascade,
  relevance_score numeric(6,4) not null default 0,
  sentiment_score numeric(7,2),
  match_reasons text[] not null default '{}',
  merged_sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (search_id, news_article_id)
);

create index if not exists search_news_articles_search_idx on search_news_articles(search_id);
create index if not exists search_news_articles_news_idx on search_news_articles(news_article_id);

alter table if exists search_news_articles enable row level security;

create policy "users can read own search_news_articles"
  on search_news_articles for select
  using (exists (select 1 from searches s where s.id = search_news_articles.search_id and s.user_id = auth.uid()));
