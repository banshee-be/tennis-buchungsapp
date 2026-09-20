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
import { createBookingCode, parseGuestDetails } from "@/lib/guest-bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { createCheckoutForBooking } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { calculateAmountCents, getSettings } from "@/lib/settings";
import { parseBookingInput } from "@/lib/time";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = (await request.json().catch(() => null)) as
      | {
          name?: unknown;
          email?: unknown;
          phone?: unknown;
          courtId?: number;
          date?: string;
          startTime?: string;
          durationMinutes?: number;
        }
      | null;
    const rateLimit = await checkRateLimit(`guest-booking:${getClientIp(request)}`, 10, 15 * 60_000);

    if (rateLimit.limited) {
      return jsonError("Zu viele Buchungsversuche. Bitte versuchen Sie es später erneut.", 429);
    }

    if (!body?.courtId || !body.date || !body.startTime || !body.durationMinutes) {
      return jsonError("Bitte Platz, Datum, Uhrzeit und Dauer auswählen.");
    }

    let guest;

    try {
      guest = parseGuestDetails(body);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Bitte Kontaktdaten prüfen.");
    }

    const settings = await getSettings();
    const parsed = parseBookingInput(
      { date: body.date, startTime: body.startTime, durationMinutes: Number(body.durationMinutes) },
      settings
    );
    const latestAllowedStart = new Date();
    latestAllowedStart.setDate(latestAllowedStart.getDate() + settings.maxAdvanceBookingDaysGuest);

    if (parsed.start > latestAllowedStart) {
      return jsonError("Dieses Datum liegt außerhalb des erlaubten Buchungszeitraums.", 409);
    }

    const activeBookings = await prisma.booking.count({
      where: {
        guestEmail: guest.email,
        startTime: { gt: new Date() },
        OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: new Date() } }]
      }
    });

    if (activeBookings >= settings.maxActiveBookingsPerUser) {
      return jsonError("Für diese E-Mail-Adresse ist die maximale Anzahl aktiver Buchungen erreicht.", 409);
    }

    const amountCents = calculateAmountCents(settings.externalHourlyRateCents, parsed.durationMinutes);
    let bookingIdForCleanup: string | null = null;

    try {
      const result = await prisma.$transaction(async (tx) => {
        await releaseExpiredPendingBookings(tx);
        await assertCourtCanBeBooked(tx, Number(body.courtId), parsed.start, parsed.end);

        const booking = await tx.booking.create({
          data: {
            userId: null,
            guestName: guest.name,
            guestEmail: guest.email,
            guestPhone: guest.phone,
            bookingCode: createBookingCode(),
            courtId: Number(body.courtId),
            startTime: parsed.start,
            endTime: parsed.end,
            durationMinutes: parsed.durationMinutes,
            status: "PENDING",
            paymentStatus: "PENDING",
            totalAmountCents: amountCents,
            expiresAt: new Date(Date.now() + 15 * 60_000)
          },
          include: bookingInclude()
        });

        await createSlotsForBooking(tx, booking.id, booking.courtId, parsed.slotStarts);
        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: "paypal",
            amountCents,
            currency: "eur",
            status: "PENDING"
          }
        });

        return { booking, payment };
      });
      bookingIdForCleanup = result.booking.id;

      const checkout = await createCheckoutForBooking({
        booking: result.booking,
        payment: result.payment,
        customer: guest,
        courtName: result.booking.court.name,
        origin: process.env.APP_URL || request.nextUrl.origin
      });

      await prisma.payment.update({
        where: { bookingId: result.booking.id },
        data: { providerSessionId: checkout.providerSessionId }
      });

      return NextResponse.json({
        booking: serializeBooking(result.booking),
        requiresPayment: true,
        checkoutUrl: checkout.checkoutUrl,
        message: "Der Termin ist 15 Minuten reserviert. Bitte PayPal-Zahlung abschließen."
      });
    } catch (error) {
      if (bookingIdForCleanup) {
        await prisma.$transaction((tx) => deletePendingBookingHold(tx, bookingIdForCleanup!));
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return jsonError("Dieses Zeitfenster wurde gerade von jemand anderem gebucht.", 409);
      }

      return jsonError(error instanceof Error ? error.message : "Buchung nicht möglich.", 409);
    }
  });
}
