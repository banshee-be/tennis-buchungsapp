import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { confirmPaidBooking, deletePendingBookingHold } from "@/lib/bookings";
import { getStripe } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe Webhook ist nicht konfiguriert." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Stripe-Signatur fehlt." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ungueltige Stripe-Signatur.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId ?? session.client_reference_id;

    if (bookingId && session.payment_status === "paid") {
      await confirmPaidBooking(bookingId, typeof session.payment_intent === "string" ? session.payment_intent : null);
    }
  }

  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId ?? session.client_reference_id;

    if (bookingId) {
      await prisma.$transaction((tx) => deletePendingBookingHold(tx, bookingId));
    }
  }

  return NextResponse.json({ received: true });
}
