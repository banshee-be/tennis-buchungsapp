import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { getNuLigaMatchSummary } from "@/lib/nuliga-matches";
import { requirePermission } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("members.sports");
    return NextResponse.json(await getNuLigaMatchSummary());
  });
}
