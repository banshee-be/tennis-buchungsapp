import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  assertCourtCanBeBooked,
  bookingInclude,
  cancelBooking,
  createSlotsForBooking,
  releaseExpiredPendingBookings,
  serializeBooking
} from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { calculateAmountCents, getSettings } from "@/lib/settings";
import { isVerifiedMember, requireAdmin } from "@/lib/session";
import { parseBookingInput } from "@/lib/time";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | {
          status?: "PENDING" | "CONFIRMED" | "CANCELLED";
          paymentStatus?: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED";
          courtId?: number;
          date?: string;
          startTime?: string;
          durationMinutes?: number;
        }
      | null;

    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!existing) {
      return jsonError("Buchung nicht gefunden.", 404);
    }

    if (body?.status === "CANCELLED") {
      const cancelled = await prisma.$transaction((tx) => cancelBooking(tx, id, "Vom Admin storniert."));
      return NextResponse.json({ booking: serializeBooking(cancelled) });
    }

    const settings = await getSettings();
    const shouldReschedule = Boolean(body?.courtId || body?.date || body?.startTime || body?.durationMinutes);
    const parsed = shouldReschedule
      ? parseBookingInput(
          {
            date: body?.date ?? existing.startTime.toISOString().slice(0, 10),
            startTime: body?.startTime ?? existing.startTime.toISOString().slice(11, 16),
            durationMinutes: Number(body?.durationMinutes ?? existing.durationMinutes)
          },
          settings
        )
      : null;
    const courtId = Number(body?.courtId ?? existing.courtId);
    const amountCents =
      !isVerifiedMember(existing.user) && parsed
        ? calculateAmountCents(settings.externalHourlyRateCents, parsed.durationMinutes)
        : existing.totalAmountCents;

    try {
      const booking = await prisma.$transaction(async (tx) => {
        await releaseExpiredPendingBookings(tx);

        if (parsed) {
          await assertCourtCanBeBooked(tx, courtId, parsed.start, parsed.end, id);
          await tx.bookingSlot.deleteMany({ where: { bookingId: id } });
        }

        const updated = await tx.booking.update({
          where: { id },
          data: {
            courtId: parsed ? courtId : undefined,
            startTime: parsed?.start,
            endTime: parsed?.end,
            durationMinutes: parsed?.durationMinutes,
            totalAmountCents: amountCents,
            status: body?.status ?? existing.status,
            paymentStatus: body?.paymentStatus ?? existing.paymentStatus
          },
          include: bookingInclude()
        });

        if (parsed && updated.status !== "CANCELLED") {
          await createSlotsForBooking(tx, id, courtId, parsed.slotStarts);
        }

        return updated;
      });

      return NextResponse.json({ booking: serializeBooking(booking) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return jsonError("Dieses Zeitfenster ist bereits belegt.", 409);
      }

      if (error instanceof Error) {
        return jsonError(error.message, 409);
      }

      throw error;
    }
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    await prisma.booking.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
