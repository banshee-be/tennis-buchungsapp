import type { PayPalOrder } from "@/lib/payments";
import { confirmPaidBooking, markBookingRefunded } from "@/lib/bookings";
import { sendGuestBookingConfirmationEmail } from "@/lib/email";
import { createGuestCancellationToken } from "@/lib/guest-bookings";
import { paidCaptureFromOrder, refundPayPalCapture } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export async function sendGuestConfirmationOnce(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { court: true }
  });

  if (!booking?.guestEmail || !booking.guestName || !booking.bookingCode || booking.confirmationEmailSentAt) {
    return;
  }

  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, confirmationEmailSentAt: null },
    data: { confirmationEmailSentAt: new Date() }
  });

  if (claimed.count === 0) {
    return;
  }

  const token = createGuestCancellationToken(booking.id, booking.guestEmail);
  const cancellationUrl = new URL("/gastbuchung/stornieren", process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000");
  cancellationUrl.searchParams.set("code", booking.bookingCode);
  cancellationUrl.searchParams.set("token", token);
  const calendarUrl = new URL("/api/guest-bookings/calendar", process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000");
  calendarUrl.searchParams.set("code", booking.bookingCode);
  calendarUrl.searchParams.set("token", token);

  try {
    await sendGuestBookingConfirmationEmail({
      name: booking.guestName,
      email: booking.guestEmail,
      bookingCode: booking.bookingCode,
      courtName: booking.court.name,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalAmountCents: booking.totalAmountCents,
      cancellationUrl: cancellationUrl.toString(),
      calendarUrl: calendarUrl.toString()
    });
    await prisma.booking.update({ where: { id: bookingId }, data: { lastEmailError: null } });
  } catch (error) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        confirmationEmailSentAt: null,
        lastEmailError: error instanceof Error ? error.message.slice(0, 500) : "Unbekannter E-Mail-Fehler",
        emailRetryCount: { increment: 1 }
      }
    });
    throw error;
  }
}

export async function processCompletedPayPalOrder(order: PayPalOrder, expectedBookingId?: string) {
  const capture = paidCaptureFromOrder(order);
  const bookingId = expectedBookingId || capture.bookingId;

  if (!bookingId || (capture.bookingId && capture.bookingId !== bookingId)) {
    throw new Error("Die PayPal-Zahlung gehört nicht zu dieser Buchung.");
  }

  const before = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });

  if (!before?.payment || before.payment.provider !== "paypal" || before.payment.providerSessionId !== order.id) {
    throw new Error("Die PayPal-Zahlung konnte keiner Buchung zugeordnet werden.");
  }

  if (before.payment.amountCents !== capture.amountCents || before.payment.currency.toLowerCase() !== capture.currency) {
    const refund = await refundPayPalCapture(capture.captureId, bookingId);
    await markBookingRefunded(bookingId, refund.id, "PayPal-Betrag stimmte nicht mit der Buchung überein.");
    throw new Error("Der PayPal-Betrag stimmt nicht mit der Buchung überein und wurde zurückerstattet.");
  }

  const confirmed = await confirmPaidBooking(bookingId, capture.captureId, {
    amountCents: capture.amountCents,
    currency: capture.currency
  });

  if (!confirmed || confirmed.status !== "CONFIRMED" || confirmed.paymentStatus !== "PAID") {
    const refund = await refundPayPalCapture(capture.captureId, bookingId);
    await markBookingRefunded(bookingId, refund.id, "Zahlung nach Ablauf der Reservierung automatisch zurückerstattet.");
    throw new Error("Die Reservierung war bereits abgelaufen. Die Zahlung wurde zurückerstattet.");
  }

  await sendGuestConfirmationOnce(bookingId).catch((error) => {
    console.error("Buchungsbestätigung konnte noch nicht per E-Mail gesendet werden.", error);
  });
  await prisma.auditLog.create({
    data: { action: "GUEST_BOOKING_PAID", entityType: "Booking", entityId: bookingId, details: { captureId: capture.captureId } }
  }).catch(() => null);
  return confirmed;
}

export async function refundPayPalBooking(bookingId: string, reason: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });

  if (!booking?.payment || booking.payment.status !== "PAID") {
    return null;
  }

  if (booking.payment.provider !== "paypal" || !booking.payment.providerPaymentId) {
    throw new Error("Diese Zahlung muss manuell beim ursprünglichen Zahlungsanbieter erstattet werden.");
  }

  const refund = await refundPayPalCapture(booking.payment.providerPaymentId, bookingId);

  if (refund.status !== "COMPLETED" && refund.status !== "PENDING") {
    throw new Error("PayPal konnte die Rückerstattung nicht bestätigen.");
  }

  return markBookingRefunded(bookingId, refund.id, reason);
}
