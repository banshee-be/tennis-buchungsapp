import { NextRequest, NextResponse } from "next/server";
import { confirmPaidBooking, serializeBooking } from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { shouldUseStripeDemoMode } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    if (!shouldUseStripeDemoMode()) {
      return jsonError("Demo-Zahlungen sind deaktiviert.", 403);
    }

    const session = await requireSession();
    const body = (await request.json().catch(() => null)) as { bookingId?: string } | null;

    if (!body?.bookingId) {
      return jsonError("Buchung fehlt.");
    }

    const booking = await prisma.booking.findUnique({ where: { id: body.bookingId } });

    if (!booking || (booking.userId !== session.id && session.role !== "ADMIN")) {
      return jsonError("Buchung nicht gefunden.", 404);
    }

    const confirmed = await confirmPaidBooking(body.bookingId, "demo_payment");

    if (!confirmed) {
      return jsonError("Buchung konnte nicht bestaetigt werden.", 409);
    }

    return NextResponse.json({ booking: serializeBooking(confirmed) });
  });
}
