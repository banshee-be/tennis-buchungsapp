import { afterEach, describe, expect, it } from "vitest";
import { createGuestCancellationToken, isValidGuestCancellationToken, parseGuestDetails } from "@/lib/guest-bookings";

describe("Gastbuchungsdaten", () => {
  const originalSecret = process.env.AUTH_SECRET;

  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret;
  });

  it("normalisiert gültige Kontaktdaten", () => {
    expect(parseGuestDetails({ name: "  Erika   Muster ", email: "ERIKA@EXAMPLE.ORG", phone: "+49 170 123456" })).toEqual({
      name: "Erika Muster",
      email: "erika@example.org",
      phone: "+49 170 123456"
    });
  });

  it("weist ungültige E-Mail-Adressen zurück", () => {
    expect(() => parseGuestDetails({ name: "Erika Muster", email: "ungueltig" })).toThrow("gültige E-Mail-Adresse");
  });

  it("akzeptiert nur den signierten Stornierungslink der Buchung", () => {
    process.env.AUTH_SECRET = "test-secret-with-enough-entropy";
    const token = createGuestCancellationToken("booking-1", "erika@example.org");

    expect(isValidGuestCancellationToken("booking-1", "erika@example.org", token)).toBe(true);
    expect(isValidGuestCancellationToken("booking-2", "erika@example.org", token)).toBe(false);
  });
});
