import { NextRequest } from "next/server";
import { getReportById } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";

function toCsvRow(values: Array<string | number>) {
  return values
    .map((value) => {
      const v = String(value);
      return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
    })
    .join(",");
}

function createSimplePdf(lines: string[]) {
  const escape = (line: string) => line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = lines
    .map((line, index) => `BT /F1 12 Tf 72 ${770 - index * 18} Td (${escape(line)}) Tj ET`)
    .join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"
  ];

  let pdf = "%PDF-1.4\n";
  const xref: number[] = [0];
  objects.forEach((object) => {
    xref.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  xref.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const report = await getReportById(id, userId);
  if (!report) return new Response("Report not found", { status: 404 });

  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  if (format === "pdf") {
    const lines = [
      `SignalSentiment Report`,
      `Entity: ${report.entity.canonicalName}`,
      `Overall Score: ${report.overallScore}`,
      `Confidence: ${Math.round(report.confidence * 100)}%`,
      `Mentions: ${report.mentionVolume}`,
      `Momentum: ${report.momentum}`,
      `Generated At: ${report.generatedAt}`,
      `Notes: ${report.qualityNotes.join(" | ") || "none"}`
    ];
    const content = createSimplePdf(lines);

    return new Response(content, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.entity.canonicalName}-report.pdf"`
      }
    });
  }

  const rows: string[] = [];
  rows.push(toCsvRow(["metric", "value"]));
  rows.push(toCsvRow(["overall_score", report.overallScore]));
  rows.push(toCsvRow(["mention_volume", report.mentionVolume]));
  rows.push(toCsvRow(["confidence", report.confidence]));
  rows.push(toCsvRow(["momentum", report.momentum]));
  rows.push(toCsvRow(["positive_pct", report.breakdown.positivePct]));
  rows.push(toCsvRow(["neutral_pct", report.breakdown.neutralPct]));
  rows.push(toCsvRow(["negative_pct", report.breakdown.negativePct]));
  rows.push("");
  rows.push(toCsvRow(["timestamp", "sentiment_score", "mentions"]));
  report.timeseries.forEach((point) => rows.push(toCsvRow([point.timestamp, point.sentimentScore, point.mentions])));

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${report.entity.canonicalName}-report.csv"`
    }
  });
}
