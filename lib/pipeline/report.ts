import crypto from "node:crypto";
import { collectSourceData } from "@/lib/connectors";
import { SearchInput, SentimentReport } from "@/lib/types/domain";
import { dedupeContent, normalizeContent } from "./normalize";
import { buildReportInsights, scoreSentiment, sourceBreakdown } from "./sentiment";
import { resolveEntity } from "./entity-resolver";
import { saveReportArtifacts } from "@/lib/repositories/report-repository";
import { pickRepresentativeItems } from "./representatives";

export async function generateReport(query: SearchInput, userId?: string): Promise<SentimentReport> {
  const entity = resolveEntity(query);
  const connectorResults = await collectSourceData(query);
  const rawItems = connectorResults
    .flatMap((result) => result.items)
    .filter((item) => item.language === (query.language ?? "en"));
  const normalized = dedupeContent(normalizeContent(rawItems));
  const scored = scoreSentiment(normalized);
  const insights = buildReportInsights(normalized);

  const qualityNotes: string[] = [];
  if (entity.disambiguationRequired) {
    qualityNotes.push("Entity may be ambiguous. Consider selecting a specific category for higher precision.");
  }
  if (normalized.length < query.minMentions) {
    qualityNotes.push(`Mention count (${normalized.length}) is below your minimum threshold (${query.minMentions}).`);
  }
  connectorResults.forEach((result) => {
    if (result.mode !== "live") {
      qualityNotes.push(
        `${result.source} is running in ${result.mode} mode: ${result.error ?? result.message ?? "non-live source data"}`
      );
    } else if (!result.healthy || result.error) {
      qualityNotes.push(`${result.source} connector issue: ${result.error ?? result.message ?? "unavailable"}`);
    }
  });

  const report: SentimentReport = {
    reportId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    query,
    entity,
    overallScore: scored.overallScore,
    mentionVolume: normalized.length,
    confidence: Number((Math.min(0.95, 0.45 + normalized.length / 200) * entity.confidence).toFixed(2)),
    breakdown: scored.breakdown,
    sourceBreakdown: sourceBreakdown(normalized),
    representativeItems: pickRepresentativeItems(normalized, 80),
    qualityNotes,
    ...insights
  };

  await saveReportArtifacts(report, normalized, connectorResults, userId);
  return report;
}
