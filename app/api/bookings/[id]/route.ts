import { NextRequest, NextResponse } from "next/server";
import { cancelBooking, serializeBooking } from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking || (booking.userId !== session.id && session.role !== "ADMIN")) {
      return jsonError("Buchung nicht gefunden.", 404);
    }

    const cancelled = await prisma.$transaction((tx) => cancelBooking(tx, id, "Vom Nutzer storniert."));

    return NextResponse.json({ booking: serializeBooking(cancelled) });
  });
}
