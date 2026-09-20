import { releaseExpiredPendingBookings } from "@/lib/bookings";
import { sendBookingReminderEmail } from "@/lib/email";
import { createGuestCancellationToken } from "@/lib/guest-bookings";
import { sendGuestConfirmationOnce } from "@/lib/payment-processing";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

function guestLinks(booking: { id: string; guestEmail: string; bookingCode: string }) {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
  const token = createGuestCancellationToken(booking.id, booking.guestEmail);
  const cancellationUrl = new URL("/gastbuchung/stornieren", base);
  const calendarUrl = new URL("/api/guest-bookings/calendar", base);

  for (const url of [cancellationUrl, calendarUrl]) {
    url.searchParams.set("code", booking.bookingCode);
    url.searchParams.set("token", token);
  }

  return { cancellationUrl: cancellationUrl.toString(), calendarUrl: calendarUrl.toString() };
}

export async function runDailyMaintenance() {
  const now = new Date();
  const settings = await getSettings();
  const released = await releaseExpiredPendingBookings(prisma);
  const confirmations = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      guestEmail: { not: null },
      confirmationEmailSentAt: null,
      emailRetryCount: { lt: 5 },
      startTime: { gt: new Date(now.getTime() - 24 * 60 * 60_000) }
    },
    select: { id: true },
    take: 50
  });
  let confirmationsRetried = 0;

  for (const booking of confirmations) {
    try {
      await sendGuestConfirmationOnce(booking.id);
      confirmationsRetried += 1;
    } catch {
      // Fehler und Versuchszahl werden von sendGuestConfirmationOnce gespeichert.
    }
  }

  const reminderEnd = new Date(now.getTime() + settings.reminderHoursBefore * 60 * 60_000);
  const reminders = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      guestEmail: { not: null },
      guestName: { not: null },
      bookingCode: { not: null },
      reminderEmailSentAt: null,
      startTime: { gt: now, lte: reminderEnd }
    },
    include: { court: true },
    take: 100
  });
  let remindersSent = 0;

  for (const booking of reminders) {
    const links = guestLinks({ id: booking.id, guestEmail: booking.guestEmail!, bookingCode: booking.bookingCode! });
    try {
      await sendBookingReminderEmail({
        name: booking.guestName!,
        email: booking.guestEmail!,
        bookingCode: booking.bookingCode!,
        courtName: booking.court.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalAmountCents: booking.totalAmountCents,
        ...links
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderEmailSentAt: now, lastEmailError: null }
      });
      remindersSent += 1;
    } catch (error) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          lastEmailError: error instanceof Error ? error.message.slice(0, 500) : "Unbekannter E-Mail-Fehler",
          emailRetryCount: { increment: 1 }
        }
      });
    }
  }

  const retentionCutoff = new Date(now.getTime() - settings.guestDataRetentionDays * 24 * 60 * 60_000);
  const anonymized = await prisma.booking.updateMany({
    where: {
      userId: null,
      guestDataAnonymizedAt: null,
      endTime: { lt: retentionCutoff },
      status: { in: ["CONFIRMED", "CANCELLED"] }
    },
    data: {
      guestName: null,
      guestEmail: null,
      guestPhone: null,
      guestDataAnonymizedAt: now
    }
  });
  const rateLimitsDeleted = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } });

  return {
    releasedPendingBookings: released,
    confirmationsRetried,
    remindersSent,
    guestBookingsAnonymized: anonymized.count,
    rateLimitBucketsDeleted: rateLimitsDeleted.count
  };
}
