import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  assertCourtCanBeBooked,
  bookingInclude,
  createSlotsForBooking,
  deletePendingBookingHold,
  releaseExpiredPendingBookings,
  serializeBooking
} from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { createCheckoutForBooking } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { calculateAmountCents, getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session";
import { parseBookingInput } from "@/lib/time";

export async function GET() {
  return handleRoute(async () => {
    const session = await requireSession();
    await releaseExpiredPendingBookings(prisma);

    const bookings = await prisma.booking.findMany({
      where: { userId: session.id },
      include: bookingInclude(),
      orderBy: { startTime: "desc" }
    });

    return NextResponse.json({ bookings: bookings.map(serializeBooking) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = (await request.json().catch(() => null)) as
      | { courtId?: number; date?: string; startTime?: string; durationMinutes?: number }
      | null;

    if (!body?.courtId || !body.date || !body.startTime || !body.durationMinutes) {
      return jsonError("Bitte Platz, Datum, Uhrzeit und Dauer auswaehlen.");
    }

    const settings = await getSettings();
    const parsed = parseBookingInput(
      {
        date: body.date,
        startTime: body.startTime,
        durationMinutes: Number(body.durationMinutes)
      },
      settings
    );
    const user = await prisma.user.findUnique({ where: { id: session.id } });

    if (!user) {
      return jsonError("Bitte melden Sie sich erneut an.", 401);
    }

    const isMember = user.membershipStatus === "MEMBER";
    const amountCents = isMember ? 0 : calculateAmountCents(settings.externalHourlyRateCents, parsed.durationMinutes);
    let bookingIdForCleanup: string | null = null;

    try {
      const result = await prisma.$transaction(async (tx) => {
        await releaseExpiredPendingBookings(tx);
        await assertCourtCanBeBooked(tx, Number(body.courtId), parsed.start, parsed.end);

        const booking = await tx.booking.create({
          data: {
            userId: user.id,
            courtId: Number(body.courtId),
            startTime: parsed.start,
            endTime: parsed.end,
            durationMinutes: parsed.durationMinutes,
            status: isMember ? "CONFIRMED" : "PENDING",
            paymentStatus: isMember ? "NOT_REQUIRED" : "PENDING",
            totalAmountCents: amountCents,
            expiresAt: isMember ? null : new Date(Date.now() + 10 * 60_000)
          },
          include: bookingInclude()
        });

        await createSlotsForBooking(tx, booking.id, Number(body.courtId), parsed.slotStarts);

        const payment = isMember
          ? null
          : await tx.payment.create({
              data: {
                bookingId: booking.id,
                amountCents,
                currency: "eur",
                status: "PENDING"
              }
            });

        return { booking, payment };
      });

      bookingIdForCleanup = result.booking.id;

      if (isMember || !result.payment) {
        return NextResponse.json({
          booking: serializeBooking(result.booking),
          requiresPayment: false,
          message: "Buchung bestaetigt."
        });
      }

      const checkout = await createCheckoutForBooking({
        booking: result.booking,
        payment: result.payment,
        user,
        courtName: result.booking.court.name,
        origin: process.env.APP_URL ?? request.nextUrl.origin
      });

      await prisma.payment.update({
        where: { bookingId: result.booking.id },
        data: {
          providerSessionId: checkout.providerSessionId
        }
      });

      return NextResponse.json({
        booking: serializeBooking(result.booking),
        requiresPayment: true,
        checkoutUrl: checkout.checkoutUrl,
        message: "Bitte Zahlung abschliessen."
      });
    } catch (error) {
      if (bookingIdForCleanup) {
        await prisma.$transaction((tx) => deletePendingBookingHold(tx, bookingIdForCleanup!));
      }

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
