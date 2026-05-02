import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession, toSessionUser } from "@/lib/session";

export async function GET() {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: toSessionUser(user) });
}
