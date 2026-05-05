"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Booking = {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentStatus: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED";
  totalAmountCents: number;
  user?: { name: string; email: string; membershipType?: "MEMBER" | "EXTERNAL"; membershipStatus?: "PENDING" | "VERIFIED" | "REJECTED" };
  court?: { name: string };
};

type User = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  membershipType: "MEMBER" | "EXTERNAL";
  membershipStatus: "PENDING" | "VERIFIED" | "REJECTED";
  memberNumber?: string | null;
  bookingCount: number;
};

type Court = {
  id: number;
  name: string;
  isActive: boolean;
  notes?: string | null;
};

type Settings = {
  externalHourlyRateCents: number;
  openingHour: number;
  closingHour: number;
  slotDurationMinutes: number;
  maxBookingDurationMinutes: number;
  cancellationRules: string;
};

type Block = {
  id: string;
  title: string;
  reason?: string | null;
  startTime: string;
  endTime: string;
  court?: Court;
};

const tabs = ["Buchungen", "Nutzer", "Preise & Zeiten", "Plaetze & Sperren"] as const;
type Tab = (typeof tabs)[number];

function today() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function euroInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function centsFromEuro(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function formatDateTime(startTime: string, endTime: string) {
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(startTime));
  return `${date}, ${startTime.slice(11, 16)} bis ${endTime.slice(11, 16)} Uhr`;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Buchungen");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [bookingForm, setBookingForm] = useState({
    name: "",
    email: "",
    membershipType: "MEMBER",
    courtId: "1",
    date: today(),
    startTime: "18:00",
    durationMinutes: "60",
    paymentStatus: "NOT_REQUIRED"
  });
  const [blockForm, setBlockForm] = useState({
    courtId: "1",
    date: today(),
    startTime: "09:00",
    endTime: "10:00",
    title: "Platz gesperrt",
    reason: ""
  });

  const settingsForm = useMemo(
    () => ({
      externalHourlyRate: settings ? euroInput(settings.externalHourlyRateCents) : "18.00",
      openingHour: String(settings?.openingHour ?? 8),
      closingHour: String(settings?.closingHour ?? 21),
      slotDurationMinutes: String(settings?.slotDurationMinutes ?? 30),
      maxBookingDurationMinutes: String(settings?.maxBookingDurationMinutes ?? 480),
      cancellationRules: settings?.cancellationRules ?? ""
    }),
    [settings]
  );
  const [editableSettings, setEditableSettings] = useState(settingsForm);

  useEffect(() => {
    setEditableSettings(settingsForm);
  }, [settingsForm]);

  async function loadAdminData() {
    setLoading(true);
    setMessage("");
    const endpoints = [
      fetch("/api/admin/bookings", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/courts", { cache: "no-store" }),
      fetch("/api/admin/blocks", { cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" })
    ];
    const [bookingsResponse, usersResponse, courtsResponse, blocksResponse, settingsResponse] = await Promise.all(endpoints);

    if (!bookingsResponse.ok) {
      const data = await bookingsResponse.json().catch(() => ({}));
      setMessage(data.error ?? "Kein Zugriff. Bitte als Admin einloggen.");
      setLoading(false);
      return;
    }

    const [bookingsData, usersData, courtsData, blocksData, settingsData] = await Promise.all([
      bookingsResponse.json(),
      usersResponse.json(),
      courtsResponse.json(),
      blocksResponse.json(),
      settingsResponse.json()
    ]);

    setBookings(bookingsData.bookings);
    setUsers(usersData.users);
    setCourts(courtsData.courts);
    setBlocks(blocksData.blocks);
    setSettings(settingsData.settings);
    setLoading(false);
  }

  useEffect(() => {
    void loadAdminData();
    const listener = () => void loadAdminData();
    window.addEventListener("session-changed", listener);
    return () => window.removeEventListener("session-changed", listener);
  }, []);

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...bookingForm,
        courtId: Number(bookingForm.courtId),
        durationMinutes: Number(bookingForm.durationMinutes)
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Buchung konnte nicht erstellt werden.");
      return;
    }

    setMessage("Buchung erstellt.");
    await loadAdminData();
  }

  async function updateBookingStatus(id: string, status: Booking["status"]) {
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Buchung konnte nicht geaendert werden.");
      return;
    }

    setMessage("Buchung geaendert.");
    await loadAdminData();
  }

  async function deleteBooking(id: string) {
    const response = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Buchung konnte nicht geloescht werden.");
      return;
    }

    setMessage("Buchung geloescht.");
    await loadAdminData();
  }

  async function updateUser(user: User, patch: Partial<User>) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Nutzer konnte nicht geaendert werden.");
      return;
    }

    setMessage("Nutzer aktualisiert.");
    await loadAdminData();
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalHourlyRateCents: centsFromEuro(editableSettings.externalHourlyRate),
        openingHour: Number(editableSettings.openingHour),
        closingHour: Number(editableSettings.closingHour),
        slotDurationMinutes: Number(editableSettings.slotDurationMinutes),
        maxBookingDurationMinutes: Number(editableSettings.maxBookingDurationMinutes),
        cancellationRules: editableSettings.cancellationRules
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Einstellungen konnten nicht gespeichert werden.");
      return;
    }

    setMessage("Einstellungen gespeichert.");
    await loadAdminData();
  }

  async function updateCourt(court: Court, patch: Partial<Court>) {
    const response = await fetch(`/api/admin/courts/${court.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Platz konnte nicht aktualisiert werden.");
      return;
    }

    setMessage("Platz aktualisiert.");
    await loadAdminData();
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...blockForm,
        courtId: Number(blockForm.courtId)
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Sperre konnte nicht erstellt werden.");
      return;
    }

    setMessage("Platz gesperrt.");
    await loadAdminData();
  }

  async function deleteBlock(id: string) {
    const response = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Sperre konnte nicht geloescht werden.");
      return;
    }

    setMessage("Sperre geloescht.");
    await loadAdminData();
  }

  if (loading) {
    return <div className="loading-box">Admin-Bereich wird geladen...</div>;
  }

  return (
    <div className="admin-layout">
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {message ? <p className={message.includes("konnte") || message.includes("Kein") ? "form-error" : "form-success"}>{message}</p> : null}

      {activeTab === "Buchungen" ? (
        <div className="admin-two-column">
          <form className="admin-form" onSubmit={createBooking}>
            <h2>Manuelle Buchung erstellen</h2>
            <label>
              Name
              <input value={bookingForm.name} onChange={(event) => setBookingForm({ ...bookingForm, name: event.target.value })} />
            </label>
            <label>
              E-Mail
              <input
                type="email"
                value={bookingForm.email}
                onChange={(event) => setBookingForm({ ...bookingForm, email: event.target.value })}
              />
            </label>
            <label>
              Kontotyp
              <select
                value={bookingForm.membershipType}
                onChange={(event) => setBookingForm({ ...bookingForm, membershipType: event.target.value })}
              >
                <option value="MEMBER">Mitglied</option>
                <option value="EXTERNAL">Gastspieler</option>
              </select>
            </label>
            <label>
              Platz
              <select value={bookingForm.courtId} onChange={(event) => setBookingForm({ ...bookingForm, courtId: event.target.value })}>
                {courts.map((court) => (
                  <option value={court.id} key={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Datum
                <input
                  type="date"
                  value={bookingForm.date}
                  onChange={(event) => setBookingForm({ ...bookingForm, date: event.target.value })}
                />
              </label>
              <label>
                Start
                <input
                  type="time"
                  value={bookingForm.startTime}
                  onChange={(event) => setBookingForm({ ...bookingForm, startTime: event.target.value })}
                />
              </label>
            </div>
            <label>
              Dauer
              <select
                value={bookingForm.durationMinutes}
                onChange={(event) => setBookingForm({ ...bookingForm, durationMinutes: event.target.value })}
              >
                <option value="60">1 Stunde</option>
                <option value="90">1,5 Stunden</option>
                <option value="120">2 Stunden</option>
              </select>
            </label>
            <button className="button primary full" type="submit">
              Buchung bestaetigen
            </button>
          </form>

          <div className="admin-list">
            <h2>Alle Buchungen</h2>
            {bookings.map((booking) => (
              <article className="admin-row" key={booking.id}>
                <div>
                  <span className={`status-pill ${booking.status.toLowerCase()}`}>{booking.status}</span>
                  <strong>
                    {booking.court?.name} - {booking.user?.name}
                  </strong>
                  <p>{formatDateTime(booking.startTime, booking.endTime)}</p>
                  <small>
                    {booking.user?.email} - Zahlung: {booking.paymentStatus}
                  </small>
                </div>
                <div className="row-actions">
                  <select value={booking.status} onChange={(event) => updateBookingStatus(booking.id, event.target.value as Booking["status"])}>
                    <option value="CONFIRMED">Bestaetigt</option>
                    <option value="PENDING">Pending</option>
                    <option value="CANCELLED">Storniert</option>
                  </select>
                  <button className="ghost-button danger" onClick={() => deleteBooking(booking.id)}>
                    Loeschen
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "Nutzer" ? (
        <div className="admin-list">
          <h2>Nutzer verwalten</h2>
          {users.map((user) => (
            <article className="admin-row" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <p>{user.email}</p>
                <small>
                  {user.bookingCount} Buchungen · {user.membershipType === "MEMBER" ? "Mitglied" : "Gastspieler"} ·{" "}
                  {user.membershipStatus === "PENDING"
                    ? "Prüfung offen"
                    : user.membershipStatus === "REJECTED"
                      ? "Abgelehnt"
                      : "Bestätigt"}
                  {user.memberNumber ? ` · Nr. ${user.memberNumber}` : ""}
                </small>
              </div>
              <div className="row-actions">
                <select
                  value={user.membershipType}
                  onChange={(event) => updateUser(user, { membershipType: event.target.value as User["membershipType"] })}
                >
                  <option value="MEMBER">Mitglied</option>
                  <option value="EXTERNAL">Gastspieler</option>
                </select>
                <select
                  value={user.membershipStatus}
                  onChange={(event) => updateUser(user, { membershipStatus: event.target.value as User["membershipStatus"] })}
                >
                  <option value="PENDING">Prüfung offen</option>
                  <option value="VERIFIED">Bestätigt</option>
                  <option value="REJECTED">Abgelehnt</option>
                </select>
                <select value={user.role} onChange={(event) => updateUser(user, { role: event.target.value as User["role"] })}>
                  <option value="USER">Nutzer</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button
                  className="ghost-button"
                  onClick={() => updateUser(user, { membershipType: "MEMBER", membershipStatus: "VERIFIED" })}
                  type="button"
                >
                  Mitglied bestätigen
                </button>
                <button
                  className="ghost-button danger"
                  onClick={() => updateUser(user, { membershipType: "MEMBER", membershipStatus: "REJECTED" })}
                  type="button"
                >
                  Ablehnen
                </button>
                <button
                  className="ghost-button"
                  onClick={() => updateUser(user, { membershipType: "EXTERNAL", membershipStatus: "VERIFIED", memberNumber: null })}
                  type="button"
                >
                  Gastspieler
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "Preise & Zeiten" ? (
        <form className="admin-form settings-form" onSubmit={saveSettings}>
          <h2>Preise und buchbare Zeitfenster</h2>
          <div className="form-row">
            <label>
              Preis pro Stunde fuer Gastspieler
              <input
                inputMode="decimal"
                value={editableSettings.externalHourlyRate}
                onChange={(event) => setEditableSettings({ ...editableSettings, externalHourlyRate: event.target.value })}
              />
            </label>
            <label>
              Slotdauer
              <select
                value={editableSettings.slotDurationMinutes}
                onChange={(event) => setEditableSettings({ ...editableSettings, slotDurationMinutes: event.target.value })}
              >
                <option value="15">15 Minuten</option>
                <option value="30">30 Minuten</option>
                <option value="60">60 Minuten</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Oeffnung
              <input
                type="number"
                min="0"
                max="23"
                value={editableSettings.openingHour}
                onChange={(event) => setEditableSettings({ ...editableSettings, openingHour: event.target.value })}
              />
            </label>
            <label>
              Schliessung
              <input
                type="number"
                min="1"
                max="24"
                value={editableSettings.closingHour}
                onChange={(event) => setEditableSettings({ ...editableSettings, closingHour: event.target.value })}
              />
            </label>
            <label>
              Maximale Dauer
              <input
                type="number"
                value={editableSettings.maxBookingDurationMinutes}
                onChange={(event) => setEditableSettings({ ...editableSettings, maxBookingDurationMinutes: event.target.value })}
              />
            </label>
          </div>
          <label>
            Stornoregeln
            <textarea
              value={editableSettings.cancellationRules}
              onChange={(event) => setEditableSettings({ ...editableSettings, cancellationRules: event.target.value })}
            />
          </label>
          <button className="button primary" type="submit">
            Einstellungen speichern
          </button>
        </form>
      ) : null}

      {activeTab === "Plaetze & Sperren" ? (
        <div className="admin-two-column">
          <div className="admin-list">
            <h2>Platzuebersicht</h2>
            {courts.map((court) => (
              <article className="admin-row" key={court.id}>
                <div>
                  <strong>{court.name}</strong>
                  <p>{court.notes || "Keine Notiz"}</p>
                </div>
                <div className="row-actions">
                  <label className="toggle-line">
                    <input
                      checked={court.isActive}
                      onChange={(event) => updateCourt(court, { isActive: event.target.checked })}
                      type="checkbox"
                    />
                    Aktiv
                  </label>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      const notes = window.prompt("Notiz fuer den Platz", court.notes ?? "");
                      if (notes !== null) {
                        void updateCourt(court, { notes });
                      }
                    }}
                  >
                    Notiz
                  </button>
                </div>
              </article>
            ))}
          </div>

          <form className="admin-form" onSubmit={createBlock}>
            <h2>Einzelnen Platz sperren</h2>
            <label>
              Platz
              <select value={blockForm.courtId} onChange={(event) => setBlockForm({ ...blockForm, courtId: event.target.value })}>
                {courts.map((court) => (
                  <option value={court.id} key={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Datum
                <input type="date" value={blockForm.date} onChange={(event) => setBlockForm({ ...blockForm, date: event.target.value })} />
              </label>
              <label>
                Von
                <input
                  type="time"
                  value={blockForm.startTime}
                  onChange={(event) => setBlockForm({ ...blockForm, startTime: event.target.value })}
                />
              </label>
              <label>
                Bis
                <input
                  type="time"
                  value={blockForm.endTime}
                  onChange={(event) => setBlockForm({ ...blockForm, endTime: event.target.value })}
                />
              </label>
            </div>
            <label>
              Titel
              <input value={blockForm.title} onChange={(event) => setBlockForm({ ...blockForm, title: event.target.value })} />
            </label>
            <label>
              Grund
              <textarea value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} />
            </label>
            <button className="button primary full" type="submit">
              Platz sperren
            </button>
          </form>

          <div className="admin-list span-two">
            <h2>Aktive und geplante Sperren</h2>
            {blocks.map((block) => (
              <article className="admin-row" key={block.id}>
                <div>
                  <strong>
                    {block.court?.name} - {block.title}
                  </strong>
                  <p>{formatDateTime(block.startTime, block.endTime)}</p>
                  {block.reason ? <small>{block.reason}</small> : null}
                </div>
                <button className="ghost-button danger" onClick={() => deleteBlock(block.id)}>
                  Loeschen
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
