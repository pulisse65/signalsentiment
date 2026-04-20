import { CompanyProfile, NewsArticle, NewsSourceAdapter, NewsSourceName } from "@/lib/news-sources/base";
import { InvestingNewsSource } from "@/lib/news-sources/investing";
import { MarketWatchNewsSource } from "@/lib/news-sources/marketwatch";
import { NasdaqNewsSource } from "@/lib/news-sources/nasdaq";
import { SeekingAlphaNewsSource } from "@/lib/news-sources/seeking-alpha";
import { dedupeNewsArticles, DedupedNewsArticle } from "@/lib/services/news-dedupe";
import { filterRelevantNewsArticles, normalizeTickerSymbol } from "@/lib/services/news-relevance";
import { rangeToHours } from "@/lib/utils/time";

interface SourceError {
  source: NewsSourceName;
  message: string;
}

interface CircuitState {
  failures: number;
  openUntil?: number;
}

interface CacheEntry {
  expiresAt: number;
  value: NewsArticle[];
}

export interface NewsIngestionResult {
  articles: DedupedNewsArticle[];
  sourceErrors: SourceError[];
  fetchedCount: number;
  relevantCount: number;
  dedupedCount: number;
  sourcesUsed: string[];
}

const fetchCache = new Map<string, CacheEntry>();
const sourceCircuit = new Map<NewsSourceName, CircuitState>();

function structuredLog(event: string, payload: Record<string, unknown>) {
  console.info("[news_ingestion]", JSON.stringify({ event, ...payload }));
}

function parseCsvSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getAdapters(): NewsSourceAdapter[] {
  const all: NewsSourceAdapter[] = [
    new NasdaqNewsSource(),
    new SeekingAlphaNewsSource(),
    new InvestingNewsSource(),
    new MarketWatchNewsSource()
  ];

  const allowlist = parseCsvSet(process.env.NEWS_SOURCE_ALLOWLIST);
  const blocklist = parseCsvSet(process.env.NEWS_SOURCE_BLOCKLIST);

  return all.filter((adapter) => {
    if (!adapter.enabled) return false;
    if (allowlist.size > 0 && !allowlist.has(adapter.source)) return false;
    if (blocklist.has(adapter.source)) return false;
    return true;
  });
}

function getFromCache(cacheKey: string) {
  const cached = fetchCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    fetchCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCache(cacheKey: string, value: NewsArticle[]) {
  const ttlMs = Math.max(5000, Number(process.env.NEWS_CACHE_TTL_SEC ?? "300") * 1000);
  fetchCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

function getCircuitState(source: NewsSourceName) {
  return sourceCircuit.get(source) ?? { failures: 0 };
}

function markSourceFailure(source: NewsSourceName) {
  const state = getCircuitState(source);
  const failures = state.failures + 1;
  const threshold = Math.max(2, Number(process.env.NEWS_CIRCUIT_FAILURE_THRESHOLD ?? "3"));
  const openMs = Math.max(15000, Number(process.env.NEWS_CIRCUIT_OPEN_MS ?? "120000"));
  sourceCircuit.set(source, {
    failures,
    openUntil: failures >= threshold ? Date.now() + openMs : undefined
  });
}

function markSourceSuccess(source: NewsSourceName) {
  sourceCircuit.set(source, { failures: 0 });
}

function isCircuitOpen(source: NewsSourceName) {
  const state = getCircuitState(source);
  if (!state.openUntil) return false;
  if (Date.now() > state.openUntil) {
    sourceCircuit.set(source, { failures: 0 });
    return false;
  }
  return true;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs))
  ]);
}

async function fetchWithRetry(
  adapter: NewsSourceAdapter,
  symbol: string,
  companyProfile: CompanyProfile | undefined,
  windowHours: number
) {
  const timeoutMs = Math.max(3000, Number(process.env.NEWS_FETCH_TIMEOUT_MS ?? "12000"));
  const retries = Math.max(0, Number(process.env.NEWS_RETRY_COUNT ?? "1"));
  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await withTimeout(adapter.fetchForSymbol(symbol, companyProfile, windowHours), timeoutMs);
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      const backoffMs = 350 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      attempt += 1;
    }
  }

  return [];
}

function extractTickerCandidates(input: string, profile?: CompanyProfile) {
  const fromInput = input
    .split(/[^a-zA-Z0-9.\-:]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => /[a-zA-Z]/.test(part))
    .map((part) => normalizeTickerSymbol(part).canonical);
  const fromProfile = (profile?.tickerCandidates ?? []).map((ticker) => normalizeTickerSymbol(ticker).canonical);
  const all = Array.from(new Set([...fromInput, ...fromProfile])).filter((ticker) => ticker.length <= 8);

  const preferred = all.find((ticker) => /^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(ticker));
  return {
    symbol: preferred ?? all[0] ?? normalizeTickerSymbol(input).canonical,
    variants: Array.from(
      new Set(
        all.flatMap((ticker) => normalizeTickerSymbol(ticker).variants).concat(normalizeTickerSymbol(input).variants)
      )
    )
  };
}

export async function ingestNewsForSymbol(params: {
  query: string;
  timeRange: "24h" | "7d" | "30d" | "90d";
  companyProfile?: CompanyProfile;
}) {
  const adapters = getAdapters();
  const windowHours = rangeToHours(params.timeRange);
  const { symbol, variants } = extractTickerCandidates(params.query, params.companyProfile);

  const sourceErrors: SourceError[] = [];
  const rawArticles: NewsArticle[] = [];

  await Promise.all(
    adapters.map(async (adapter) => {
      if (isCircuitOpen(adapter.source)) {
        sourceErrors.push({
          source: adapter.source,
          message: "Temporarily skipped due to recent source failures (circuit open)"
        });
        return;
      }

      const cacheKey = [adapter.source, symbol, windowHours].join("|");
      const cached = getFromCache(cacheKey);
      if (cached) {
        structuredLog("source_cache_hit", {
          source: adapter.source,
          symbol,
          count: cached.length
        });
        rawArticles.push(...cached);
        return;
      }

      try {
        const sourceArticles = await fetchWithRetry(adapter, symbol, params.companyProfile, windowHours);
        setCache(cacheKey, sourceArticles);
        markSourceSuccess(adapter.source);
        rawArticles.push(...sourceArticles);
        structuredLog("source_fetch_success", {
          source: adapter.source,
          symbol,
          count: sourceArticles.length
        });
      } catch (error) {
        markSourceFailure(adapter.source);
        const message = error instanceof Error ? error.message : "unknown source error";
        sourceErrors.push({ source: adapter.source, message });
        structuredLog("source_fetch_error", {
          source: adapter.source,
          symbol,
          error: message
        });
      }
    })
  );

  const relevant = filterRelevantNewsArticles(rawArticles, variants, params.companyProfile);
  const deduped = dedupeNewsArticles(relevant);
  const sourcesUsed = Array.from(new Set(deduped.flatMap((article) => article.mergedSources)));

  structuredLog("ingestion_summary", {
    symbol,
    fetchedCount: rawArticles.length,
    relevantCount: relevant.length,
    dedupedCount: deduped.length,
    sourceErrors: sourceErrors.length
  });

  return {
    articles: deduped,
    sourceErrors,
    fetchedCount: rawArticles.length,
    relevantCount: relevant.length,
    dedupedCount: deduped.length,
    sourcesUsed
  } satisfies NewsIngestionResult;
}
