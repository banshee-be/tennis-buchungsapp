import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isValidEmail, normalizeEmail, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clearRateLimit, getClientIp, getRateLimitStatus } from "@/lib/rate-limit";
import { createSession, toSessionUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email ? normalizeEmail(body.email) : "";
  const password = body?.password ?? "";
  const rateLimitKey = `login:${email || getClientIp(request)}`;
  const rateLimit = await getRateLimitStatus(rateLimitKey);

  if (rateLimit.limited) {
    const retryMinutes = Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 60_000));
    return jsonError(`Zu viele Fehlversuche. Bitte in etwa ${retryMinutes} Minuten erneut versuchen oder „Passwort vergessen“ verwenden.`, 429);
  }

  if (!email || !isValidEmail(email) || !password) {
    return jsonError("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    const failedAttempts = await checkRateLimit(rateLimitKey);
    if (failedAttempts.limited) {
      return jsonError("Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen oder „Passwort vergessen“ verwenden.", 429);
    }
    return jsonError("E-Mail oder Passwort ist falsch.", 401);
  }

  await clearRateLimit(rateLimitKey);
  await createSession(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({ actorUserId: user.id, action: "LOGIN_SUCCEEDED", entityType: "User", entityId: user.id, request });

  return NextResponse.json({ user: toSessionUser(user) });
}
