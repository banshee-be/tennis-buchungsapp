"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DemoPaymentPage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBookingId(new URLSearchParams(window.location.search).get("bookingId"));
  }, []);

  async function confirmDemoPayment() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/payments/demo-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId })
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(data.error ?? "Zahlung konnte nicht bestaetigt werden.");
      return;
    }

    router.push(`/zahlung-erfolgreich?bookingId=${bookingId}`);
  }

  return (
    <section className="page-shell compact-shell">
      <div className="notice-card">
        <p className="eyebrow">Demo-Zahlung</p>
        <h1>Jetzt bezahlen</h1>
        <p>
          Dies ist der lokale Testmodus. In Produktion fuehrt diese Stelle zu Stripe Checkout und die Bestaetigung
          erfolgt ueber den Stripe Webhook.
        </p>
        {message ? <p className="form-error">{message}</p> : null}
        <button className="button primary full" disabled={loading || !bookingId} onClick={confirmDemoPayment}>
          {loading ? "Zahlung wird geprueft..." : "Demo-Zahlung abschliessen"}
        </button>
      </div>
    </section>
  );
}
