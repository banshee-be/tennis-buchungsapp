import { NextRequest, NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await context.params;
    await prisma.courtBlock.delete({ where: { id } });
    await writeAuditLog({
      actorUserId: admin.id,
      action: "COURT_BLOCK_DELETED",
      entityType: "CourtBlock",
      entityId: id,
      request
    });
    return NextResponse.json({ ok: true });
  });
}
