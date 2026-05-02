"use client";

import { useEffect, useState } from "react";

type Booking = {
  id: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentStatus: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED";
  totalAmountCents: number;
  court?: { name: string };
};

function formatDateRange(booking: Booking) {
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(booking.startTime)
  );
  const start = booking.startTime.slice(11, 16);
  const end = booking.endTime.slice(11, 16);
  return `${date}, ${start} bis ${end} Uhr`;
}

function statusLabel(booking: Booking) {
  if (booking.status === "CONFIRMED") {
    return "Bestaetigt";
  }
  if (booking.status === "PENDING") {
    return "Zahlungspflichtig";
  }
  return "Storniert";
}

export function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadBookings() {
    setLoading(true);
    const response = await fetch("/api/bookings", { cache: "no-store" });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(data.error ?? "Bitte einloggen, um Buchungen zu sehen.");
      return;
    }

    setBookings(data.bookings);
  }

  useEffect(() => {
    void loadBookings();
    const listener = () => void loadBookings();
    window.addEventListener("session-changed", listener);
    return () => window.removeEventListener("session-changed", listener);
  }, []);

  async function cancelBooking(id: string) {
    const response = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Buchung konnte nicht storniert werden.");
      return;
    }

    setMessage("Buchung storniert.");
    await loadBookings();
  }

  if (loading) {
    return <div className="loading-box">Buchungen werden geladen...</div>;
  }

  return (
    <div className="list-panel">
      {message ? <p className={message.includes("storniert") ? "form-success" : "form-error"}>{message}</p> : null}
      {bookings.length === 0 ? (
        <div className="empty-state">
          <h2>Noch keine Buchungen</h2>
          <p>Nach der ersten Platzbuchung erscheint Ihre Buchungshistorie hier.</p>
        </div>
      ) : (
        bookings.map((booking) => (
          <article className="booking-row" key={booking.id}>
            <div>
              <span className={`status-pill ${booking.status.toLowerCase()}`}>{statusLabel(booking)}</span>
              <h2>{booking.court?.name ?? "Tennisplatz"}</h2>
              <p>{formatDateRange(booking)}</p>
              <small>Zahlung: {booking.paymentStatus === "NOT_REQUIRED" ? "nicht erforderlich" : booking.paymentStatus}</small>
            </div>
            {booking.status !== "CANCELLED" ? (
              <button className="button secondary" onClick={() => cancelBooking(booking.id)}>
                Stornieren
              </button>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
