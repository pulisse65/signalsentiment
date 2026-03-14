import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/pipeline/report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchSchema } from "@/lib/types/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = searchSchema.parse(body);
    const supabase = await createSupabaseServerClient();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    const report = await generateReport(input, data.user?.id);
    return NextResponse.json({ reportId: report.reportId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate report"
      },
      { status: 400 }
    );
  }
}
