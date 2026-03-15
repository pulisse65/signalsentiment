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
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
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

    const maxModels = Math.max(1, Number(process.env.OPENROUTER_MAX_MODELS ?? "6"));

    try {
      const modelsResponse = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });

      if (!modelsResponse.ok) {
        throw new Error(`OpenRouter model list failed (${modelsResponse.status})`);
      }

      const modelsPayload = (await modelsResponse.json()) as ModelResponse;
      const models = (modelsPayload.data ?? []).slice(0, maxModels);

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

      const completions = await Promise.allSettled(
        models.map(async (model) => {
          const completionResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: model.id,
              temperature: 0.1,
              messages: [{ role: "user", content: prompt }]
            })
          });

          if (!completionResponse.ok) {
            throw new Error(`Model ${model.id} failed (${completionResponse.status})`);
          }

          const payload = (await completionResponse.json()) as CompletionResponse;
          const content = payload.choices?.[0]?.message?.content?.trim();
          if (!content) throw new Error(`Model ${model.id} returned empty content`);

          const item: SourceItem = {
            source: "openrouter",
            externalId: `${model.id}-${Date.now()}`,
            url: `https://openrouter.ai/models/${encodeURIComponent(model.id)}`,
            author: model.name ?? model.id,
            title: `OpenRouter model analysis: ${model.name ?? model.id}`,
            text: normalizeOutput(content, query.query),
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
        })
      );

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
            ? `OpenRouter analysis completed across ${items.length} models`
            : `OpenRouter completed on ${items.length}/${completions.length} models`
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
