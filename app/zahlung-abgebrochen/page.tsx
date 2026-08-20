import Link from "next/link";

export default async function PaymentCancelledPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;

  return (
    <section className="page-shell compact-shell">
      <div className="notice-card warning">
        <p className="eyebrow">Zahlung abgebrochen</p>
        <h1>Keine bestätigte Buchung</h1>
        <p>
          {reason === "processing"
            ? "Die Zahlung konnte nicht eindeutig bestätigt werden. Bitte prüfen Sie PayPal und kontaktieren Sie den Verein, bevor Sie erneut bezahlen."
            : "Die Zahlung wurde nicht abgeschlossen. Die vorläufige Reservierung wurde freigegeben."}
        </p>
        <Link className="button primary full" href="/buchen">
          Platz buchen
        </Link>
      </div>
    </section>
  );
}
