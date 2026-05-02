import Link from "next/link";

export default function PaymentCancelledPage() {
  return (
    <section className="page-shell compact-shell">
      <div className="notice-card warning">
        <p className="eyebrow">Zahlung abgebrochen</p>
        <h1>Keine bestaetigte Buchung</h1>
        <p>Die Zahlung wurde nicht abgeschlossen. Bitte waehlen Sie bei Bedarf ein neues Zeitfenster.</p>
        <Link className="button primary full" href="/buchen">
          Platz buchen
        </Link>
      </div>
    </section>
  );
}
