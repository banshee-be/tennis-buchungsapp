import { BookingBoard } from "@/components/BookingBoard";

export default function BookingPage() {
  return (
    <section className="page-shell">
      <div className="section-heading">
        <p className="eyebrow booking-page-eyebrow">TV Europabad Marbach</p>
        <h1>Platz buchen</h1>
        <p className="booking-page-description">
          <span className="desktop-only">
            Wählen Sie Tag, Dauer und einen freien Platz. Die Verfügbarkeit wird vor dem Speichern serverseitig geprüft.
          </span>
          <span className="mobile-only">Wähle Datum, Dauer und Platz.</span>
        </p>
      </div>
      <BookingBoard />
    </section>
  );
}
