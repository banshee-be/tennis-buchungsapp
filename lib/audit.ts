import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
  request?: Request;
};

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details,
      ipAddress: input.request ? getClientIp(input.request) : null
    }
  });
}
