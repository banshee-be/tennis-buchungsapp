import { NextRequest, NextResponse } from "next/server";
import { assertUserCanCancelBooking, cancelBooking, serializeBooking } from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking || (booking.userId !== session.id && session.role !== "ADMIN")) {
      return jsonError("Buchung nicht gefunden.", 404);
    }

    if (session.role !== "ADMIN") {
      const settings = await getSettings();
      await assertUserCanCancelBooking(booking, settings.cancellationDeadlineHours);
    }

    const cancelled = await prisma.$transaction((tx) =>
      cancelBooking(tx, id, session.role === "ADMIN" ? "Vom Admin storniert." : "Vom Nutzer storniert.")
    );

    return NextResponse.json({ booking: serializeBooking(cancelled) });
  });
}
