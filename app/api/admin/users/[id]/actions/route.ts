import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { getPublicAppUrl, sendMemberEmail } from "@/lib/email";
import { handleRoute, jsonError } from "@/lib/http";
import { hashResetToken } from "@/lib/passwords";
import { isMemberActionApplied } from "@/lib/member-actions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

const actions = ["approve", "reject", "pause", "resign", "reactivate", "archive", "invite", "password_reset"] as const;
type MemberAction = (typeof actions)[number];

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("members.write");
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { action?: MemberAction; reason?: string } | null;
    if (!body?.action || !actions.includes(body.action)) return jsonError("Unbekannte Mitgliederaktion.");
    if (id === admin.id && (body.action === "archive" || body.action === "pause" || body.action === "resign")) {
      return jsonError("Du kannst dein eigenes Administratorkonto nicht deaktivieren.");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return jsonError("Mitglied wurde nicht gefunden.", 404);
    if (isMemberActionApplied(body.action, existing)) {
      return NextResponse.json({ user: existing, alreadyApplied: true, emailStatus: "NOT_SENT" });
    }

    const now = new Date();
    const updates = {
      approve: { membershipType: "MEMBER", membershipStatus: "VERIFIED", lifecycleStatus: "ACTIVE", isActive: true, joinedAt: existing.joinedAt ?? now, archivedAt: null },
      reject: { membershipType: "MEMBER", membershipStatus: "REJECTED", lifecycleStatus: "ENDED", isActive: false, leftAt: now },
      pause: { lifecycleStatus: "PAUSED", isActive: false },
      resign: { lifecycleStatus: "RESIGNED", isActive: false, resignationAt: now, leftAt: now, resignationReason: body.reason?.trim() || null },
      reactivate: { membershipStatus: "VERIFIED", lifecycleStatus: "ACTIVE", isActive: true, leftAt: null, archivedAt: null },
      archive: { lifecycleStatus: "ARCHIVED", isActive: false, archivedAt: now }
    } as const;

    let user = existing;
    if (body.action in updates) {
      user = await prisma.user.update({ where: { id }, data: updates[body.action as keyof typeof updates] });
    }

    const emailKinds = {
      approve: "APPROVED",
      reject: "REJECTED",
      pause: "PAUSED",
      reactivate: "REACTIVATED"
    } as const;
    let emailStatus: string | null = null;

    if (body.action === "invite" || body.action === "password_reset") {
      const token = randomBytes(32).toString("base64url");
      await prisma.passwordResetToken.create({
        data: { userId: id, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + 60 * 60_000) }
      });
      const kind = body.action === "invite" ? "INVITATION" : "PASSWORD_RESET";
      const key = `member-${kind.toLowerCase()}-${id}-${now.toISOString().slice(0, 13)}`;
      const log = await prisma.memberEmail.upsert({
        where: { idempotencyKey: key },
        create: { userId: id, kind, idempotencyKey: key },
        update: {}
      });
      if (log.status !== "SENT") {
        try {
          const providerId = await sendMemberEmail({
            email: user.email,
            name: user.name,
            kind,
            actionUrl: `${getPublicAppUrl()}/passwort-zuruecksetzen?token=${token}`,
            idempotencyKey: key
          });
          await prisma.memberEmail.update({ where: { id: log.id }, data: { status: "SENT", providerId, sentAt: now, error: null } });
          emailStatus = "SENT";
        } catch (error) {
          await prisma.memberEmail.update({ where: { id: log.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : "Unbekannter Fehler" } });
          throw error;
        }
      } else emailStatus = "ALREADY_SENT";
    } else if (body.action in emailKinds) {
      const kind = emailKinds[body.action as keyof typeof emailKinds];
      const key = `member-${kind.toLowerCase()}-${id}-${user.updatedAt.toISOString()}`;
      const log = await prisma.memberEmail.create({ data: { userId: id, kind, idempotencyKey: key } });
      try {
        const providerId = await sendMemberEmail({ email: user.email, name: user.name, kind, idempotencyKey: key });
        await prisma.memberEmail.update({ where: { id: log.id }, data: { status: "SENT", providerId, sentAt: now } });
        emailStatus = "SENT";
      } catch (error) {
        await prisma.memberEmail.update({ where: { id: log.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : "Unbekannter Fehler" } });
        emailStatus = "FAILED";
      }
    }

    await writeAuditLog({
      actorUserId: admin.id,
      action: `MEMBER_${body.action.toUpperCase()}`,
      entityType: "User",
      entityId: id,
      details: { reason: body.reason ?? null, before: existing.lifecycleStatus, after: user.lifecycleStatus, emailStatus },
      request
    });
    return NextResponse.json({ user, emailStatus });
  });
}
