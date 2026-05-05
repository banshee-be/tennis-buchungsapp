import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        membershipType: true,
        membershipStatus: true,
        memberNumber: true,
        createdAt: true,
        updatedAt: true,
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
