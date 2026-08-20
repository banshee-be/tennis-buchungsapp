import { describe, expect, it } from "vitest";
import { paymentConfirmationDecision } from "@/lib/bookings";
import { paidCaptureFromOrder } from "@/lib/payments";

describe("PayPal-Zahlungsabschluss", () => {
  const now = new Date("2026-08-20T10:00:00.000Z");

  it("bestätigt eine erfolgreiche Zahlung innerhalb der Reservierungsfrist", () => {
    const capture = paidCaptureFromOrder({
      id: "ORDER-1",
      status: "COMPLETED",
      purchase_units: [
        {
          custom_id: "booking-1",
          payments: { captures: [{ id: "CAPTURE-1", status: "COMPLETED", amount: { currency_code: "EUR", value: "18.00" } }] }
        }
      ]
    });

    expect(capture).toEqual({ bookingId: "booking-1", captureId: "CAPTURE-1", currency: "eur", amountCents: 1800 });
    expect(paymentConfirmationDecision({ status: "PENDING", paymentStatus: "PENDING", expiresAt: new Date(now.getTime() + 60_000) }, now)).toBe(
      "CONFIRM"
    );
  });

  it("erstattet Zahlungen für abgebrochene oder abgelaufene Reservierungen", () => {
    expect(paymentConfirmationDecision({ status: "CANCELLED", paymentStatus: "FAILED", expiresAt: null }, now)).toBe("REFUND");
    expect(paymentConfirmationDecision({ status: "PENDING", paymentStatus: "PENDING", expiresAt: new Date(now.getTime() - 1) }, now)).toBe(
      "REFUND"
    );
  });

  it("verarbeitet eine doppelte Zahlungsbestätigung nicht erneut", () => {
    expect(paymentConfirmationDecision({ status: "CONFIRMED", paymentStatus: "PAID", expiresAt: null }, now)).toBe(
      "ALREADY_CONFIRMED"
    );
  });

  it("weist unvollständige PayPal-Captures zurück", () => {
    expect(() => paidCaptureFromOrder({ id: "ORDER-2", status: "APPROVED" })).toThrow("noch nicht abgeschlossen");
  });
});
