import { NextRequest, NextResponse } from "next/server";
import { processCompletedPayPalOrder } from "@/lib/payment-processing";
import { capturePayPalOrder } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("bookingId");
  const orderId = request.nextUrl.searchParams.get("token");
  const origin = process.env.APP_URL || request.nextUrl.origin;

  if (!bookingId || !orderId) {
    return NextResponse.redirect(new URL("/zahlung-abgebrochen?reason=invalid", origin));
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { bookingId } });

    if (!payment || payment.provider !== "paypal" || payment.providerSessionId !== orderId) {
      throw new Error("PayPal-Zahlung konnte nicht zugeordnet werden.");
    }

    const order = await capturePayPalOrder(orderId, bookingId);
    await processCompletedPayPalOrder(order, bookingId);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { bookingCode: true } });
    const successUrl = new URL("/zahlung-erfolgreich", origin);

    if (booking?.bookingCode) {
      successUrl.searchParams.set("code", booking.bookingCode);
    }

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("PayPal-Rückkehr konnte nicht verarbeitet werden.", error);
    return NextResponse.redirect(new URL("/zahlung-abgebrochen?reason=processing", origin));
  }
}
