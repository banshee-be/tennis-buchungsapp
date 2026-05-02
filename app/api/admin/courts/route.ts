import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const courts = await prisma.court.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ courts });
  });
}
