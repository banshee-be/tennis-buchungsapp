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

async function sendEmail({ to, subject, text, html }: { to: string[] | string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to, subject, text, html });
    return;
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
      console.info("Keine Admin-Empfaenger fuer Registrierungsbenachrichtigung konfiguriert.");
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
