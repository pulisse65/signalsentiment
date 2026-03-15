import crypto from "node:crypto";
import { NormalizedItem, SourceItem } from "@/lib/types/domain";

function cleanText(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function redditNearDuplicateFingerprint(text: string) {
  const tokens = cleanText(text)
    .split(" ")
    .filter((token) => token.length > 3)
    .filter((token) => !["referral", "discount", "coupon", "code", "promo", "offer"].includes(token));
  const uniqueSorted = Array.from(new Set(tokens)).sort();
  return uniqueSorted.slice(0, 18).join("|");
}

export function normalizeContent(items: SourceItem[]): NormalizedItem[] {
  return items.map((item) => {
    const normalizedText = cleanText(`${item.title ?? ""} ${item.text}`);
    const dedupeHash = crypto.createHash("sha1").update(normalizedText).digest("hex");
    const ageHours = Math.max(0, (Date.now() - Date.parse(item.publishedAt)) / 3600000);
    return { ...item, normalizedText, dedupeHash, ageHours };
  });
}

export function dedupeContent(items: NormalizedItem[]) {
  const seen = new Set<string>();
  const seenRedditFingerprints = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.dedupeHash)) return false;

    if (item.source === "reddit") {
      const fingerprint = redditNearDuplicateFingerprint(`${item.title ?? ""} ${item.normalizedText}`);
      if (fingerprint && seenRedditFingerprints.has(fingerprint)) {
        return false;
      }
      if (fingerprint) {
        seenRedditFingerprints.add(fingerprint);
      }
    }

    seen.add(item.dedupeHash);
    return true;
  });
}
