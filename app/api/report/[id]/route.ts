import { NextRequest, NextResponse } from "next/server";
import { getReportById } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const report = await getReportById(id, userId);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}
