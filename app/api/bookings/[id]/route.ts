import { NextRequest, NextResponse } from "next/server";
import { assertUserCanCancelBooking, cancelBooking, serializeBooking } from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { refundPayPalBooking } from "@/lib/payment-processing";
import { requireSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { payment: true } });

    const canManageBookings = hasPermission(session.role, "bookings.manage");
    if (!booking || (booking.userId !== session.id && !canManageBookings)) {
      return jsonError("Buchung nicht gefunden.", 404);
    }

    if (!canManageBookings) {
      const settings = await getSettings();
      await assertUserCanCancelBooking(booking, settings.cancellationDeadlineHours);
    }

    if (booking.payment?.status === "PAID") {
      const refunded = await refundPayPalBooking(
        id,
        canManageBookings ? "Vom Admin storniert und zurückerstattet." : "Vom Nutzer storniert und zurückerstattet."
      );

      if (refunded) {
        return NextResponse.json({ booking: serializeBooking(refunded) });
      }
    }

    const cancelled = await prisma.$transaction((tx) =>
      cancelBooking(tx, id, canManageBookings ? "Vom Admin storniert." : "Vom Nutzer storniert.")
    );

    return NextResponse.json({ booking: serializeBooking(cancelled) });
  });
}
