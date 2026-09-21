import { NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { importNuLigaMatches } from "@/lib/nuliga-matches";
import { requirePermission } from "@/lib/session";

export async function POST() {
  return handleRoute(async () => {
    await requirePermission("members.sports");

    try {
      return NextResponse.json(await importNuLigaMatches());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Spieltermine konnten nicht importiert werden.";
      return jsonError(message, 502);
    }
  });
}
