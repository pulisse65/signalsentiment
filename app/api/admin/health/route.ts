import { NextResponse } from "next/server";
import { getConnectorHealth } from "@/lib/repositories/report-repository";

export async function GET() {
  const status = await getConnectorHealth();
  return NextResponse.json(status);
}
