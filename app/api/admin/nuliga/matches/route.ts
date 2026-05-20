import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { getNuLigaMatchSummary } from "@/lib/nuliga-matches";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    return NextResponse.json(await getNuLigaMatchSummary());
  });
}
