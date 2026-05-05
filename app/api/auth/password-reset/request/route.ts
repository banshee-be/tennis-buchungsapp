import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl, sendPasswordResetEmail } from "@/lib/email";
import { isValidEmail, normalizeEmail, hashResetToken } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";

const NEUTRAL_MESSAGE = "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zuruecksetzen gesendet.";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email ? normalizeEmail(body.email) : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ message: NEUTRAL_MESSAGE });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = randomBytes(32).toString("base64url");
    const resetUrl = `${getPublicAppUrl()}/passwort-zuruecksetzen?token=${token}`;

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + 60 * 60_000)
      }
    });

    await sendPasswordResetEmail({ email, resetUrl });
  }

  return NextResponse.json({ message: NEUTRAL_MESSAGE });
}
