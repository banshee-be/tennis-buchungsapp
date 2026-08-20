"use client";

import { useState } from "react";

export function GuestCancellation({ code, token }: { code: string; token: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function cancel() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/guest-bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, token })
    });
    const data = await response.json();
    setLoading(false);
    setMessage(data.message || data.error || "Die Buchung konnte nicht storniert werden.");
    setSuccess(response.ok);
  }

  return (
    <div className="notice-card warning">
      <p className="eyebrow">Gastbuchung {code || ""}</p>
      <h1>Buchung stornieren</h1>
      <p>Bei einer fristgerechten Stornierung wird eine bereits erfolgte PayPal-Zahlung automatisch zurückerstattet.</p>
      {message ? <p className={success ? "form-success" : "form-error"}>{message}</p> : null}
      {!success ? (
        <button className="button primary full" disabled={loading || !code || !token} onClick={cancel} type="button">
          {loading ? "Stornierung läuft …" : "Verbindlich stornieren"}
        </button>
      ) : null}
    </div>
  );
}
