import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isValidEmail, normalizeEmail, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createSession, toSessionUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email ? normalizeEmail(body.email) : "";
  const password = body?.password ?? "";
  const rateLimit = await checkRateLimit(`login:${email || getClientIp(request)}`);

  if (rateLimit.limited) {
    return jsonError("Zu viele Versuche. Bitte später erneut versuchen.", 429);
  }

  if (!email || !isValidEmail(email) || !password) {
    return jsonError("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError("E-Mail oder Passwort ist falsch.", 401);
  }

  await createSession(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({ actorUserId: user.id, action: "LOGIN_SUCCEEDED", entityType: "User", entityId: user.id, request });

  return NextResponse.json({ user: toSessionUser(user) });
}
