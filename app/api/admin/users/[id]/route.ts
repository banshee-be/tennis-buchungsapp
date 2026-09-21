import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission, normalizeRole } from "@/lib/permissions";

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
          birthDate?: string | null;
          street?: string | null;
          addressAdditional?: string | null;
          postalCode?: string | null;
          city?: string | null;
          country?: string | null;
          emergencyContactName?: string | null;
          emergencyContactPhone?: string | null;
          lifecycleStatus?: "ACTIVE" | "PAUSED" | "RESIGNED" | "ENDED" | "ARCHIVED";
          joinedAt?: string | null;
          leftAt?: string | null;
          resignationAt?: string | null;
          resignationReason?: string | null;
          teamPlayerId?: string | null;
          teamPlayerIds?: string[];
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
          role?: "USER" | "ADMIN" | "SUPER_ADMIN" | "MEMBER_MANAGER" | "SPORTS_MANAGER" | "TREASURER" | "COURT_MANAGER";
          name?: string;
        }
      | null;

    if (!body) {
      return jsonError("Keine Aenderungen angegeben.");
    }

    const limitedFields: Partial<Record<keyof NonNullable<typeof body>, "members.finance" | "members.keys" | "members.sports">> = {
      annualFeeCents: "members.finance",
      teamPlayerId: "members.sports",
      teamPlayerIds: "members.sports",
      hasKey: "members.keys",
      keyType: "members.keys",
      keyIssuedAt: "members.keys",
      keyReturnedAt: "members.keys",
      keyNote: "members.keys"
    };
    if (!hasPermission(admin.role, "members.write")) {
      const allowed = Object.keys(body).every((field) => {
        const permission = limitedFields[field as keyof NonNullable<typeof body>];
        return Boolean(permission && hasPermission(admin.role, permission));
      });
      if (!allowed) return jsonError("Du darfst diese Mitgliedsdaten nicht ändern.", 403);
    }

    const membershipStatus = body.membershipType === "EXTERNAL" ? "VERIFIED" : body.membershipStatus;
    const memberNumber = body.membershipType === "EXTERNAL" ? null : body.memberNumber;
    const keyType = body.keyType && keyTypes.includes(body.keyType) ? body.keyType : undefined;
    const hasKey = keyType === "NONE" ? false : keyType ? true : body.hasKey;
    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      return jsonError("Nutzer wurde nicht gefunden.", 404);
    }

    if (body.role && !hasPermission(admin.role, "members.roles")) {
      return jsonError("Du darfst keine Rollen ändern.", 403);
    }
    if ((body.annualFeeCents !== undefined) && !hasPermission(admin.role, "members.finance")) {
      return jsonError("Du darfst keine Beitragsdaten ändern.", 403);
    }
    if ((body.keyType !== undefined || body.hasKey !== undefined) && !hasPermission(admin.role, "members.keys")) {
      return jsonError("Du darfst keine Schlüsseldaten ändern.", 403);
    }
    if (body.teamPlayerIds && !hasPermission(admin.role, "members.sports")) {
      return jsonError("Du darfst keine Mannschaftszuordnungen ändern.", 403);
    }

    if (id === admin.id && body.role === "USER") {
      return jsonError("Du kannst dir nicht selbst die Adminrechte entziehen.");
    }

    if (hasPermission(existing.role, "members.roles") && body.role && !hasPermission(normalizeRole(body.role), "members.roles")) {
      const adminCount = await prisma.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
      if (adminCount <= 1) {
        return jsonError("Mindestens ein Admin muss erhalten bleiben.");
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: {
        name: body.name?.trim() || undefined,
        phoneNumber: body.phoneNumber === null ? null : body.phoneNumber?.trim() || undefined,
        birthDate: optionalDate(body.birthDate),
        street: body.street === null ? null : body.street?.trim() || undefined,
        addressAdditional: body.addressAdditional === null ? null : body.addressAdditional?.trim() || undefined,
        postalCode: body.postalCode === null ? null : body.postalCode?.trim() || undefined,
        city: body.city === null ? null : body.city?.trim() || undefined,
        country: body.country === null ? "Deutschland" : body.country?.trim() || undefined,
        emergencyContactName: body.emergencyContactName === null ? null : body.emergencyContactName?.trim() || undefined,
        emergencyContactPhone: body.emergencyContactPhone === null ? null : body.emergencyContactPhone?.trim() || undefined,
        membershipType: body.membershipType,
        membershipStatus,
        memberNumber: memberNumber === null ? null : memberNumber?.trim() || undefined,
        lifecycleStatus: body.lifecycleStatus,
        joinedAt: optionalDate(body.joinedAt),
        leftAt: optionalDate(body.leftAt),
        resignationAt: optionalDate(body.resignationAt),
        resignationReason: body.resignationReason === null ? null : body.resignationReason?.trim() || undefined,
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
      }});

      if (body.teamPlayerIds) {
        const uniqueIds = Array.from(new Set(body.teamPlayerIds.filter(Boolean)));
        await tx.userTeamPlayer.deleteMany({ where: { userId: id } });
        if (uniqueIds.length) await tx.userTeamPlayer.createMany({
          data: uniqueIds.map((teamPlayerId) => ({ userId: id, teamPlayerId })),
          skipDuplicates: true
        });
        await tx.user.update({ where: { id }, data: { teamPlayerId: uniqueIds[0] ?? null } });
      }
      return updated;
    });

    await writeAuditLog({
      actorUserId: admin.id,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: id,
      details: {
        changedFields: Object.keys(body).sort(),
        before: { membershipStatus: existing.membershipStatus, lifecycleStatus: existing.lifecycleStatus, role: existing.role, contractType: existing.contractType },
        after: { membershipStatus: user.membershipStatus, lifecycleStatus: user.lifecycleStatus, role: user.role, contractType: user.contractType }
      },
      request
    });

    return NextResponse.json({ user });
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    if (!hasPermission(admin.role, "members.write")) return jsonError("Du darfst Mitglieder nicht archivieren.", 403);
    const { id } = await context.params;
    if (id === admin.id) return jsonError("Du kannst dein eigenes Konto nicht archivieren.");
    const user = await prisma.user.update({
      where: { id },
      data: { archivedAt: new Date(), lifecycleStatus: "ARCHIVED", isActive: false }
    });
    await writeAuditLog({ actorUserId: admin.id, action: "MEMBER_ARCHIVED", entityType: "User", entityId: id, request });
    return NextResponse.json({ user });
  });
}
