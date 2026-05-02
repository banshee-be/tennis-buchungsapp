import { BookingBoard } from "@/components/BookingBoard";

export default function BookingPage() {
  return (
    <section className="page-shell">
      <div className="section-heading">
        <p className="eyebrow">TV Europabad Marbach</p>
        <h1>Platz buchen</h1>
        <p>Wählen Sie Tag, Dauer und einen freien Platz. Die Verfügbarkeit wird vor dem Speichern serverseitig geprüft.</p>
      </div>
      <BookingBoard />
    </section>
  );
}
