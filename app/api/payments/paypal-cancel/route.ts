import { NextRequest, NextResponse } from "next/server";
import { deletePendingBookingHold } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("bookingId");
  const origin = process.env.APP_URL || request.nextUrl.origin;

  if (bookingId) {
    const payment = await prisma.payment.findUnique({ where: { bookingId } });

    if (payment?.provider === "paypal" && payment.status === "PENDING") {
      await prisma.$transaction((tx) => deletePendingBookingHold(tx, bookingId));
    }
  }

  return NextResponse.redirect(new URL("/zahlung-abgebrochen", origin));
}
