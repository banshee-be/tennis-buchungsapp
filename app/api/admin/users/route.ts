import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: {
          select: { id: true }
        }
      }
    });

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        bookingCount: user.bookings.length,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        bookings: undefined
      }))
    });
  });
}
