import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { isValidEmail, normalizeEmail, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { createSession, toSessionUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email ? normalizeEmail(body.email) : "";
  const password = body?.password ?? "";

  if (!email || !isValidEmail(email) || !password) {
    return jsonError("Bitte geben Sie eine gueltige E-Mail-Adresse ein.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError("E-Mail oder Passwort ist falsch.", 401);
  }

  await createSession(user);

  return NextResponse.json({ user: toSessionUser(user) });
}
