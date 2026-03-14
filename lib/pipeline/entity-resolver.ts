import { EntityResolution, SearchInput } from "@/lib/types/domain";

const aliasMap: Record<string, { canonical: string; category: "stock" | "sports" | "product" }> = {
  tsla: { canonical: "Tesla", category: "stock" },
  tesla: { canonical: "Tesla", category: "stock" },
  aapl: { canonical: "Apple Inc.", category: "stock" },
  apple: { canonical: "Apple", category: "product" },
  "detroit lions": { canonical: "Detroit Lions", category: "sports" },
  lions: { canonical: "Detroit Lions", category: "sports" },
  meta: { canonical: "Meta", category: "stock" },
  nike: { canonical: "Nike", category: "product" }
};

const ambiguousTerms: Record<string, string[]> = {
  apple: ["Apple Inc. (stock)", "Apple (brand/product)"],
  lions: ["Detroit Lions", "Other sports teams named Lions"],
  meta: ["Meta Platforms", "General term 'meta'"]
};

function inferCategory(query: string): "stock" | "sports" | "product" {
  if (/^[A-Z]{1,5}$/.test(query.trim())) return "stock";
  if (/team|league|player|fc|lions|nba|nfl|mlb|nhl/i.test(query)) return "sports";
  return "product";
}

export function resolveEntity(input: SearchInput): EntityResolution {
  const normalized = input.query.trim().toLowerCase();
  const mapped = aliasMap[normalized];
  const preferredCategory = input.category === "auto" ? undefined : input.category;

  const category = preferredCategory ? preferredCategory : mapped?.category ?? inferCategory(input.query);

  const disambiguationCandidates = ambiguousTerms[normalized];

  return {
    canonicalName: mapped?.canonical ?? input.query,
    category,
    confidence: disambiguationCandidates ? 0.62 : mapped ? 0.86 : 0.72,
    aliases: [input.query, mapped?.canonical ?? input.query],
    disambiguationRequired: Boolean(disambiguationCandidates && input.category === "auto"),
    candidates: disambiguationCandidates
  };
}
