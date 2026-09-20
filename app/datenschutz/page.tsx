export default function PrivacyPage() {
  return (
    <section className="page-shell legal-page">
      <div className="section-heading">
        <p className="eyebrow">Rechtliches</p>
        <h1>Datenschutz</h1>
      </div>
      <div className="legal-card">
        <h2>Platzbuchung</h2>
        <p>Für die Buchung verarbeiten wir Name, E-Mail-Adresse, optional die Telefonnummer sowie Termin- und Zahlungsstatus. Gastbuchungen benötigen kein Benutzerkonto.</p>
        <h2>Zahlungsabwicklung</h2>
        <p>Zahlungen werden durch PayPal verarbeitet. In der Buchungsapp speichern wir nur die zur Zuordnung notwendigen Transaktionskennungen, Beträge und Statuswerte, keine Bank- oder Kartendaten.</p>
        <h2>E-Mail-Versand</h2>
        <p>Bestätigungen, Stornierungslinks und Terminerinnerungen werden über den beauftragten E-Mail-Dienst versendet.</p>
        <h2>Speicherdauer</h2>
        <p>Personenbezogene Gastdaten werden nach Ablauf der im System hinterlegten Aufbewahrungsfrist automatisch anonymisiert. Buchungs- und Zahlungsnachweise bleiben ohne direkte Kontaktdaten für Abrechnung und Nachvollziehbarkeit erhalten.</p>
        <h2>Ihre Rechte</h2>
        <p>Sie können Auskunft, Berichtigung oder Löschung Ihrer personenbezogenen Daten verlangen. Wenden Sie sich dafür über die Kontaktmöglichkeiten der Vereinswebsite an den TV Europabad Marbach.</p>
      </div>
    </section>
  );
}
