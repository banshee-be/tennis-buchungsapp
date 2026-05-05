type PasswordResetEmail = {
  email: string;
  resetUrl: string;
};

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

export async function sendPasswordResetEmail({ email, resetUrl }: PasswordResetEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "TV Europabad Marbach <noreply@example.org>";

  if (apiKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Passwort zurücksetzen",
        text: `Öffne diesen Link, um dein Passwort zurückzusetzen: ${resetUrl}`
      })
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`Passwort-zuruecksetzen-Link fuer ${email}: ${resetUrl}`);
  }
}
