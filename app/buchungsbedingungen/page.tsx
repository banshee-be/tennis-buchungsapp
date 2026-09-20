export default function BookingTermsPage() {
  return (
    <section className="page-shell legal-page">
      <div className="section-heading">
        <p className="eyebrow">Rechtliches</p>
        <h1>Buchungsbedingungen</h1>
      </div>
      <div className="legal-card">
        <h2>Verbindliche Buchung</h2>
        <p>Eine Gastbuchung wird erst nach serverseitig bestätigter Zahlung verbindlich. Bis dahin wird das Zeitfenster höchstens 15 Minuten reserviert.</p>
        <h2>Stornierung und Erstattung</h2>
        <p>Die jeweils gültige Stornierungsfrist wird vor der Buchung angezeigt. Bei einer fristgerechten Stornierung wird eine bezahlte Gastbuchung über den ursprünglichen Zahlungsweg zurückerstattet.</p>
        <h2>Nutzung der Anlage</h2>
        <p>Der Platz darf nur im gebuchten Zeitraum und gemäß der Platz- und Vereinsordnung genutzt werden. Sperrungen aus Sicherheits- oder Witterungsgründen bleiben vorbehalten.</p>
      </div>
    </section>
  );
}
