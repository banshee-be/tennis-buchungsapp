import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { deletePendingBookingHold } from "@/lib/bookings";
import { processCompletedPayPalOrder } from "@/lib/payment-processing";
import { capturePayPalOrder, getPayPalOrder, verifyPayPalWebhook } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

export async function POST(request: NextRequest) {
  const event = (await request.json().catch(() => null)) as PayPalWebhookEvent | null;

  if (!event?.id || !event.event_type) {
    return NextResponse.json({ error: "Ungültiges PayPal-Ereignis." }, { status: 400 });
  }

  try {
    if (!(await verifyPayPalWebhook(request.headers, event))) {
      return NextResponse.json({ error: "Ungültige PayPal-Signatur." }, { status: 400 });
    }

    const alreadyProcessed = await prisma.paymentEvent.findUnique({ where: { eventId: event.id } });

    if (alreadyProcessed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const orderId =
      event.event_type === "CHECKOUT.ORDER.APPROVED"
        ? event.resource?.id
        : event.resource?.supplementary_data?.related_ids?.order_id;

    if (event.event_type === "CHECKOUT.ORDER.APPROVED" && orderId) {
      const payment = await prisma.payment.findFirst({ where: { provider: "paypal", providerSessionId: orderId } });

      if (payment) {
        const order = await capturePayPalOrder(orderId, payment.bookingId);
        await processCompletedPayPalOrder(order, payment.bookingId);
      }
    } else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && orderId) {
      const order = await getPayPalOrder(orderId);
      await processCompletedPayPalOrder(order);
    } else if (["CHECKOUT.ORDER.VOIDED", "PAYMENT.CAPTURE.DENIED"].includes(event.event_type)) {
      const payment = orderId
        ? await prisma.payment.findFirst({ where: { provider: "paypal", providerSessionId: orderId } })
        : null;

      if (payment?.status === "PENDING") {
        await prisma.$transaction((tx) => deletePendingBookingHold(tx, payment.bookingId));
      }
    }

    await prisma.paymentEvent.create({
      data: { eventId: event.id, eventType: event.event_type, provider: "paypal" }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (error instanceof Error && error.message.includes("zurückerstattet")) {
      await prisma.paymentEvent.create({
        data: { eventId: event.id, eventType: event.event_type, provider: "paypal" }
      }).catch(() => null);
      return NextResponse.json({ received: true, refunded: true });
    }

    console.error("PayPal-Webhook konnte nicht verarbeitet werden.", error);
    return NextResponse.json({ error: "PayPal-Webhook konnte nicht verarbeitet werden." }, { status: 500 });
  }
}
