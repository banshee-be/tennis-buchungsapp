import { NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { getNuLigaSummary, importNuLigaClubData } from "@/lib/nuliga";
import { requirePermission } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("members.sports");
    return NextResponse.json(await getNuLigaSummary());
  });
}

export async function POST() {
  return handleRoute(async () => {
    await requirePermission("members.sports");

    try {
      return NextResponse.json(await importNuLigaClubData());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import fehlgeschlagen.";
      return jsonError(message, 502);
    }
  });
}
