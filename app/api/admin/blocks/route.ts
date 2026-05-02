import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { buildUtcDate, timeToMinutes } from "@/lib/time";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const blocks = await prisma.courtBlock.findMany({
      include: { court: true },
      orderBy: { startTime: "desc" },
      take: 100
    });

    return NextResponse.json({
      blocks: blocks.map((block) => ({
        ...block,
        startTime: block.startTime.toISOString(),
        endTime: block.endTime.toISOString()
      }))
    });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as
      | { courtId?: number; date?: string; startTime?: string; endTime?: string; title?: string; reason?: string }
      | null;

    if (!body?.courtId || !body.date || !body.startTime || !body.endTime || !body.title?.trim()) {
      return jsonError("Bitte Platz, Datum, Zeitraum und Titel fuer die Sperre angeben.");
    }

    const start = buildUtcDate(body.date, timeToMinutes(body.startTime));
    const end = buildUtcDate(body.date, timeToMinutes(body.endTime));

    if (end <= start) {
      return jsonError("Die Sperre muss nach dem Start enden.");
    }

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        courtId: Number(body.courtId),
        startTime: { lt: end },
        endTime: { gt: start },
        OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: new Date() } }]
      }
    });

    if (conflictingBooking) {
      return jsonError("In diesem Zeitraum gibt es bereits eine Buchung. Bitte zuerst bearbeiten oder loeschen.", 409);
    }

    const block = await prisma.courtBlock.create({
      data: {
        courtId: Number(body.courtId),
        startTime: start,
        endTime: end,
        title: body.title.trim(),
        reason: body.reason?.trim() || null
      }
    });

    return NextResponse.json({
      block: {
        ...block,
        startTime: block.startTime.toISOString(),
        endTime: block.endTime.toISOString()
      }
    });
  });
}
