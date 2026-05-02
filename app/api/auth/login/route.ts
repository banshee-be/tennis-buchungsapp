import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createSession, isAdminEmail, toSessionUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { name?: string; email?: string } | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();

  if (!name || name.length < 2) {
    return jsonError("Bitte geben Sie Ihren Namen ein.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Bitte geben Sie eine gueltige E-Mail-Adresse ein.");
  }

  const role = isAdminEmail(email) ? "ADMIN" : "USER";
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role
    },
    create: {
      name,
      email,
      role,
      membershipStatus: role === "ADMIN" ? "MEMBER" : "EXTERNAL"
    }
  });

  await createSession(user);

  return NextResponse.json({ user: toSessionUser(user) });
}
