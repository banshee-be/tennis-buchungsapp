import Link from "next/link";

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;

  return (
    <section className="page-shell compact-shell">
      <div className="notice-card success">
        <p className="eyebrow">Buchung bestätigt</p>
        <h1>Zahlung erfolgreich</h1>
        <p>
          Ihre Buchung wurde serverseitig bestätigt.{code ? ` Ihre Buchungsnummer lautet ${code}.` : ""} Eine Bestätigung wurde per
          E-Mail versendet, sofern Sie als Gast gebucht haben.
        </p>
        <Link className="button primary full" href="/meine-buchungen">
          Meine Buchungen
        </Link>
      </div>
    </section>
  );
}
