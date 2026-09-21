import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { handleRoute, jsonError } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requirePermission("members.roles");
    const body = (await request.json().catch(() => null)) as { sourceUserId?: string; targetUserId?: string; confirmation?: string } | null;
    const sourceUserId = body?.sourceUserId;
    const targetUserId = body?.targetUserId;
    if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) return jsonError("Quelle und Ziel der Zusammenführung sind ungültig.");
    if (body?.confirmation !== "ZUSAMMENFÜHREN") return jsonError("Die Sicherheitsbestätigung fehlt.");
    if (sourceUserId === admin.id) return jsonError("Das aktuell verwendete Administratorkonto kann nicht zusammengeführt werden.");

    const [source, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: sourceUserId }, include: { contributions: true, teamPlayerLinks: true } }),
      prisma.user.findUnique({ where: { id: targetUserId }, include: { contributions: true } })
    ]);
    if (!source || !target) return jsonError("Mindestens eines der Mitglieder wurde nicht gefunden.", 404);
    if (hasPermission(source.role, "admin.access")) return jsonError("Administratorkonten müssen vor einer Zusammenführung auf die Nutzerrolle zurückgestuft werden.");

    const targetYears = new Set(target.contributions.map((entry) => entry.year));
    const conflictingYears = source.contributions.map((entry) => entry.year).filter((year) => targetYears.has(year));
    if (conflictingYears.length) {
      return jsonError(`Beiträge für ${conflictingYears.join(", ")} existieren in beiden Profilen. Bitte zuerst manuell klären.`, 409);
    }

    const merged = await prisma.$transaction(async (tx) => {
      if (source.teamPlayerLinks.length) {
        await tx.userTeamPlayer.createMany({
          data: source.teamPlayerLinks.map((link) => ({ userId: target.id, teamPlayerId: link.teamPlayerId })),
          skipDuplicates: true
        });
      }
      await tx.booking.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.memberContribution.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.memberWorkHour.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.memberKeyAssignment.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.memberEmail.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: source.id } });
      await tx.userTeamPlayer.deleteMany({ where: { userId: source.id } });

      const updatedTarget = await tx.user.update({
        where: { id: target.id },
        data: {
          phoneNumber: target.phoneNumber ?? source.phoneNumber,
          birthDate: target.birthDate ?? source.birthDate,
          street: target.street ?? source.street,
          addressAdditional: target.addressAdditional ?? source.addressAdditional,
          postalCode: target.postalCode ?? source.postalCode,
          city: target.city ?? source.city,
          emergencyContactName: target.emergencyContactName ?? source.emergencyContactName,
          emergencyContactPhone: target.emergencyContactPhone ?? source.emergencyContactPhone,
          memberNumber: target.memberNumber ?? source.memberNumber,
          joinedAt: target.joinedAt ?? source.joinedAt,
          adminNote: [target.adminNote, `Profil ${source.name} (${source.email}) wurde am ${new Date().toISOString()} zusammengeführt.`].filter(Boolean).join("\n")
        }
      });
      await tx.user.update({
        where: { id: source.id },
        data: {
          name: "[Zusammengeführt]",
          email: `merged-${source.id}@invalid.local`,
          phoneNumber: null,
          birthDate: null,
          street: null,
          addressAdditional: null,
          postalCode: null,
          city: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          passwordHash: null,
          memberNumber: null,
          role: "USER",
          isActive: false,
          lifecycleStatus: "ARCHIVED",
          archivedAt: new Date(),
          anonymizedAt: new Date(),
          adminNote: `Zusammengeführt in Mitglied ${target.id}.`
        }
      });
      return updatedTarget;
    });

    await writeAuditLog({
      actorUserId: admin.id,
      action: "MEMBER_DUPLICATE_MERGED",
      entityType: "User",
      entityId: target.id,
      details: { sourceUserId: source.id, targetUserId: target.id },
      request
    });
    return NextResponse.json({ user: merged });
  });
}
