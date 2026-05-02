import { MyBookings } from "@/components/MyBookings";

export default function MyBookingsPage() {
  return (
    <section className="page-shell">
      <div className="section-heading">
        <p className="eyebrow">Profil</p>
        <h1>Meine Buchungen</h1>
        <p>Hier sehen Sie Ihre bestaetigten und offenen Buchungen.</p>
      </div>
      <MyBookings />
    </section>
  );
}
