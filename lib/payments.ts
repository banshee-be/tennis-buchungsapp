import type { Booking, Payment } from "@prisma/client";

type PayPalLink = { href: string; rel: string; method?: string };
type PayPalAmount = { currency_code?: string; value?: string };

export type PayPalOrder = {
  id: string;
  status: string;
  links?: PayPalLink[];
  purchase_units?: Array<{
    custom_id?: string;
    amount?: PayPalAmount;
    payments?: {
      captures?: Array<{ id: string; status: string; amount?: PayPalAmount; custom_id?: string }>;
    };
  }>;
};

type PayPalWebhookVerification = { verification_status?: string };

function paypalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function paypalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal ist nicht konfiguriert.");
  }

  return { clientId, clientSecret };
}

async function getPayPalAccessToken() {
  const { clientId, clientSecret } = paypalCredentials();
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    cache: "no-store"
  });
  const data = (await response.json().catch(() => null)) as { access_token?: string; error_description?: string } | null;

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || "PayPal-Zugriff konnte nicht autorisiert werden.");
  }

  return data.access_token;
}

async function paypalRequest<T>(path: string, options: RequestInit = {}, requestId?: string): Promise<T> {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId || crypto.randomUUID(),
      Prefer: "return=representation",
      ...options.headers
    },
    cache: "no-store"
  });
  const data = (await response.json().catch(() => null)) as (T & { message?: string; details?: Array<{ description?: string }> }) | null;

  if (!response.ok || !data) {
    const detail = data?.details?.[0]?.description;
    throw new Error(detail || data?.message || `PayPal-Anfrage fehlgeschlagen (${response.status}).`);
  }

  return data;
}

function centsToPayPalValue(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function createCheckoutForBooking(params: {
  booking: Booking;
  payment: Payment;
  customer: { name: string; email: string };
  courtName: string;
  origin: string;
}) {
  const { booking, payment, customer, courtName, origin } = params;
  const returnUrl = new URL("/api/payments/paypal-return", origin);
  returnUrl.searchParams.set("bookingId", booking.id);
  const cancelUrl = new URL("/api/payments/paypal-cancel", origin);
  cancelUrl.searchParams.set("bookingId", booking.id);

  const order = await paypalRequest<PayPalOrder>(
    "/v2/checkout/orders",
    {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: booking.id,
            custom_id: booking.id,
            invoice_id: booking.bookingCode || booking.id,
            description: `${courtName}, ${booking.startTime.toISOString().slice(0, 16).replace("T", " ")} Uhr`,
            amount: {
              currency_code: payment.currency.toUpperCase(),
              value: centsToPayPalValue(payment.amountCents)
            }
          }
        ],
        payer: {
          name: { given_name: customer.name.slice(0, 140) },
          email_address: customer.email
        },
        application_context: {
          brand_name: process.env.NEXT_PUBLIC_CLUB_NAME || "Tennisplatz-Buchung",
          landing_page: "LOGIN",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: returnUrl.toString(),
          cancel_url: cancelUrl.toString()
        }
      })
    },
    `create-${booking.id}`
  );
  const checkoutUrl = order.links?.find((link) => link.rel === "approve")?.href;

  if (!order.id || !checkoutUrl) {
    throw new Error("PayPal hat keine Zahlungsfreigabe-URL zurückgegeben.");
  }

  return { checkoutUrl, providerSessionId: order.id };
}

export async function getPayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export async function capturePayPalOrder(orderId: string, bookingId: string) {
  try {
    return await paypalRequest<PayPalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      { method: "POST", body: "{}" },
      `capture-${bookingId}`
    );
  } catch (error) {
    const existing = await getPayPalOrder(orderId).catch(() => null);

    if (existing?.status === "COMPLETED") {
      return existing;
    }

    throw error;
  }
}

export function paidCaptureFromOrder(order: PayPalOrder) {
  const purchaseUnit = order.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.find((entry) => entry.status === "COMPLETED");

  if (order.status !== "COMPLETED" || !capture?.id) {
    throw new Error("Die PayPal-Zahlung ist noch nicht abgeschlossen.");
  }

  return {
    bookingId: purchaseUnit?.custom_id || capture.custom_id || null,
    captureId: capture.id,
    currency: capture.amount?.currency_code?.toLowerCase() || "",
    amountCents: Math.round(Number(capture.amount?.value || "0") * 100)
  };
}

export async function refundPayPalCapture(captureId: string, bookingId: string) {
  return paypalRequest<{ id: string; status: string }>(
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    { method: "POST", body: "{}" },
    `refund-${bookingId}`
  );
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID ist nicht konfiguriert.");
  }

  const requiredHeaders = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time")
  };

  if (Object.values(requiredHeaders).some((value) => !value)) {
    return false;
  }

  const result = await paypalRequest<PayPalWebhookVerification>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({ ...requiredHeaders, webhook_id: webhookId, webhook_event: event })
  });

  return result.verification_status === "SUCCESS";
}
