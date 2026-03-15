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
  const runSalt = Math.floor(Math.random() * 100000);
  return Array.from({ length: 24 }).map((_, index) => {
    const template = templates[(index + runSalt) % templates.length];
    const ageHours = Math.floor((index / 24) * hoursWindow) + (index % 3);
    const publishedAt = new Date(now - ageHours * 3600 * 1000).toISOString();
    return {
      source,
      externalId: `${source}-${query}-${runSalt}-${index}`,
      url: `https://${source}.example.com/post/${encodeURIComponent(query)}-${index}`,
      author: `${source}_user_${index}`,
      title: `${query} discussion ${index + 1}`,
      text: `${query}: ${template.text}`,
      language: "en",
      publishedAt,
      engagement: {
        likes: 30 + index * 2 + (runSalt % 5),
        comments: 3 + (index % 9) + (runSalt % 3),
        views: 120 + index * 25 + (runSalt % 40),
        shares: 1 + (index % 5),
        upvotes: 20 + index * 2 + (runSalt % 7)
      }
    };
  });
}
