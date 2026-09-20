import { NextRequest, NextResponse } from "next/server";
import { assertUserCanCancelBooking, cancelBooking } from "@/lib/bookings";
import { isValidGuestCancellationToken } from "@/lib/guest-bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { refundPayPalBooking } from "@/lib/payment-processing";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const rateLimit = await checkRateLimit(`guest-cancel:${getClientIp(request)}`, 10, 15 * 60_000);

    if (rateLimit.limited) {
      return jsonError("Zu viele Versuche. Bitte versuchen Sie es später erneut.", 429);
    }

    const body = (await request.json().catch(() => null)) as { code?: string; token?: string } | null;

    if (!body?.code || !body.token) {
      return jsonError("Buchungsnummer oder Sicherheitslink fehlt.");
    }

    const booking = await prisma.booking.findUnique({ where: { bookingCode: body.code.trim().toUpperCase() }, include: { payment: true } });

    if (
      !booking?.guestEmail ||
      booking.userId ||
      !isValidGuestCancellationToken(booking.id, booking.guestEmail, body.token)
    ) {
      return jsonError("Buchung nicht gefunden oder Sicherheitslink ungültig.", 404);
    }

    const settings = await getSettings();
    await assertUserCanCancelBooking(booking, settings.cancellationDeadlineHours);

    if (booking.payment?.status === "PAID") {
      await refundPayPalBooking(booking.id, "Vom Gast storniert und über PayPal zurückerstattet.");
      await writeAuditLog({ action: "GUEST_BOOKING_CANCELLED_AND_REFUNDED", entityType: "Booking", entityId: booking.id, request });
      return NextResponse.json({ message: "Buchung storniert. Die PayPal-Rückerstattung wurde veranlasst." });
    }

    await prisma.$transaction((tx) => cancelBooking(tx, booking.id, "Vom Gast storniert."));
    await writeAuditLog({ action: "GUEST_BOOKING_CANCELLED", entityType: "Booking", entityId: booking.id, request });
    return NextResponse.json({ message: "Buchung storniert." });
  });
}
