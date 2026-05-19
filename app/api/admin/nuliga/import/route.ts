import { NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { getNuLigaSummary, importNuLigaClubData } from "@/lib/nuliga";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    return NextResponse.json(await getNuLigaSummary());
  });
}

export async function POST() {
  return handleRoute(async () => {
    await requireAdmin();

    try {
      return NextResponse.json(await importNuLigaClubData());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import fehlgeschlagen.";
      return jsonError(message, 502);
    }
  });
}
