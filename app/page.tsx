import Link from "next/link";

const features = [
  "Vier Plaetze mit ruhiger Tagesansicht",
  "Mitglieder buchen ohne Zahlung",
  "Gastspieler zahlen sicher online",
  "Admin-Bereich fuer Preise, Sperren und Nutzer"
];

export default function HomePage() {
  return (
    <section className="page-shell home-shell">
      <div className="home-grid">
        <div className="intro-panel">
          <p className="eyebrow">TV Europabad Marbach</p>
          <h1>Tennisanlage Marburg-Marbach</h1>
          <p className="lead">
            Eine moderne Platzbuchung fuer Vereinsmitglieder und Gastspieler. Mitglieder buchen direkt, externe
            Gastspieler werden vor der Bestaetigung zur Zahlung weitergeleitet.
          </p>
          <div className="cta-row">
            <Link className="button primary" href="/buchen">
              Platz buchen
            </Link>
            <Link className="button secondary" href="/meine-buchungen">
              Meine Buchungen
            </Link>
          </div>
        </div>

        <div className="court-visual" aria-label="Tennisplatz Uebersicht">
          <div className="court-lines">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="court-labels">
            <strong>4 Plaetze</strong>
            <small>Tagesansicht, Sperren und Live-Verfuegbarkeit</small>
          </div>
        </div>
      </div>

      <div className="feature-grid">
        {features.map((feature) => (
          <div className="feature-card" key={feature}>
            <span className="feature-dot" />
            <p>{feature}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
