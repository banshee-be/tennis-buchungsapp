import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | { membershipStatus?: "MEMBER" | "EXTERNAL"; role?: "USER" | "ADMIN"; name?: string }
      | null;

    if (!body) {
      return jsonError("Keine Aenderungen angegeben.");
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        membershipStatus: body.membershipStatus,
        role: body.role
      }
    });

    return NextResponse.json({ user });
  });
}
