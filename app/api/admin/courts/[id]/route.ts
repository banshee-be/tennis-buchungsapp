import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("courts.manage");
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

    await writeAuditLog({
      actorUserId: admin.id,
      action: "COURT_UPDATED",
      entityType: "Court",
      entityId: String(court.id),
      details: { name: court.name, isActive: court.isActive },
      request
    });

    return NextResponse.json({ court });
  });
}
