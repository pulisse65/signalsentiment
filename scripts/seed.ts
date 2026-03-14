import { generateReport } from "@/lib/pipeline/report";

async function run() {
  const searches = [
    {
      query: "TSLA",
      category: "stock" as const,
      timeRange: "7d" as const,
      selectedSources: ["reddit", "youtube", "tiktok", "facebook"] as const,
      language: "en",
      minMentions: 3
    },
    {
      query: "Detroit Lions",
      category: "sports" as const,
      timeRange: "30d" as const,
      selectedSources: ["reddit", "youtube"] as const,
      language: "en",
      minMentions: 5
    },
    {
      query: "Nike running shoes",
      category: "product" as const,
      timeRange: "7d" as const,
      selectedSources: ["tiktok", "facebook", "youtube"] as const,
      language: "en",
      minMentions: 4
    }
  ];

  for (const search of searches) {
    const report = await generateReport({
      ...search,
      selectedSources: [...search.selectedSources]
    });
    console.log(`Seeded report ${report.reportId} for ${search.query}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
