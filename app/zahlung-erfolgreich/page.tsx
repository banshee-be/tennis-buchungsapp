import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <section className="page-shell compact-shell">
      <div className="notice-card success">
        <p className="eyebrow">Buchung bestaetigt</p>
        <h1>Zahlung erfolgreich</h1>
        <p>Ihre Buchung wurde bestaetigt. Die Details finden Sie unter Meine Buchungen.</p>
        <Link className="button primary full" href="/meine-buchungen">
          Meine Buchungen
        </Link>
      </div>
    </section>
  );
}
