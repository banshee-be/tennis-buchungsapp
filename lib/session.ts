import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "tennis_session";

export type UserRole = "USER" | "ADMIN";
export type MembershipStatus = "MEMBER" | "EXTERNAL";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  membershipStatus: MembershipStatus;
};

function getSecret() {
  return process.env.AUTH_SECRET || "dev-secret-change-me-before-production";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function verifySignature(payload: string, signature: string) {
  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function toSessionUser(user: Pick<User, "id" | "name" | "email" | "role" | "membershipStatus">): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "ADMIN" ? "ADMIN" : "USER",
    membershipStatus: user.membershipStatus === "MEMBER" ? "MEMBER" : "EXTERNAL"
  };
}

export async function createSession(user: Pick<User, "id" | "name" | "email" | "role" | "membershipStatus">) {
  const payload = Buffer.from(JSON.stringify(toSessionUser(user))).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();
  const embeddedCookieMode = process.env.EMBEDDED_COOKIE_MODE === "true";

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: embeddedCookieMode ? "none" : "lax",
    secure: process.env.NODE_ENV === "production" || embeddedCookieMode,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function readSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !verifySignature(payload, signature)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await readSession();

  if (!session) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.id } });

  if (!user || user.role !== "ADMIN") {
    throw new Response("Kein Zugriff auf den Admin-Bereich", { status: 403 });
  }

  return toSessionUser(user);
}

export function isAdminEmail(email: string) {
  const configured = process.env.ADMIN_EMAILS ?? "";
  return configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}
