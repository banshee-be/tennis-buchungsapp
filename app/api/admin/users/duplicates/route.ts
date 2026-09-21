import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { findDuplicatePairs } from "@/lib/member-management";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("members.read");
    const users = await prisma.user.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, email: true, memberNumber: true, birthDate: true }
    });
    return NextResponse.json({ duplicates: findDuplicatePairs(users) });
  });
}
