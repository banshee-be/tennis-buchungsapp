import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type GuestDetails = {
  name: string;
  email: string;
  phone: string | null;
};

export function parseGuestDetails(input: { name?: unknown; email?: unknown; phone?: unknown }): GuestDetails {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim().replace(/\s+/g, " ") : "";

  if (name.length < 2 || name.length > 100) {
    throw new Error("Bitte einen gültigen Namen eingeben.");
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Bitte eine gültige E-Mail-Adresse eingeben.");
  }

  if (phone.length > 40 || (phone && !/^[+()\d\s./-]{5,40}$/.test(phone))) {
    throw new Error("Bitte eine gültige Telefonnummer eingeben oder das Feld leer lassen.");
  }

  return { name, email, phone: phone || null };
}

export function createBookingCode() {
  return `TVE-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function cancellationSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET ist nicht konfiguriert.");
  }

  return secret || "dev-secret-change-me-before-production";
}

export function createGuestCancellationToken(bookingId: string, email: string) {
  return createHmac("sha256", cancellationSecret()).update(`${bookingId}:${email.toLowerCase()}`).digest("base64url");
}

export function isValidGuestCancellationToken(bookingId: string, email: string, token: string) {
  const expected = createGuestCancellationToken(bookingId, email);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);

  if (expectedBuffer.length !== tokenBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, tokenBuffer);
}
