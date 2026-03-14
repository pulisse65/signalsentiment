import { NextResponse } from "next/server";
import { listReports } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  const reports = await listReports(userId);
  return NextResponse.json(reports);
}
