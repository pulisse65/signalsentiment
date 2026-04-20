# SignalSentiment

SignalSentiment is a production-oriented sentiment analytics web app built with Next.js, TypeScript, Tailwind, shadcn-style UI primitives, and Supabase.

It supports multi-source sentiment analysis with a connector-based ingestion layer and stores structured reports for historical analysis.

## MVP Features

- Search topics/entities with category + source filters
- Connector framework for Reddit, OpenRouter, YouTube, TikTok, Facebook
- RSS news ingestion source for stock sentiment (Nasdaq, Seeking Alpha, Investing.com, optional MarketWatch)
- Sentiment scoring from -100 to +100 with transparent weighting
- Trend and mention-volume time series
- Top positive/negative themes + rising keywords
- Source-by-source sentiment comparison
- Supabase persistence (searches, source items, sentiment outputs, timeseries, topics)
- Report history and connector health/admin page
- Export report as CSV and summary PDF placeholder
- Supabase Auth email login + middleware-protected dashboard routes (can bypass in local dev)

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style component pattern (`components/ui`)
- Supabase Postgres + Auth
- Recharts for data visualization

## Architecture

### High-level flow

1. User submits a search from `/`
2. `POST /api/search` validates input
3. Pipeline runs:
   - `collectSourceData()` via source connectors
   - `normalizeContent()` + dedupe
   - `resolveEntity()` with alias + ambiguity handling
   - `scoreSentiment()` with engagement + recency weighting
   - `extractThemes()` + anomaly detection
   - `generateReport()` assembles output
4. `saveReportArtifacts()` persists to Supabase (and in-memory fallback)
5. User opens `/report/[id]`

### Connector architecture

Connectors implement `SourceConnector` (`lib/connectors/types.ts`):

- `source`
- `enabled`
- `collect(query)`

Current connectors provide policy-safe mock data and explicit messages where official APIs should be integrated:

- `lib/connectors/reddit.ts`
- `lib/connectors/openrouter.ts`
- `lib/connectors/youtube.ts`
- `lib/connectors/tiktok.ts`
- `lib/connectors/facebook.ts`
- `lib/connectors/news.ts` (stock-only RSS ingestion)

RSS adapters are pluggable in `lib/news-sources/*` and orchestrated by:

- `lib/services/news-ingestion.ts`
- `lib/services/news-relevance.ts`
- `lib/services/news-dedupe.ts`

Reddit connector behavior:

- Uses official Reddit OAuth API when `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are set
- Uses a public endpoint fallback when OAuth credentials are not configured
- Falls back to mock data only if both live paths fail

OpenRouter connector behavior:

- Uses `OPENROUTER_API_KEY` to list models and run sentiment classification prompt calls
- Aggregates model outputs as source items
- Supports `OPENROUTER_MAX_MODELS` cap to control cost/latency

Facebook connector behavior:

- Uses Graph API if `FACEBOOK_ACCESS_TOKEN` is configured
- Attempts page discovery (`/search?type=page`) and page post reads (`/{page-id}/posts`)
- Filters posts to the selected time range
- Falls back to mock data with explicit quality/health messages if permissions or data access are restricted

Add new sources by implementing the same interface and wiring into `lib/connectors/index.ts`.
Add new RSS feeds by implementing `NewsSourceAdapter` and registering it in `news-ingestion.ts`.

### Sentiment explainability

Current scoring uses:

- lexicon polarity signal
- engagement weighting (`likes/comments/views/shares/upvotes`)
- recency decay

Outputs include:

- overall score
- positive/neutral/negative split
- per-source breakdown
- timeseries + momentum
- quality notes and anomaly messages

The provider is intentionally abstractable so you can replace this with an LLM/ML model later.

## Supabase Schema

Migration: `supabase/migrations/202603080001_init.sql`

Includes:

- `users`
- `searches`
- `tracked_entities`
- `sources`
- `source_items`
- `sentiment_results`
- `sentiment_timeseries`
- `extracted_topics`
- `entity_aliases`
- `ingestion_runs`
- `connector_status`

Also includes indexes and RLS policies for user-owned report data.

## Local Setup

1. Install deps:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

For Facebook, set:

- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_ACCESS_TOKEN`
- optional `FACEBOOK_GRAPH_BASE_URL` (defaults to `https://graph.facebook.com/v21.0`)

For Reddit, set:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- optional `REDDIT_USER_AGENT`

For OpenRouter, set:

- `OPENROUTER_API_KEY`
- optional `OPENROUTER_MAX_MODELS`

For RSS News, set:

- `ENABLE_NEWS_CONNECTOR`
- `NEWS_ENABLE_NASDAQ`
- `NEWS_ENABLE_SEEKING_ALPHA`
- `NEWS_ENABLE_INVESTING`
- `NEWS_ENABLE_MARKETWATCH` (default `false`)
- `NEWS_FETCH_TIMEOUT_MS`
- `NEWS_RETRY_COUNT`
- `NEWS_CACHE_TTL_SEC`
- `NEWS_SOURCE_ALLOWLIST` / `NEWS_SOURCE_BLOCKLIST`
- `NEWS_SOURCE_PRIORITY_*`
- `NEWS_WEIGHT_RECENCY` / `NEWS_WEIGHT_RELEVANCE` / `NEWS_WEIGHT_SOURCE_PRIORITY`
- feed URL templates:
  - `NEWS_NASDAQ_FEED_URL_TEMPLATE`
  - `NEWS_SEEKING_ALPHA_SYMBOL_FEED_URL_TEMPLATE`
  - `NEWS_INVESTING_FEED_URLS`
  - optional `NEWS_MARKETWATCH_FEED_URL`

3. Run Supabase migration in your project.

4. Start app:

```bash
npm run dev
```

5. Optional seed:

```bash
npm run seed
```

## API Endpoints

- `POST /api/search` run analysis
- `GET /api/report/:id` fetch report JSON
- `GET /api/history` list reports
- `GET /api/admin/health` connector health
- `GET /api/export/:id?format=csv|pdf` export

`GET /api/report/:id` now optionally includes:

```json
{
  "newsSummary": {
    "aggregateSentiment": 12.4,
    "articleCount": 18,
    "sourcesUsed": ["nasdaq", "seeking_alpha", "investing"],
    "lastUpdated": "2026-04-18T12:34:56.000Z",
    "articles": []
  }
}
```

## Notes on Source APIs

For production connectors, use official APIs and enforce platform policy constraints:

- Auth tokens in server-only env vars
- Rate-limit aware retry/backoff
- Robust error logging in `ingestion_runs` + `connector_status`
- No illegal scraping assumptions

RSS-specific note:

- This implementation uses RSS/Atom feeds only and does not scrape article pages.
- MarketWatch support is disabled by default. Enable only after validating licensing/usage terms for your deployment.

## Future Work

- Real API ingestion with background jobs (queue/worker)
- Watchlists and scheduled refresh
- Alerts on sentiment spikes
- Side-by-side entity comparison
- Trending entities dashboard
- True PDF generation
