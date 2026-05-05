import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { hashPassword, hashResetToken, validatePassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { token?: string; password?: string; passwordConfirm?: string }
    | null;
  const token = body?.token ?? "";
  const password = body?.password ?? "";
  const passwordConfirm = body?.passwordConfirm ?? "";

  if (!token) {
    return jsonError("Der Link ist ungueltig oder abgelaufen.", 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return jsonError(passwordError);
  }

  if (password !== passwordConfirm) {
    return jsonError("Die Passwoerter stimmen nicht ueberein.");
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
    return jsonError("Der Link ist ungueltig oder abgelaufen.", 400);
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    })
  ]);

  return NextResponse.json({ message: "Das Passwort wurde aktualisiert." });
}
