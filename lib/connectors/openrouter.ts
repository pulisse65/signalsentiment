import { SearchInput, SourceItem } from "@/lib/types/domain";
import { ConnectorResult, SourceConnector } from "./types";

interface OpenRouterModel {
  id: string;
  name?: string;
}

interface ModelResponse {
  data?: OpenRouterModel[];
}

interface CompletionResponse {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeOutput(raw: string, query: string) {
  const sentimentMatch = raw.match(/overall sentiment score\s*[:\-]\s*(positive|neutral|negative|mixed)/i);
  const trendMatch = raw.match(/trend direction\s*[:\-]\s*([^\n]+)/i);
  const distPositive = raw.match(/positive[^\d]{0,20}(\d{1,3})%/i)?.[1];
  const distNeutral = raw.match(/neutral[^\d]{0,20}(\d{1,3})%/i)?.[1];
  const distNegative = raw.match(/negative[^\d]{0,20}(\d{1,3})%/i)?.[1];

  const distribution =
    distPositive && distNeutral && distNegative
      ? `Positive ${distPositive}% / Neutral ${distNeutral}% / Negative ${distNegative}%`
      : "Not explicitly provided";

  return [
    `Query: ${query}`,
    `Overall Sentiment: ${sentimentMatch?.[1] ?? "not clearly stated"}`,
    `Sentiment Distribution: ${distribution}`,
    `Trend Direction: ${trendMatch?.[1]?.trim() ?? "not clearly stated"}`,
    "",
    "Model Analysis:",
    raw
  ].join("\n");
}

function buildPrompt(query: string) {
  return `You are a social sentiment analyst.

Analyze the current social sentiment for the phrase: "${query}".

Evaluate how the phrase is being discussed across online communities, including social media, forums, and news.

Provide:

1. Overall Sentiment Score
   - Positive / Neutral / Negative / Mixed
   - Approximate sentiment distribution if possible.

2. Key Narratives
   - The main ideas, opinions, or controversies associated with the phrase.

3. Platform Differences
   - How sentiment differs across platforms (Reddit, X/Twitter, TikTok, YouTube comments, news).

4. Representative Viewpoints
   - Examples of typical positive, negative, and neutral opinions.

5. Trend Direction
   - Is sentiment improving, worsening, or stable recently?

6. Risks or Opportunities
   - Any reputational risks, marketing opportunities, or cultural signals related to the phrase.

Keep the analysis concise but insightful.`;
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function applyModelFilters(models: OpenRouterModel[]) {
  const allowlist = parseList(process.env.OPENROUTER_MODEL_ALLOWLIST);
  const preferredOrder = parseList(process.env.OPENROUTER_MODEL_PREFERENCE);

  let filtered = models;
  if (allowlist.length > 0) {
    filtered = models.filter((model) => allowlist.some((allowed) => model.id.includes(allowed)));
  }

  if (preferredOrder.length === 0) return filtered;

  const rank = (modelId: string) => {
    const idx = preferredOrder.findIndex((pref) => modelId.includes(pref));
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };

  return [...filtered].sort((a, b) => {
    const rankA = rank(a.id);
    const rankB = rank(b.id);
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });
}

async function settleWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  runner: (item: T, index: number) => Promise<R>
) {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: safeConcurrency }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        try {
          const value = await runner(items[index], index);
          results[index] = { status: "fulfilled", value };
        } catch (error) {
          results[index] = { status: "rejected", reason: error };
        }
      }
    })
  );

  return results;
}

export class OpenRouterConnector implements SourceConnector {
  source = "openrouter" as const;
  enabled = process.env.ENABLE_OPENROUTER_CONNECTOR !== "false";

  async collect(query: SearchInput): Promise<ConnectorResult> {
    if (!this.enabled) {
      return {
        source: this.source,
        items: [],
        healthy: false,
        mode: "disabled",
        message: "Connector disabled by configuration"
      };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        source: this.source,
        items: [],
        healthy: false,
        mode: "disabled",
        message: "Missing OPENROUTER_API_KEY; OpenRouter connector not executed"
      };
    }

    const maxModels = Math.max(1, Number(process.env.OPENROUTER_MAX_MODELS ?? "3"));
    const timeoutMs = Math.max(5000, Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS ?? "60000"));
    const maxTokens = Math.max(150, Number(process.env.OPENROUTER_MAX_TOKENS ?? "500"));
    const retries = Math.max(0, Number(process.env.OPENROUTER_RETRIES ?? "1"));
    const concurrency = Math.max(1, Number(process.env.OPENROUTER_CONCURRENCY ?? "2"));

    try {
      const modelsResponse = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/models",
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          cache: "no-store"
        },
        timeoutMs
      );

      if (!modelsResponse.ok) {
        throw new Error(`OpenRouter model list failed (${modelsResponse.status})`);
      }

      const modelsPayload = (await modelsResponse.json()) as ModelResponse;
      const candidateModels = applyModelFilters(modelsPayload.data ?? []);
      const models = candidateModels.slice(0, maxModels);

      if (models.length === 0) {
        return {
          source: this.source,
          items: [],
          healthy: false,
          mode: "fallback",
          message: "No OpenRouter models available for sentiment run"
        };
      }

      const prompt = buildPrompt(query.query);
      let totalRetriesUsed = 0;

      const completions = await settleWithConcurrency(models, concurrency, async (model, modelIdx) => {
        let attempt = 0;
        while (true) {
          try {
            const completionResponse = await fetchWithTimeout(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: model.id,
                  temperature: 0.1,
                  max_tokens: maxTokens,
                  messages: [{ role: "user", content: prompt }]
                })
              },
              timeoutMs
            );

            if (!completionResponse.ok) {
              const retryable = completionResponse.status === 429 || completionResponse.status >= 500;
              if (retryable && attempt < retries) {
                attempt += 1;
                totalRetriesUsed += 1;
                await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
                continue;
              }
              throw new Error(`Model ${model.id} failed (${completionResponse.status})`);
            }

            const payload = (await completionResponse.json()) as CompletionResponse;
            const content = payload.choices?.[0]?.message?.content?.trim();
            if (!content) throw new Error(`Model ${model.id} returned empty content`);

            const usageText = payload.usage?.total_tokens ? `\nToken usage: ${payload.usage.total_tokens}` : "";

            const item: SourceItem = {
              source: "openrouter",
              externalId: `${model.id}-${Date.now()}-${modelIdx}`,
              url: `https://openrouter.ai/models/${encodeURIComponent(model.id)}`,
              author: model.name ?? model.id,
              title: `OpenRouter model analysis: ${model.name ?? model.id}`,
              text: `${normalizeOutput(content, query.query)}${usageText}`,
              language: query.language ?? "en",
              publishedAt: new Date().toISOString(),
              engagement: {
                likes: 0,
                comments: 0,
                views: 0,
                shares: 0,
                upvotes: 0
              }
            };

            return item;
          } catch (error) {
            const isAbortError = error instanceof Error && error.name === "AbortError";
            if ((isAbortError || error instanceof Error) && attempt < retries) {
              attempt += 1;
              totalRetriesUsed += 1;
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
              continue;
            }
            throw error;
          }
        }
      });

      const items = completions
        .filter((result): result is PromiseFulfilledResult<SourceItem> => result.status === "fulfilled")
        .map((result) => result.value);

      if (items.length === 0) {
        const failed = completions
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) => String(result.reason))
          .slice(0, 3)
          .join(" | ");

        return {
          source: this.source,
          items: [],
          healthy: false,
          mode: "fallback",
          message: "OpenRouter models failed to return usable analysis",
          error: failed || "No successful model completions"
        };
      }

      const failedCount = completions.length - items.length;

      return {
        source: this.source,
        items,
        healthy: failedCount === 0,
        mode: failedCount === 0 ? "live" : "fallback",
        message:
          failedCount === 0
            ? `OpenRouter analysis completed across ${items.length} models (retries used: ${totalRetriesUsed})`
            : `OpenRouter completed on ${items.length}/${completions.length} models (retries used: ${totalRetriesUsed})`
      };
    } catch (error) {
      return {
        source: this.source,
        items: [],
        healthy: false,
        mode: "fallback",
        message: "OpenRouter connector failed",
        error: error instanceof Error ? error.message : "Unknown OpenRouter connector error"
      };
    }
  }
}
