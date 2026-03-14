import { SourceName } from "@/lib/types/domain";

interface MockTemplate {
  text: string;
  tone: "positive" | "neutral" | "negative";
}

const templates: MockTemplate[] = [
  { text: "strong quarter and outlook", tone: "positive" },
  { text: "great performance and fan confidence", tone: "positive" },
  { text: "solid product update with useful features", tone: "positive" },
  { text: "mixed reactions and wait-and-see sentiment", tone: "neutral" },
  { text: "stable demand but uncertain short-term momentum", tone: "neutral" },
  { text: "concerns about quality and customer support", tone: "negative" },
  { text: "disappointing result and increased criticism", tone: "negative" }
];

export function buildMockItems(query: string, source: SourceName, hoursWindow: number) {
  const now = Date.now();
  return Array.from({ length: 24 }).map((_, index) => {
    const template = templates[index % templates.length];
    const ageHours = Math.floor((index / 24) * hoursWindow);
    const publishedAt = new Date(now - ageHours * 3600 * 1000).toISOString();
    return {
      source,
      externalId: `${source}-${query}-${index}`,
      url: `https://${source}.example.com/post/${encodeURIComponent(query)}-${index}`,
      author: `${source}_user_${index}`,
      title: `${query} discussion ${index + 1}`,
      text: `${query}: ${template.text}`,
      language: "en",
      publishedAt,
      engagement: {
        likes: 40 + index * 3,
        comments: 5 + (index % 11),
        views: 200 + index * 30,
        shares: 1 + (index % 6),
        upvotes: 30 + index * 2
      }
    };
  });
}
