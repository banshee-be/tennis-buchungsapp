import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("courts.read");
    const courts = await prisma.court.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ courts });
  });
}
