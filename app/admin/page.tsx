import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminPage() {
  return (
    <section className="page-shell wide-shell">
      <div className="section-heading">
        <p className="eyebrow">Verwaltung</p>
        <h1>Admin-Bereich</h1>
        <p>Mitglieder, Beiträge, Arbeitsstunden, Schlüssel, Buchungen und Plätze zentral verwalten.</p>
      </div>
      <AdminDashboard />
    </section>
  );
}
