import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RateLimitRow = { count: number; resetAt: Date };

export async function getRateLimitStatus(key: string, limit = 5) {
  const current = await prisma.rateLimitBucket.findUnique({ where: { key }, select: { count: true, resetAt: true } });
  const now = new Date();
  const active = Boolean(current && current.resetAt > now);
  return {
    limited: Boolean(active && current && current.count >= limit),
    remaining: active ? Math.max(0, limit - (current?.count ?? 0)) : limit,
    resetAt: active ? current?.resetAt ?? now : now
  };
}

export async function clearRateLimit(key: string) {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkRateLimit(key: string, limit = 5, windowMs = 15 * 60_000) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<RateLimitRow[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `);
  const current = rows[0];

  return {
    limited: Boolean(current && current.count >= limit),
    remaining: Math.max(0, limit - (current?.count ?? 1)),
    resetAt: current?.resetAt ?? resetAt
  };
}
