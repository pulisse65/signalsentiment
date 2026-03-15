import { NormalizedItem, SourceItem } from "@/lib/types/domain";

export function pickRepresentativeItems(items: Array<SourceItem | NormalizedItem>, maxItems = 60): SourceItem[] {
  if (items.length <= maxItems) return items.map((item) => ({ ...item }));

  const grouped = new Map<string, SourceItem[]>();
  items.forEach((item) => {
    const arr = grouped.get(item.source) ?? [];
    arr.push({ ...item });
    grouped.set(item.source, arr);
  });

  const buckets = Array.from(grouped.values());
  const selected: SourceItem[] = [];

  while (selected.length < maxItems && buckets.some((bucket) => bucket.length > 0)) {
    for (const bucket of buckets) {
      const next = bucket.shift();
      if (next) {
        selected.push(next);
        if (selected.length >= maxItems) break;
      }
    }
  }

  return selected;
}
