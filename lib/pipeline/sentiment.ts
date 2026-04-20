import {
  NormalizedItem,
  SentimentBreakdown,
  SentimentReport,
  SourceBreakdown,
  ThemeSummary,
  TimePoint,
  TrendDirection
} from "@/lib/types/domain";
import { clamp } from "@/lib/utils/time";

const positiveLexicon = ["strong", "great", "solid", "improved", "bullish", "love", "confident", "win", "growth"];
const negativeLexicon = ["weak", "bad", "concerns", "criticism", "bearish", "loss", "poor", "risk", "injury"];
const themeStopWords = new Set([
  "about",
  "after",
  "again",
  "against",
  "being",
  "between",
  "could",
  "their",
  "there",
  "these",
  "those",
  "would",
  "while",
  "where",
  "which",
  "because",
  "thread",
  "reddit",
  "openrouter",
  "analysis",
  "overall",
  "sentiment",
  "score"
]);

function explicitScore(text: string) {
  const normalized = text.toLowerCase();

  const numericScore = normalized.match(/score[^\-\d]{0,20}(-?\d{1,3})(?:\.?\d+)?/i)?.[1];
  if (numericScore) {
    const value = Number(numericScore);
    if (!Number.isNaN(value)) return clamp(value / 100, -1, 1);
  }

  const positivePct = normalized.match(/positive[^\d]{0,20}(\d{1,3})%/)?.[1];
  const neutralPct = normalized.match(/neutral[^\d]{0,20}(\d{1,3})%/)?.[1];
  const negativePct = normalized.match(/negative[^\d]{0,20}(\d{1,3})%/)?.[1];
  if (positivePct && neutralPct && negativePct) {
    const p = Number(positivePct);
    const n = Number(negativePct);
    if (!Number.isNaN(p) && !Number.isNaN(n)) {
      return clamp((p - n) / 100, -1, 1);
    }
  }

  const label = normalized.match(/overall sentiment[^a-z]{0,20}(positive|neutral|negative|mixed)/)?.[1];
  if (label === "positive") return 0.6;
  if (label === "negative") return -0.6;
  if (label === "mixed") return 0.1;
  if (label === "neutral") return 0;

  return null;
}

function polarityScore(text: string) {
  const explicit = explicitScore(text);
  if (explicit !== null) return explicit;

  const positiveHits = positiveLexicon.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
  const negativeHits = negativeLexicon.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
  return clamp((positiveHits - negativeHits) / 3, -1, 1);
}

function getNumericMetadata(item: NormalizedItem, key: string) {
  const metadata = item.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}

function engagementWeight(item: NormalizedItem) {
  const { likes = 0, comments = 0, views = 0, shares = 0, upvotes = 0 } = item.engagement;
  const raw = likes * 0.7 + comments * 1.2 + shares * 1.5 + upvotes * 0.9 + views * 0.02;
  const recency = 1 / (1 + item.ageHours / 36);
  const baseWeight = Math.max(1, raw * recency);

  if (item.source !== "news") return baseWeight;

  const sourcePriority = getNumericMetadata(item, "sourcePriority") ?? 3;
  const relevanceScore = getNumericMetadata(item, "relevanceScore") ?? 0.5;

  const sourcePriorityWeight = Number(process.env.NEWS_WEIGHT_SOURCE_PRIORITY ?? "0.35");
  const relevanceWeight = Number(process.env.NEWS_WEIGHT_RELEVANCE ?? "0.4");
  const recencyWeight = Number(process.env.NEWS_WEIGHT_RECENCY ?? "0.25");

  const priorityMultiplier = 1 + Math.max(0, sourcePriorityWeight) * Math.max(0, (sourcePriority - 1) / 4);
  const relevanceMultiplier = 1 + Math.max(0, relevanceWeight) * Math.max(0, Math.min(1, relevanceScore));
  const recencyMultiplier = 1 + Math.max(0, recencyWeight) * recency;

  return Math.max(1, baseWeight * priorityMultiplier * relevanceMultiplier * recencyMultiplier);
}

function classify(score: number): "positive" | "neutral" | "negative" {
  if (score > 0.15) return "positive";
  if (score < -0.15) return "negative";
  return "neutral";
}

function aggregateBreakdown(labels: Array<"positive" | "neutral" | "negative">): SentimentBreakdown {
  const total = Math.max(labels.length, 1);
  const positive = labels.filter((x) => x === "positive").length;
  const neutral = labels.filter((x) => x === "neutral").length;
  const negative = labels.filter((x) => x === "negative").length;

  return {
    positivePct: Math.round((positive / total) * 100),
    neutralPct: Math.round((neutral / total) * 100),
    negativePct: Math.round((negative / total) * 100)
  };
}

function buildTimeseries(items: NormalizedItem[], weightedScores: number[]): TimePoint[] {
  const buckets = new Map<string, { weighted: number; weight: number; mentions: number }>();
  items.forEach((item, index) => {
    const date = new Date(item.publishedAt);
    date.setMinutes(0, 0, 0);
    const key = date.toISOString();
    const curr = buckets.get(key) ?? { weighted: 0, weight: 0, mentions: 0 };
    const w = engagementWeight(item);
    curr.weighted += weightedScores[index] * w;
    curr.weight += w;
    curr.mentions += 1;
    buckets.set(key, curr);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([timestamp, bucket]) => ({
      timestamp,
      sentimentScore: Math.round(((bucket.weighted / Math.max(bucket.weight, 1)) * 100 + Number.EPSILON) * 100) / 100,
      mentions: bucket.mentions
    }));
}

function detectMomentum(points: TimePoint[]): TrendDirection {
  if (points.length < 2) return "flat";
  const tail = points.slice(-Math.min(4, points.length));
  const start = tail[0].sentimentScore;
  const end = tail[tail.length - 1].sentimentScore;
  if (end - start > 6) return "up";
  if (start - end > 6) return "down";
  return "flat";
}

function extractThemes(items: NormalizedItem[]): { positive: ThemeSummary[]; negative: ThemeSummary[]; keywords: string[] } {
  const tokenCounts = new Map<string, number>();
  const positive = new Map<string, number>();
  const negative = new Map<string, number>();

  const toTerms = (text: string) => {
    const words = text
      .split(" ")
      .filter((word) => word.length >= 4 && word.length <= 24)
      .filter((word) => !themeStopWords.has(word))
      .filter((word) => !/^\d+$/.test(word));

    const bigrams: string[] = [];
    for (let idx = 0; idx < words.length - 1; idx += 1) {
      const a = words[idx];
      const b = words[idx + 1];
      if (themeStopWords.has(a) || themeStopWords.has(b)) continue;
      bigrams.push(`${a} ${b}`);
    }

    return Array.from(new Set([...words, ...bigrams])).slice(0, 25);
  };

  items.forEach((item) => {
    const terms = toTerms(item.normalizedText);
    const engagement = item.engagement.comments ?? item.engagement.upvotes ?? 0;
    const weight = 1 + Math.min(3, Math.log10(1 + Math.max(0, engagement)));

    terms.forEach((term) => tokenCounts.set(term, (tokenCounts.get(term) ?? 0) + weight));
    const score = polarityScore(item.normalizedText);
    if (score > 0.15) terms.slice(0, 8).forEach((term) => positive.set(term, (positive.get(term) ?? 0) + weight));
    if (score < -0.15) terms.slice(0, 8).forEach((term) => negative.set(term, (negative.get(term) ?? 0) + weight));
  });

  const toThemes = (map: Map<string, number>, sentiment: "positive" | "negative"): ThemeSummary[] =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, sentiment, count: Math.round(count) }));

  const keywords = Array.from(tokenCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  return { positive: toThemes(positive, "positive"), negative: toThemes(negative, "negative"), keywords };
}

export function scoreSentiment(items: NormalizedItem[]) {
  const weightedScores = items.map((item) => polarityScore(item.normalizedText));
  const labels = weightedScores.map(classify);
  const weights = items.map(engagementWeight);
  const weighted = weightedScores.reduce((sum, score, idx) => sum + score * weights[idx], 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const overallScore = Math.round(((weighted / Math.max(totalWeight, 1)) * 100 + Number.EPSILON) * 100) / 100;

  return {
    overallScore,
    breakdown: aggregateBreakdown(labels),
    labels
  };
}

export function scoreNormalizedText(text: string) {
  return polarityScore(text);
}

export function sourceBreakdown(items: NormalizedItem[]): SourceBreakdown[] {
  const grouped = new Map<string, NormalizedItem[]>();
  items.forEach((item) => grouped.set(item.source, [...(grouped.get(item.source) ?? []), item]));

  return Array.from(grouped.entries()).map(([source, sourceItems]) => {
    const scored = scoreSentiment(sourceItems);
    return {
      source: source as SourceBreakdown["source"],
      sentimentScore: scored.overallScore,
      mentions: sourceItems.length,
      breakdown: scored.breakdown
    };
  });
}

export function buildReportInsights(items: NormalizedItem[]) {
  const timeseries = buildTimeseries(items, items.map((item) => polarityScore(item.normalizedText)));
  const momentum = detectMomentum(timeseries);
  const themes = extractThemes(items);
  const anomalies: string[] = [];

  timeseries.forEach((point, idx) => {
    if (idx === 0) return;
    const prev = timeseries[idx - 1];
    if (Math.abs(point.sentimentScore - prev.sentimentScore) > 18) {
      anomalies.push(`Sentiment swing at ${new Date(point.timestamp).toLocaleString()} (${prev.sentimentScore} -> ${point.sentimentScore})`);
    }
  });

  return {
    timeseries,
    momentum,
    topPositiveThemes: themes.positive,
    topNegativeThemes: themes.negative,
    risingKeywords: themes.keywords,
    anomalies
  } satisfies Pick<
    SentimentReport,
    "timeseries" | "momentum" | "topPositiveThemes" | "topNegativeThemes" | "risingKeywords" | "anomalies"
  >;
}
