import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("settings.manage");
    const logs = await prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return NextResponse.json({ logs });
  });
}
