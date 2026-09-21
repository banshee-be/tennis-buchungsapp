import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

type RecordBody = {
  recordId?: string;
  type?: "CONTRIBUTION" | "WORK_HOUR" | "KEY_ASSIGNMENT";
  year?: number;
  amountDueCents?: number;
  amountPaidCents?: number;
  status?: string;
  dueDate?: string | null;
  paidAt?: string | null;
  paymentMethod?: string | null;
  isExempt?: boolean;
  minutes?: number;
  activity?: string;
  performedAt?: string;
  correctionReason?: string | null;
  keyType?: "MAIN_CHANGING_COURTS" | "MAIN_CHANGING_COURTS_CLUBROOM";
  keyNumber?: string | null;
  issuedAt?: string;
  returnedAt?: string | null;
  depositCents?: number | null;
  depositStatus?: string;
  note?: string | null;
};

function dateOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("members.read");
    const { id } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        contributions: { orderBy: { year: "desc" } },
        workHourEntries: { orderBy: { performedAt: "desc" } },
        keyAssignments: { orderBy: { issuedAt: "desc" } },
        memberEmails: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!user) return jsonError("Mitglied wurde nicht gefunden.", 404);
    return NextResponse.json({
      contributions: hasPermission(admin.role, "members.finance") ? user.contributions : [],
      workHourEntries: hasPermission(admin.role, "members.write") ? user.workHourEntries : [],
      keyAssignments: hasPermission(admin.role, "members.keys") ? user.keyAssignments : [],
      memberEmails: hasPermission(admin.role, "members.write") ? user.memberEmails : []
    });
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as RecordBody | null;
    if (!body?.type) return jsonError("Datensatztyp fehlt.");
    const permission = body.type === "CONTRIBUTION" ? "members.finance" : body.type === "KEY_ASSIGNMENT" ? "members.keys" : "members.write";
    const admin = await requirePermission(permission);
    const member = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!member) return jsonError("Mitglied wurde nicht gefunden.", 404);

    let record: unknown;
    if (body.type === "CONTRIBUTION") {
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(body.amountDueCents) || body.amountDueCents! < 0) {
        return jsonError("Beitragsjahr oder Sollbetrag ist ungültig.");
      }
      record = await prisma.memberContribution.upsert({
        where: { userId_year: { userId: id, year } },
        create: {
          userId: id, year, amountDueCents: body.amountDueCents!, amountPaidCents: Math.max(0, body.amountPaidCents ?? 0),
          status: body.status || "OPEN", dueDate: dateOrNull(body.dueDate), paidAt: dateOrNull(body.paidAt),
          paymentMethod: body.paymentMethod?.trim() || null, isExempt: body.isExempt ?? false, note: body.note?.trim() || null
        },
        update: {
          amountDueCents: body.amountDueCents!, amountPaidCents: Math.max(0, body.amountPaidCents ?? 0), status: body.status || "OPEN",
          dueDate: dateOrNull(body.dueDate), paidAt: dateOrNull(body.paidAt), paymentMethod: body.paymentMethod?.trim() || null,
          isExempt: body.isExempt ?? false, note: body.note?.trim() || null
        }
      });
    } else if (body.type === "WORK_HOUR") {
      if (!Number.isInteger(body.minutes) || body.minutes === 0 || !body.activity?.trim() || !dateOrNull(body.performedAt)) {
        return jsonError("Minuten, Tätigkeit und Datum sind erforderlich.");
      }
      if (body.minutes! < 0 && !body.correctionReason?.trim()) return jsonError("Für eine Korrektur ist eine Begründung erforderlich.");
      record = await prisma.$transaction(async (tx) => {
        const entry = await tx.memberWorkHour.create({
          data: { userId: id, minutes: body.minutes!, activity: body.activity!.trim(), performedAt: dateOrNull(body.performedAt)!, correctionReason: body.correctionReason?.trim() || null, createdById: admin.id }
        });
        const sum = await tx.memberWorkHour.aggregate({ where: { userId: id }, _sum: { minutes: true } });
        await tx.user.update({ where: { id }, data: { workHoursDone: Math.max(0, Math.round((sum._sum.minutes ?? 0) / 60)) } });
        return entry;
      });
    } else {
      if (!body.keyType || !dateOrNull(body.issuedAt)) return jsonError("Schlüsselart und Ausgabedatum sind erforderlich.");
      record = await prisma.$transaction(async (tx) => {
        const entry = await tx.memberKeyAssignment.create({
          data: {
            userId: id, keyType: body.keyType!, keyNumber: body.keyNumber?.trim() || null, issuedAt: dateOrNull(body.issuedAt)!,
            returnedAt: dateOrNull(body.returnedAt), depositCents: body.depositCents ?? null, depositStatus: body.depositStatus || "NOT_REQUIRED",
            note: body.note?.trim() || null, createdById: admin.id
          }
        });
        await tx.user.update({
          where: { id },
          data: { hasKey: !entry.returnedAt, keyType: entry.returnedAt ? "NONE" : entry.keyType, keyIssuedAt: entry.issuedAt, keyReturnedAt: entry.returnedAt, keyNote: entry.note }
        });
        return entry;
      });
    }

    await writeAuditLog({ actorUserId: admin.id, action: `${body.type}_RECORDED`, entityType: body.type, entityId: id, details: { memberId: id }, request });
    return NextResponse.json({ record }, { status: 201 });
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("members.keys");
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as RecordBody | null;
    if (body?.type !== "KEY_ASSIGNMENT" || !body.recordId) return jsonError("Schlüsseleintrag fehlt.");
    const returnedAt = dateOrNull(body.returnedAt) ?? new Date();
    const existing = await prisma.memberKeyAssignment.findFirst({ where: { id: body.recordId, userId: id } });
    if (!existing) return jsonError("Schlüsseleintrag wurde nicht gefunden.", 404);
    if (existing.returnedAt) return NextResponse.json({ record: existing, alreadyApplied: true });

    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.memberKeyAssignment.update({ where: { id: existing.id }, data: { returnedAt, depositStatus: body.depositStatus || existing.depositStatus, note: body.note?.trim() || existing.note } });
      const otherKey = await tx.memberKeyAssignment.findFirst({ where: { userId: id, returnedAt: null, id: { not: existing.id } }, orderBy: { issuedAt: "desc" } });
      await tx.user.update({ where: { id }, data: { hasKey: Boolean(otherKey), keyType: otherKey?.keyType ?? "NONE", keyReturnedAt: returnedAt } });
      return updated;
    });
    await writeAuditLog({ actorUserId: admin.id, action: "KEY_ASSIGNMENT_RETURNED", entityType: "MemberKeyAssignment", entityId: record.id, details: { memberId: id }, request });
    return NextResponse.json({ record });
  });
}
