import { NextRequest, NextResponse } from "next/server";
import type { CsvImportUser } from "@/lib/admin-user-csv";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function dateOrNull(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as { rows?: CsvImportUser[] } | null;

    if (!body?.rows?.length) {
      return jsonError("Keine Importzeilen vorhanden.");
    }

    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of body.rows ?? []) {
        const existing = await tx.user.findFirst({
          where: {
            OR: [{ email: row.email ?? "" }, ...(row.memberNumber ? [{ memberNumber: row.memberNumber }] : [])]
          }
        });

        const data = {
          name: row.name,
          email: row.email || `${row.memberNumber}@import.local`,
          phoneNumber: row.phoneNumber,
          memberNumber: row.memberNumber,
          membershipType: row.membershipType,
          membershipStatus: row.membershipType === "EXTERNAL" ? "VERIFIED" : row.membershipStatus,
          role: row.role === "ADMIN" ? "USER" : row.role,
          contractType: row.contractType,
          contractStartDate: dateOrNull(row.contractStartDate),
          contractEndDate: dateOrNull(row.contractEndDate),
          workHoursRequired: row.workHoursRequired,
          workHoursDone: row.workHoursDone ?? 0,
          keyType: row.keyType,
          hasKey: row.keyType !== "NONE",
          keyIssuedAt: dateOrNull(row.keyIssuedAt),
          keyReturnedAt: dateOrNull(row.keyReturnedAt)
        };

        if (existing) {
          await tx.user.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await tx.user.create({ data });
          created += 1;
        }
      }
    });

    return NextResponse.json({ created, updated });
  });
}
