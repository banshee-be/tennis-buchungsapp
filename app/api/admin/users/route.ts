import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  return handleRoute(async () => {
    const admin = await requirePermission("members.read");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        birthDate: true,
        street: true,
        addressAdditional: true,
        postalCode: true,
        city: true,
        country: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        passwordHash: true,
        role: true,
        isActive: true,
        membershipType: true,
        membershipStatus: true,
        lifecycleStatus: true,
        memberNumber: true,
        joinedAt: true,
        leftAt: true,
        resignationAt: true,
        resignationReason: true,
        archivedAt: true,
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
            lk: true,
            nuLigaId: true,
            licenseNumber: true,
            birthYear: true,
            isCaptain: true,
            team: {
              select: { name: true, season: true }
            }
          }
        },
        teamPlayerLinks: {
          select: {
            teamPlayer: {
              select: {
                id: true,
                fullName: true,
                lk: true,
                nuLigaId: true,
                licenseNumber: true,
                birthYear: true,
                nation: true,
                rank: true,
                teamPosition: true,
                msg: true,
                info: true,
                isCaptain: true,
                team: { select: { name: true, season: true } }
              }
            }
          }
        },
        bookings: {
          select: { id: true }
        },
        contributions: { orderBy: { year: "desc" }, take: 3 },
        workHourEntries: { orderBy: { performedAt: "desc" }, take: 20 },
        keyAssignments: { orderBy: { issuedAt: "desc" }, take: 10 },
        memberEmails: { orderBy: { createdAt: "desc" }, take: 10 }
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
        teamPosition: true,
        lk: true,
        nuLigaId: true,
        nation: true,
        info: true,
        msg: true,
        team: {
          select: { name: true, season: true }
        },
        userLinks: {
          select: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        annualFeeCents: hasPermission(admin.role, "members.finance") ? user.annualFeeCents : null,
        contributions: hasPermission(admin.role, "members.finance") ? user.contributions : [],
        workHourEntries: hasPermission(admin.role, "members.write") ? user.workHourEntries : [],
        keyAssignments: hasPermission(admin.role, "members.keys") ? user.keyAssignments : [],
        memberEmails: hasPermission(admin.role, "members.write") ? user.memberEmails : [],
        hasAccount: Boolean(user.passwordHash),
        passwordHash: undefined,
        teamPlayers: user.teamPlayerLinks.map((link) => link.teamPlayer),
        bookingCount: user.bookings.length,
        contractStartDate: user.contractStartDate?.toISOString() ?? null,
        contractEndDate: user.contractEndDate?.toISOString() ?? null,
        keyIssuedAt: user.keyIssuedAt?.toISOString() ?? null,
        keyReturnedAt: user.keyReturnedAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        birthDate: user.birthDate?.toISOString() ?? null,
        joinedAt: user.joinedAt?.toISOString() ?? null,
        leftAt: user.leftAt?.toISOString() ?? null,
        resignationAt: user.resignationAt?.toISOString() ?? null,
        archivedAt: user.archivedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        bookings: undefined,
        teamPlayerLinks: undefined
      })),
      teamPlayers
    });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requirePermission("members.write");
    const body = (await request.json().catch(() => null)) as { name?: string; email?: string; memberNumber?: string; phoneNumber?: string } | null;
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    if (!name || !email || !email.includes("@")) return jsonError("Name und gültige E-Mail-Adresse sind erforderlich.");

    const duplicate = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(body?.memberNumber?.trim() ? [{ memberNumber: body.memberNumber.trim() }] : [])
        ]
      },
      select: { id: true, name: true, email: true }
    });
    if (duplicate) return jsonError(`Mögliche Dublette: ${duplicate.name} (${duplicate.email}).`, 409);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phoneNumber: body?.phoneNumber?.trim() || null,
        memberNumber: body?.memberNumber?.trim() || null,
        membershipType: "MEMBER",
        membershipStatus: "PENDING",
        lifecycleStatus: "ACTIVE",
        joinedAt: new Date(),
        role: "USER"
      }
    });
    await writeAuditLog({ actorUserId: admin.id, action: "MEMBER_CREATED", entityType: "User", entityId: user.id, request });
    return NextResponse.json({ user }, { status: 201 });
  });
}
