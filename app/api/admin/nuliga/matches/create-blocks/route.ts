import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { createBlocksForProposedMatches } from "@/lib/nuliga-matches";
import { requirePermission } from "@/lib/session";

export async function POST() {
  return handleRoute(async () => {
    await requirePermission("members.sports");
    const results = await createBlocksForProposedMatches();
    return NextResponse.json({
      results,
      created: results.reduce((sum, result) => sum + result.created, 0),
      warnings: results.flatMap((result) => result.warnings)
    });
  });
}
