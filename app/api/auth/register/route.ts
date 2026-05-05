import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { hashPassword, isValidEmail, normalizeEmail, validatePassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { createSession, isAdminEmail, toSessionUser } from "@/lib/session";

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
  membershipType?: "MEMBER" | "EXTERNAL";
  memberNumber?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RegisterBody | null;
  const name = body?.name?.trim() ?? "";
  const email = body?.email ? normalizeEmail(body.email) : "";
  const password = body?.password ?? "";
  const passwordConfirm = body?.passwordConfirm ?? "";
  const membershipType = body?.membershipType === "MEMBER" ? "MEMBER" : "EXTERNAL";
  const memberNumber = membershipType === "MEMBER" ? body?.memberNumber?.trim() || null : null;

  if (name.length < 2) {
    return jsonError("Bitte geben Sie Ihren Namen ein.");
  }

  if (!email || !isValidEmail(email)) {
    return jsonError("Bitte geben Sie eine gueltige E-Mail-Adresse ein.");
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return jsonError(passwordError);
  }

  if (password !== passwordConfirm) {
    return jsonError("Die Passwoerter stimmen nicht ueberein.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    return jsonError("Diese E-Mail-Adresse ist bereits registriert.", 409);
  }

  const passwordHash = await hashPassword(password);
  const role = isAdminEmail(email) ? "ADMIN" : "USER";
  const membershipStatus = membershipType === "MEMBER" ? "PENDING" : "VERIFIED";

  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: {
          name,
          passwordHash,
          role,
          membershipType,
          membershipStatus,
          memberNumber
        }
      })
    : await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          membershipType,
          membershipStatus,
          memberNumber
        }
      });

  await createSession(user);

  return NextResponse.json({
    user: toSessionUser(user),
    message:
      membershipType === "MEMBER"
        ? "Dein Mitgliedsstatus wird vom Verein geprueft."
        : "Gastspieler koennen kostenpflichtige Plaetze buchen."
  });
}
