import { z } from "zod";

export const searchSchema = z.object({
  query: z.string().min(1),
  category: z.enum(["stock", "sports", "product", "auto"]).default("auto"),
  timeRange: z.enum(["24h", "7d", "30d", "90d"]).default("7d"),
  language: z.string().default("en"),
  selectedSources: z.array(z.enum(["reddit", "youtube", "tiktok", "facebook", "openrouter"])).min(1),
  minMentions: z.number().int().nonnegative().default(3)
});

export type SearchPayload = z.infer<typeof searchSchema>;
