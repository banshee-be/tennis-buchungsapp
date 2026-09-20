import { NextRequest } from "next/server";
import { createBookingCalendarFile } from "@/lib/calendar";
import { isValidGuestCancellationToken } from "@/lib/guest-bookings";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const booking = await prisma.booking.findUnique({ where: { bookingCode: code }, include: { court: true } });

  if (
    !booking?.guestEmail ||
    booking.status !== "CONFIRMED" ||
    !isValidGuestCancellationToken(booking.id, booking.guestEmail, token)
  ) {
    return Response.json({ error: "Kalendertermin nicht gefunden oder Link ungültig." }, { status: 404 });
  }

  const calendar = createBookingCalendarFile({
    bookingCode: booking.bookingCode!,
    courtName: booking.court.name,
    startTime: booking.startTime,
    endTime: booking.endTime
  });

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.bookingCode}.ics"`,
      "Cache-Control": "private, no-store"
    }
  });
}
