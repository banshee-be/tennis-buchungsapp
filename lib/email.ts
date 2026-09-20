import { Resend } from "resend";

type PasswordResetEmail = {
  email: string;
  resetUrl: string;
};

type RegistrationUser = {
  name: string;
  email: string;
  membershipType: string;
  membershipStatus: string;
  memberNumber?: string | null;
  createdAt: Date;
};

type GuestBookingConfirmation = {
  name: string;
  email: string;
  bookingCode: string;
  courtName: string;
  startTime: Date;
  endTime: Date;
  totalAmountCents: number;
  cancellationUrl: string;
  calendarUrl: string;
};

type BookingReminder = GuestBookingConfirmation;

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

function adminRecipients() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function membershipTypeLabel(type: string) {
  return type === "MEMBER" ? "Mitglied" : "Gastspieler";
}

function membershipStatusLabel(status: string) {
  if (status === "PENDING") {
    return "In Prüfung";
  }

  if (status === "REJECTED") {
    return "Abgelehnt";
  }

  return "Bestätigt";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendEmail({
  to,
  subject,
  text,
  html,
  idempotencyKey
}: {
  to: string[] | string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send(
      { from, to, subject, text, html },
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined
    );
    if (result.error) {
      throw new Error(`E-Mail-Versand fehlgeschlagen: ${result.error.message}`);
    }
    return result.data?.id ?? null;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("E-Mail wuerde gesendet:", { to, from, subject, text });
    return;
  }

  console.warn("E-Mail-Versand ist nicht konfiguriert. RESEND_API_KEY oder EMAIL_FROM fehlt.");
}

export async function sendPasswordResetEmail({ email, resetUrl }: PasswordResetEmail) {
  await sendEmail({
    to: email,
    subject: "Passwort zurücksetzen",
    text: `Öffne diesen Link, um dein Passwort zurückzusetzen: ${resetUrl}`
  });
}

export async function sendAdminNewRegistrationEmail(user: RegistrationUser) {
  const recipients = adminRecipients();

  if (recipients.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.info("Keine Admin-Empfänger für Registrierungsbenachrichtigung konfiguriert.");
    }
    return;
  }

  const appUrl = getPublicAppUrl();
  const registeredAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(user.createdAt);
  const typeLabel = membershipTypeLabel(user.membershipType);
  const statusLabel = membershipStatusLabel(user.membershipStatus);
  const hint =
    user.membershipType === "MEMBER"
      ? "Diese Person hat sich als Vereinsmitglied registriert und muss im Adminbereich geprüft werden."
      : "Diese Person hat sich als Gastspieler registriert.";
  const memberNumberLine = user.memberNumber ? `Mitgliedsnummer: ${user.memberNumber}\n` : "";
  const safeName = escapeHtml(user.name);
  const safeEmail = escapeHtml(user.email);
  const safeTypeLabel = escapeHtml(typeLabel);
  const safeStatusLabel = escapeHtml(statusLabel);
  const safeMemberNumber = user.memberNumber ? escapeHtml(user.memberNumber) : "";
  const safeRegisteredAt = escapeHtml(registeredAt);
  const safeHint = escapeHtml(hint);
  const safeAdminUrl = escapeHtml(`${appUrl}/admin`);

  const text = `Neue Registrierung

Name: ${user.name}
E-Mail: ${user.email}
Kontotyp: ${typeLabel}
Mitgliedsstatus: ${statusLabel}
${memberNumberLine}Registriert am: ${registeredAt}

Hinweis:
${hint}

Adminbereich:
${appUrl}/admin`;

  const html = `
    <h1>Neue Registrierung</h1>
    <p><strong>Name:</strong> ${safeName}</p>
    <p><strong>E-Mail:</strong> ${safeEmail}</p>
    <p><strong>Kontotyp:</strong> ${safeTypeLabel}</p>
    <p><strong>Mitgliedsstatus:</strong> ${safeStatusLabel}</p>
    ${safeMemberNumber ? `<p><strong>Mitgliedsnummer:</strong> ${safeMemberNumber}</p>` : ""}
    <p><strong>Registriert am:</strong> ${safeRegisteredAt}</p>
    <p><strong>Hinweis:</strong><br>${safeHint}</p>
    <p><a href="${safeAdminUrl}">Adminbereich öffnen</a></p>
  `;

  await sendEmail({
    to: recipients,
    subject: "Neue Registrierung in der Tennis-Buchungsapp",
    text,
    html
  });
}

export async function sendGuestBookingConfirmationEmail(booking: GuestBookingConfirmation) {
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeZone: "UTC" }).format(booking.startTime);
  const start = booking.startTime.toISOString().slice(11, 16);
  const end = booking.endTime.toISOString().slice(11, 16);
  const price = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    booking.totalAmountCents / 100
  );
  const text = `Hallo ${booking.name},

Ihre Tennisplatz-Buchung ist bezahlt und bestätigt.

Buchungsnummer: ${booking.bookingCode}
Platz: ${booking.courtName}
Termin: ${date}, ${start} bis ${end} Uhr
Bezahlt: ${price} über PayPal

Buchung stornieren:
${booking.cancellationUrl}

Zum Kalender hinzufügen:
${booking.calendarUrl}

Bitte bewahren Sie die Buchungsnummer auf.`;
  const html = `
    <h1>Buchung bestätigt</h1>
    <p>Hallo ${escapeHtml(booking.name)},</p>
    <p>Ihre Tennisplatz-Buchung ist bezahlt und bestätigt.</p>
    <p><strong>Buchungsnummer:</strong> ${escapeHtml(booking.bookingCode)}</p>
    <p><strong>Platz:</strong> ${escapeHtml(booking.courtName)}<br>
    <strong>Termin:</strong> ${escapeHtml(date)}, ${start} bis ${end} Uhr<br>
    <strong>Bezahlt:</strong> ${escapeHtml(price)} über PayPal</p>
    <p><a href="${escapeHtml(booking.cancellationUrl)}">Buchung stornieren</a></p>
    <p><a href="${escapeHtml(booking.calendarUrl)}">Termin zum Kalender hinzufügen</a></p>
    <p>Bitte bewahren Sie die Buchungsnummer auf.</p>
  `;

  await sendEmail({
    to: booking.email,
    subject: `Tennisplatz-Buchung ${booking.bookingCode} bestätigt`,
    text,
    html,
    idempotencyKey: `guest-confirmation-${booking.bookingCode}`
  });
}

export async function sendBookingReminderEmail(booking: BookingReminder) {
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeZone: "UTC" }).format(booking.startTime);
  const start = booking.startTime.toISOString().slice(11, 16);
  const end = booking.endTime.toISOString().slice(11, 16);
  const text = `Hallo ${booking.name},

zur Erinnerung: Ihre Tennisplatz-Buchung findet bald statt.

Buchungsnummer: ${booking.bookingCode}
Platz: ${booking.courtName}
Termin: ${date}, ${start} bis ${end} Uhr

Zum Kalender hinzufügen:
${booking.calendarUrl}

Buchung stornieren:
${booking.cancellationUrl}`;
  const html = `
    <h1>Erinnerung an Ihre Tennisplatz-Buchung</h1>
    <p>Hallo ${escapeHtml(booking.name)},</p>
    <p>Ihre Tennisplatz-Buchung findet bald statt.</p>
    <p><strong>Buchungsnummer:</strong> ${escapeHtml(booking.bookingCode)}</p>
    <p><strong>Platz:</strong> ${escapeHtml(booking.courtName)}<br>
    <strong>Termin:</strong> ${escapeHtml(date)}, ${start} bis ${end} Uhr</p>
    <p><a href="${escapeHtml(booking.calendarUrl)}">Termin zum Kalender hinzufügen</a></p>
    <p><a href="${escapeHtml(booking.cancellationUrl)}">Buchung stornieren</a></p>
  `;

  await sendEmail({
    to: booking.email,
    subject: `Erinnerung: Tennisplatz-Buchung ${booking.bookingCode}`,
    text,
    html,
    idempotencyKey: `guest-reminder-${booking.bookingCode}`
  });
}
