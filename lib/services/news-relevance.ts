import { CompanyProfile, NewsArticle } from "@/lib/news-sources/base";

export interface NewsRelevanceResult {
  article: NewsArticle;
  relevanceScore: number;
  matchReasons: string[];
}

const AMBIGUOUS_TICKERS = new Set([
  "A",
  "AN",
  "ALL",
  "ARE",
  "AS",
  "AT",
  "BE",
  "CAN",
  "FOR",
  "GO",
  "IT",
  "NOW",
  "ON",
  "SO",
  "US",
  "TV"
]);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsToken(text: string, token: string) {
  const matcher = new RegExp(`(^|[^A-Z0-9$])\\$?${escapeRegex(token)}([^A-Z0-9]|$)`, "i");
  return matcher.test(text);
}

export function normalizeTickerSymbol(raw: string) {
  const trimmed = raw.trim().toUpperCase();
  const noExchange = trimmed.replace(/^[A-Z]{2,10}:/, "");
  const cleaned = noExchange.replace(/\s+/g, "");
  const withDash = cleaned.replace(/\./g, "-");
  const withDot = cleaned.replace(/-/g, ".");
  const plain = cleaned.replace(/[.\-]/g, "");
  const variants = Array.from(new Set([cleaned, withDash, withDot, plain].filter(Boolean)));
  return {
    canonical: withDash,
    variants
  };
}

function toNormalizedText(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9$ ]/g, " ").replace(/\s+/g, " ").trim();
}

function buildCompanyTerms(companyProfile?: CompanyProfile) {
  if (!companyProfile) return [];
  return Array.from(new Set([companyProfile.canonicalName, ...companyProfile.aliases]))
    .map((name) => name.trim())
    .filter((name) => name.length >= 3)
    .map((name) => name.toUpperCase());
}

export function evaluateNewsRelevance(article: NewsArticle, tickerVariants: string[], companyProfile?: CompanyProfile): NewsRelevanceResult {
  const title = toNormalizedText(article.title);
  const summary = toNormalizedText(article.summary);
  const combined = `${title} ${summary}`.trim();
  const reasons: string[] = [];
  let score = 0;

  tickerVariants.forEach((variant) => {
    if (!variant) return;
    if (containsToken(title, variant)) {
      score += 0.45;
      reasons.push(`ticker:title:${variant}`);
    }
    if (containsToken(summary, variant)) {
      score += 0.25;
      reasons.push(`ticker:summary:${variant}`);
    }
    if (combined.includes(`$${variant}`)) {
      score += 0.15;
      reasons.push(`ticker:cashtag:${variant}`);
    }
  });

  const companyTerms = buildCompanyTerms(companyProfile);
  companyTerms.forEach((term) => {
    if (title.includes(term)) {
      score += 0.35;
      reasons.push(`company:title:${term}`);
    }
    if (summary.includes(term)) {
      score += 0.2;
      reasons.push(`company:summary:${term}`);
    }
  });

  const likelyAmbiguous = tickerVariants.some((variant) => variant.length <= 3 && AMBIGUOUS_TICKERS.has(variant));
  const hasCompanyMatch = reasons.some((reason) => reason.startsWith("company:"));
  if (likelyAmbiguous && !hasCompanyMatch) {
    score -= 0.2;
    reasons.push("penalty:ambiguous_ticker");
  }

  const relevanceScore = Math.max(0, Math.min(1, Number(score.toFixed(3))));

  const tickerMatches = tickerVariants.filter((variant) => containsToken(combined, variant));
  const companyMatches = companyTerms.filter((term) => combined.includes(term)).slice(0, 5);

  return {
    article: {
      ...article,
      tickerMatches: Array.from(new Set([...article.tickerMatches, ...tickerMatches])),
      companyMatches: Array.from(new Set([...article.companyMatches, ...companyMatches]))
    },
    relevanceScore,
    matchReasons: Array.from(new Set(reasons))
  };
}

export function filterRelevantNewsArticles(
  articles: NewsArticle[],
  tickerVariants: string[],
  companyProfile?: CompanyProfile,
  threshold = Number(process.env.NEWS_RELEVANCE_MIN ?? "0.35")
) {
  return articles
    .map((article) => evaluateNewsRelevance(article, tickerVariants, companyProfile))
    .filter((entry) => entry.relevanceScore >= threshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
