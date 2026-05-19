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
        phoneNumber: true,
        role: true,
        isActive: true,
        membershipType: true,
        membershipStatus: true,
        memberNumber: true,
        contractType: true,
        contractStartDate: true,
        contractEndDate: true,
        annualFeeCents: true,
        workHoursRequired: true,
        workHoursDone: true,
        contractNote: true,
        hasKey: true,
        keyType: true,
        keyIssuedAt: true,
        keyReturnedAt: true,
        keyNote: true,
        adminNote: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        teamPlayer: {
          select: {
            id: true,
            fullName: true,
            team: {
              select: { name: true, season: true }
            }
          }
        },
        bookings: {
          select: { id: true }
        }
      }
    });

    const teamPlayers = await prisma.teamPlayer.findMany({
      where: { isActive: true },
      orderBy: [{ team: { name: "asc" } }, { rank: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        birthYear: true,
        licenseNumber: true,
        isCaptain: true,
        rank: true,
        team: {
          select: { name: true, season: true }
        }
      }
    });

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        bookingCount: user.bookings.length,
        contractStartDate: user.contractStartDate?.toISOString() ?? null,
        contractEndDate: user.contractEndDate?.toISOString() ?? null,
        keyIssuedAt: user.keyIssuedAt?.toISOString() ?? null,
        keyReturnedAt: user.keyReturnedAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        bookings: undefined
      })),
      teamPlayers
    });
  });
}
