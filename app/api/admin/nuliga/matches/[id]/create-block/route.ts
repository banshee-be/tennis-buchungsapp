import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { createBlocksForMatch, skipMatchBlock } from "@/lib/nuliga-matches";
import { requirePermission } from "@/lib/session";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requirePermission("members.sports");
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };

    try {
      if (body.action === "skip") {
        const match = await skipMatchBlock(id);
        return NextResponse.json({ match });
      }

      return NextResponse.json(await createBlocksForMatch(id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Platzsperre konnte nicht erstellt werden.";
      return jsonError(message, 409);
    }
  });
}
