import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { isActive?: boolean; notes?: string; name?: string } | null;

    if (!body) {
      return jsonError("Keine Aenderungen angegeben.");
    }

    const court = await prisma.court.update({
      where: { id: Number(id) },
      data: {
        isActive: body.isActive,
        notes: body.notes ?? undefined,
        name: body.name?.trim() || undefined
      }
    });

    return NextResponse.json({ court });
  });
}
