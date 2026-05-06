import Link from "next/link";
import Image from "next/image";

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

        <div className="court-visual hero-photo" aria-label="Tennisanlage Marburg-Marbach">
          <Image
            src="/tennisanlage-hero.jpg"
            alt="Tennisanlage Marburg-Marbach"
            fill
            priority
            sizes="(max-width: 720px) 100vw, 44vw"
            className="hero-photo-image"
          />
          <div className="court-labels">
            <strong>4 Plaetze</strong>
            <small>Tagesansicht, Sperren und Live-Verfuegbarkeit</small>
          </div>
        </div>
      </div>
    </section>
  );
}
