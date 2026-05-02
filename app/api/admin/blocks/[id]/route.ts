import { NextRequest, NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    await prisma.courtBlock.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
