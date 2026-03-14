import { NextResponse } from "next/server";
import { listIngestionRuns } from "@/lib/repositories/report-repository";

export async function GET() {
  const runs = await listIngestionRuns();
  return NextResponse.json(runs);
}
