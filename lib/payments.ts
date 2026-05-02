import Stripe from "stripe";
import type { Booking, Payment, User } from "@prisma/client";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function shouldUseStripeDemoMode() {
  return process.env.STRIPE_DEMO_MODE === "true" || (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV !== "production");
}

export async function createCheckoutForBooking(params: {
  booking: Booking;
  payment: Payment;
  user: Pick<User, "name" | "email">;
  courtName: string;
  origin: string;
}) {
  const { booking, payment, user, courtName, origin } = params;

  if (shouldUseStripeDemoMode()) {
    return {
      checkoutUrl: `${origin}/zahlung-demo?bookingId=${booking.id}`,
      providerSessionId: null
    };
  }

  const stripe = getStripe();

  if (!stripe) {
    throw new Error("Stripe ist nicht konfiguriert.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    client_reference_id: booking.id,
    success_url: `${origin}/zahlung-erfolgreich?bookingId=${booking.id}`,
    cancel_url: `${origin}/zahlung-abgebrochen?bookingId=${booking.id}`,
    metadata: {
      bookingId: booking.id,
      userEmail: user.email
    },
    payment_intent_data: {
      metadata: {
        bookingId: booking.id
      }
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: payment.amountCents,
          product_data: {
            name: `Tennisplatz buchen: ${courtName}`,
            description: `${new Intl.DateTimeFormat("de-DE", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC"
            }).format(booking.startTime)} Uhr`
          }
        }
      }
    ]
  });

  if (!session.url) {
    throw new Error("Stripe hat keine Checkout-URL zurueckgegeben.");
  }

  return {
    checkoutUrl: session.url,
    providerSessionId: session.id
  };
}
