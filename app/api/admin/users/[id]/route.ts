import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const contractTypes = ["FULL_MEMBER", "FAMILY_MEMBER", "PASSIVE_MEMBER", "YOUTH_MEMBER", "SEASON_CARD", "NONE"] as const;
const keyTypes = ["NONE", "MAIN_CHANGING_COURTS", "MAIN_CHANGING_COURTS_CLUBROOM"] as const;

function optionalDate(value: string | null | undefined) {
  if (value === null) {
    return null;
  }
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | {
          membershipType?: "MEMBER" | "EXTERNAL";
          membershipStatus?: "PENDING" | "VERIFIED" | "REJECTED";
          memberNumber?: string | null;
          phoneNumber?: string | null;
          teamPlayerId?: string | null;
          contractType?: (typeof contractTypes)[number];
          contractStartDate?: string | null;
          contractEndDate?: string | null;
          annualFeeCents?: number | null;
          workHoursRequired?: number | null;
          workHoursDone?: number | null;
          contractNote?: string | null;
          hasKey?: boolean;
          keyType?: (typeof keyTypes)[number];
          keyIssuedAt?: string | null;
          keyReturnedAt?: string | null;
          keyNote?: string | null;
          adminNote?: string | null;
          isActive?: boolean;
          role?: "USER" | "ADMIN";
          name?: string;
        }
      | null;

    if (!body) {
      return jsonError("Keine Aenderungen angegeben.");
    }

    const membershipStatus = body.membershipType === "EXTERNAL" ? "VERIFIED" : body.membershipStatus;
    const memberNumber = body.membershipType === "EXTERNAL" ? null : body.memberNumber;
    const keyType = body.keyType && keyTypes.includes(body.keyType) ? body.keyType : undefined;
    const hasKey = keyType === "NONE" ? false : keyType ? true : body.hasKey;
    const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } });

    if (!existing) {
      return jsonError("Nutzer wurde nicht gefunden.", 404);
    }

    if (id === admin.id && body.role === "USER") {
      return jsonError("Du kannst dir nicht selbst die Adminrechte entziehen.");
    }

    if (existing.role === "ADMIN" && body.role === "USER") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return jsonError("Mindestens ein Admin muss erhalten bleiben.");
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        phoneNumber: body.phoneNumber === null ? null : body.phoneNumber?.trim() || undefined,
        membershipType: body.membershipType,
        membershipStatus,
        memberNumber: memberNumber === null ? null : memberNumber?.trim() || undefined,
        teamPlayerId: body.teamPlayerId === null ? null : body.teamPlayerId || undefined,
        contractType: body.contractType && contractTypes.includes(body.contractType) ? body.contractType : undefined,
        contractStartDate: optionalDate(body.contractStartDate),
        contractEndDate: optionalDate(body.contractEndDate),
        annualFeeCents: body.annualFeeCents === null ? null : body.annualFeeCents,
        workHoursRequired: body.workHoursRequired === null ? null : body.workHoursRequired,
        workHoursDone: body.workHoursDone === null ? undefined : body.workHoursDone,
        contractNote: body.contractNote === null ? null : body.contractNote?.trim() || undefined,
        hasKey,
        keyType,
        keyIssuedAt: optionalDate(body.keyIssuedAt),
        keyReturnedAt: optionalDate(body.keyReturnedAt),
        keyNote: body.keyNote === null ? null : body.keyNote?.trim() || undefined,
        adminNote: body.adminNote === null ? null : body.adminNote?.trim() || undefined,
        isActive: body.isActive,
        role: body.role
      }
    });

    return NextResponse.json({ user });
  });
}
