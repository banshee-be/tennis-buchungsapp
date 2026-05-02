import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  assertCourtCanBeBooked,
  bookingInclude,
  createSlotsForBooking,
  releaseExpiredPendingBookings,
  serializeBooking
} from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { calculateAmountCents, getSettings } from "@/lib/settings";
import { isAdminEmail, requireAdmin } from "@/lib/session";
import { parseBookingInput } from "@/lib/time";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    await releaseExpiredPendingBookings(prisma);

    const bookings = await prisma.booking.findMany({
      include: bookingInclude(),
      orderBy: { startTime: "desc" },
      take: 200
    });

    return NextResponse.json({ bookings: bookings.map(serializeBooking) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as
      | {
          name?: string;
          email?: string;
          membershipStatus?: "MEMBER" | "EXTERNAL";
          courtId?: number;
          date?: string;
          startTime?: string;
          durationMinutes?: number;
          paymentStatus?: "NOT_REQUIRED" | "PAID" | "PENDING";
        }
      | null;

    if (!body?.name || !body.email || !body.courtId || !body.date || !body.startTime || !body.durationMinutes) {
      return jsonError("Bitte alle Felder fuer die manuelle Buchung ausfuellen.");
    }

    const email = body.email.trim().toLowerCase();
    const membershipStatus = body.membershipStatus === "MEMBER" ? "MEMBER" : "EXTERNAL";
    const settings = await getSettings();
    const parsed = parseBookingInput(
      {
        date: body.date,
        startTime: body.startTime,
        durationMinutes: Number(body.durationMinutes)
      },
      settings
    );
    const amountCents =
      membershipStatus === "EXTERNAL" ? calculateAmountCents(settings.externalHourlyRateCents, parsed.durationMinutes) : 0;

    try {
      const booking = await prisma.$transaction(async (tx) => {
        await releaseExpiredPendingBookings(tx);
        await assertCourtCanBeBooked(tx, Number(body.courtId), parsed.start, parsed.end);

        const user = await tx.user.upsert({
          where: { email },
          update: {
            name: body.name!.trim(),
            membershipStatus,
            role: isAdminEmail(email) ? "ADMIN" : undefined
          },
          create: {
            name: body.name!.trim(),
            email,
            membershipStatus,
            role: isAdminEmail(email) ? "ADMIN" : "USER"
          }
        });

        const created = await tx.booking.create({
          data: {
            userId: user.id,
            courtId: Number(body.courtId),
            startTime: parsed.start,
            endTime: parsed.end,
            durationMinutes: parsed.durationMinutes,
            status: "CONFIRMED",
            paymentStatus: body.paymentStatus ?? (membershipStatus === "MEMBER" ? "NOT_REQUIRED" : "PAID"),
            totalAmountCents: amountCents
          },
          include: bookingInclude()
        });

        await createSlotsForBooking(tx, created.id, Number(body.courtId), parsed.slotStarts);
        return created;
      });

      return NextResponse.json({ booking: serializeBooking(booking) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return jsonError("Dieses Zeitfenster wurde gerade von jemand anderem gebucht.", 409);
      }

      if (error instanceof Error) {
        return jsonError(error.message, 409);
      }

      throw error;
    }
  });
}
