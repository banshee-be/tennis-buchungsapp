"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
  phoneNumber?: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  membershipType: "MEMBER" | "EXTERNAL";
  membershipStatus: "PENDING" | "VERIFIED" | "REJECTED";
  memberNumber?: string | null;
  teamPlayerId?: string | null;
  contractType: ContractType;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  annualFeeCents?: number | null;
  workHoursRequired?: number | null;
  workHoursDone: number;
  contractNote?: string | null;
  hasKey: boolean;
  keyType: KeyType;
  keyIssuedAt?: string | null;
  keyReturnedAt?: string | null;
  keyNote?: string | null;
  adminNote?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  teamPlayer?: {
    id: string;
    fullName: string;
    lk?: string | null;
    nuLigaId?: string | null;
    licenseNumber?: string | null;
    birthYear?: number | null;
    isCaptain?: boolean;
    team?: { name: string; season?: string | null } | null;
  } | null;
  teamPlayers?: TeamPlayerOption[];
  bookingCount: number;
};

type UserDraft = Partial<User> & { teamPlayerIds?: string[] };

type ImportPreview = {
  rows: unknown[];
  rowCount: number;
  newUsers: number;
  updateUsers: number;
  errors: string[];
  warnings: string[];
};

type ContractType = "FULL_MEMBER" | "FAMILY_MEMBER" | "PASSIVE_MEMBER" | "YOUTH_MEMBER" | "SEASON_CARD" | "NONE";
type KeyType = "NONE" | "MAIN_CHANGING_COURTS" | "MAIN_CHANGING_COURTS_CLUBROOM";

type TeamPlayerOption = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  birthYear?: number | null;
  licenseNumber?: string | null;
  nuLigaId?: string | null;
  nation?: string | null;
  lk?: string | null;
  info?: string | null;
  msg?: string | null;
  isCaptain: boolean;
  rank?: number | null;
  teamPosition?: string | null;
  team?: { name: string; season?: string | null } | null;
  userLinks?: { user: { id: string; name: string; email: string } }[];
};

type NuLigaSummary = {
  sourceUrl: string;
  season?: string | null;
  lastImportedAt?: string | null;
  importedTeams: number;
  importedPlayers: number;
  createdPlayers?: number;
  updatedPlayers?: number;
  skippedPlayers?: number;
  warnings: string[];
  teams: {
    id?: string;
    name: string;
    season?: string | null;
    playerCount: number;
    captainCount: number;
    lastImportedAt?: string | null;
  }[];
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
  cancellationDeadlineHours: number;
  maxActiveBookingsPerUser: number;
  maxAdvanceBookingDaysMember: number;
  maxAdvanceBookingDaysGuest: number;
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

const tabs = ["Buchungen", "Nutzer", "Preise & Zeiten", "Plätze & Sperren"] as const;
type Tab = (typeof tabs)[number];
type DetailTab = "Übersicht" | "Vertrag" | "Schlüssel" | "nuLiga" | "Buchungen" | "Notizen";
const detailTabs: DetailTab[] = ["Übersicht", "Vertrag", "Schlüssel", "nuLiga", "Buchungen", "Notizen"];

const contractOptions: Record<ContractType, { label: string; shortLabel: string; feeCents: number | null; workHours?: number; hint?: string }> = {
  FULL_MEMBER: { label: "Vollmitglied", shortLabel: "Vollmitglied", feeCents: 12000, workHours: 6 },
  FAMILY_MEMBER: { label: "Familienmitglied", shortLabel: "Familienmitglied", feeCents: 6000 },
  PASSIVE_MEMBER: { label: "Passivmitglied", shortLabel: "Passivmitglied", feeCents: 2500 },
  YOUTH_MEMBER: { label: "Jugend bis 18 Jahre", shortLabel: "Jugend", feeCents: 5000 },
  SEASON_CARD: { label: "Saisonkarte", shortLabel: "Saisonkarte", feeCents: 9500, hint: "nur für 1 Jahr möglich" },
  NONE: { label: "Noch nicht festgelegt", shortLabel: "Nicht festgelegt", feeCents: null }
};

const keyOptions: Record<KeyType, string> = {
  NONE: "Kein Schlüssel",
  MAIN_CHANGING_COURTS: "Haupttür / Umkleide / Plätze",
  MAIN_CHANGING_COURTS_CLUBROOM: "Haupttür / Umkleide / Plätze & Gastraum"
};

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

function euroLabel(cents?: number | null) {
  if (cents === null || cents === undefined) {
    return "kein Beitrag";
  }

  return `${(cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`;
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatDateTime(startTime: string, endTime: string) {
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(startTime));
  return `${date}, ${startTime.slice(11, 16)} bis ${endTime.slice(11, 16)} Uhr`;
}

function formatDateTimeLocal(value?: string | null) {
  if (!value) {
    return "Noch kein Import";
  }

  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function normalizeMatchName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function contractFee(user: User) {
  return user.annualFeeCents ?? contractOptions[user.contractType].feeCents;
}

function contractWorkHours(user: User) {
  return user.workHoursRequired ?? contractOptions[user.contractType].workHours ?? null;
}

function membershipLabel(user: User) {
  if (user.membershipType === "EXTERNAL") return "Gastspieler";
  if (user.membershipStatus === "PENDING") return "Mitgliedschaft in Prüfung";
  if (user.membershipStatus === "REJECTED") return "Abgelehnt";
  return "Bestätigt";
}

function linkedTeamPlayers(user: User) {
  const linked = user.teamPlayers?.length ? user.teamPlayers : user.teamPlayer ? [user.teamPlayer as TeamPlayerOption] : [];
  return linked;
}

function teamSummary(user: User) {
  const linked = linkedTeamPlayers(user);
  if (!linked.length) {
    return "Ohne Mannschaft";
  }
  return Array.from(new Set(linked.map((player) => `${player.team?.name ?? "nuLiga"}${player.isCaptain ? " · MF" : ""}`))).join(", ");
}

function possibleTeamPlayerMatches(user: User, teamPlayers: TeamPlayerOption[]) {
  const userName = normalizeMatchName(user.name);
  const userParts = userName.split(" ").filter(Boolean);
  const reversedName = userParts.length > 1 ? [...userParts].reverse().join(" ") : userName;
  const memberNumber = user.memberNumber?.trim();

  return teamPlayers.filter((player) => {
    const playerName = normalizeMatchName(player.fullName);
    const playerReversed = normalizeMatchName(`${player.lastName} ${player.firstName}`);
    const nameMatches = playerName === userName || playerName === reversedName || playerReversed === userName;
    const numberMatches = memberNumber && (player.licenseNumber === memberNumber || player.nuLigaId === memberNumber);
    return Boolean(numberMatches || nameMatches);
  });
}

function unlinkedPossibleMatches(user: User, teamPlayers: TeamPlayerOption[]) {
  const linkedIds = new Set(linkedTeamPlayers(user).map((player) => player.id));
  return possibleTeamPlayerMatches(user, teamPlayers).filter((player) => !linkedIds.has(player.id));
}

function teamChipToFilter(teamName: string) {
  if (teamName === "Alle") return "ALL";
  if (teamName === "Ohne Mannschaft") return "NONE";
  if (teamName === "Mannschaftsführer") return "CAPTAIN";
  return teamName;
}

function filterToTeamChip(filter: string) {
  if (filter === "ALL") return "Alle";
  if (filter === "NONE") return "Ohne Mannschaft";
  if (filter === "CAPTAIN") return "Mannschaftsführer";
  return filter;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Buchungen");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayerOption[]>([]);
  const [selectedTeamPlayers, setSelectedTeamPlayers] = useState<Record<string, string>>({});
  const [nuligaSummary, setNuLigaSummary] = useState<NuLigaSummary | null>(null);
  const [nuligaImporting, setNuLigaImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contractFilter, setContractFilter] = useState<ContractType | "ALL">("ALL");
  const [keyFilter, setKeyFilter] = useState<KeyType | "ALL" | "WITH_KEY" | "WITHOUT_KEY">("ALL");
  const [memberFilter, setMemberFilter] = useState<"ALL" | "PENDING" | "VERIFIED_MEMBER" | "EXTERNAL" | "REJECTED">("ALL");
  const [teamFilter, setTeamFilter] = useState<"ALL" | "NONE" | "POSSIBLE" | "LINKED" | string>("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "USER" | "ADMIN">("ALL");
  const [teamRosterFilter, setTeamRosterFilter] = useState("Alle");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userDraft, setUserDraft] = useState<UserDraft>({});
  const [detailTab, setDetailTab] = useState<DetailTab>("Übersicht");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
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
      maxBookingDurationMinutes: String(settings?.maxBookingDurationMinutes ?? 120),
      cancellationDeadlineHours: String(settings?.cancellationDeadlineHours ?? 2),
      maxActiveBookingsPerUser: String(settings?.maxActiveBookingsPerUser ?? 3),
      maxAdvanceBookingDaysMember: String(settings?.maxAdvanceBookingDaysMember ?? 7),
      maxAdvanceBookingDaysGuest: String(settings?.maxAdvanceBookingDaysGuest ?? 3),
      cancellationRules: settings?.cancellationRules ?? ""
    }),
    [settings]
  );
  const [editableSettings, setEditableSettings] = useState(settingsForm);

  useEffect(() => {
    setEditableSettings(settingsForm);
  }, [settingsForm]);

  const possibleTeamPlayerMatch = useCallback(
    (user: User) => possibleTeamPlayerMatches(user, teamPlayers)[0],
    [teamPlayers]
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const possibleMatch = possibleTeamPlayerMatch(user);
        const unlinkedMatches = unlinkedPossibleMatches(user, teamPlayers);
        const query = normalizeMatchName(searchTerm);
        const searchMatches = !query || normalizeMatchName(`${user.name} ${user.email}`).includes(query);
        const contractMatches = contractFilter === "ALL" || user.contractType === contractFilter;
        const keyMatches =
          keyFilter === "ALL" ||
          (keyFilter === "WITH_KEY" && user.hasKey) ||
          (keyFilter === "WITHOUT_KEY" && !user.hasKey) ||
          user.keyType === keyFilter;
        const memberMatches =
          memberFilter === "ALL" ||
          (memberFilter === "PENDING" && user.membershipStatus === "PENDING") ||
          (memberFilter === "VERIFIED_MEMBER" && user.membershipType === "MEMBER" && user.membershipStatus === "VERIFIED") ||
          (memberFilter === "EXTERNAL" && user.membershipType === "EXTERNAL") ||
          (memberFilter === "REJECTED" && user.membershipStatus === "REJECTED");
        const teamMatches =
          teamFilter === "ALL" ||
          (teamFilter === "NONE" && !linkedTeamPlayers(user).length) ||
          (teamFilter === "POSSIBLE" && Boolean(unlinkedMatches.length || (!linkedTeamPlayers(user).length && possibleMatch))) ||
          (teamFilter === "LINKED" && Boolean(linkedTeamPlayers(user).length)) ||
          (teamFilter === "CAPTAIN" && linkedTeamPlayers(user).some((player) => player.isCaptain)) ||
          linkedTeamPlayers(user).some((player) => player.team?.name === teamFilter);
        const roleMatches = roleFilter === "ALL" || user.role === roleFilter;

        return searchMatches && contractMatches && keyMatches && memberMatches && teamMatches && roleMatches;
      }),
    [contractFilter, keyFilter, memberFilter, possibleTeamPlayerMatch, roleFilter, searchTerm, teamFilter, teamPlayers, users]
  );

  const availableTeamNames = useMemo(
    () => Array.from(new Set(teamPlayers.map((player) => player.team?.name).filter(Boolean))) as string[],
    [teamPlayers]
  );

  const rosterPlayers = useMemo(() => {
    if (teamRosterFilter === "Alle") return teamPlayers;
    if (teamRosterFilter === "Ohne Mannschaft") return [];
    if (teamRosterFilter === "Mannschaftsführer") return teamPlayers.filter((player) => player.isCaptain);
    return teamPlayers.filter((player) => player.team?.name === teamRosterFilter);
  }, [teamPlayers, teamRosterFilter]);

  function selectTeamFilter(value: string) {
    setTeamFilter(value);
    setTeamRosterFilter(filterToTeamChip(value));
  }

  function selectTeamChip(teamName: string) {
    setTeamRosterFilter(teamName);
    setTeamFilter(teamChipToFilter(teamName));
  }

  async function loadAdminData() {
    setLoading(true);
    setMessage("");
    const endpoints = [
      fetch("/api/admin/bookings", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/courts", { cache: "no-store" }),
      fetch("/api/admin/blocks", { cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" }),
      fetch("/api/admin/nuliga/import", { cache: "no-store" })
    ];
    const [bookingsResponse, usersResponse, courtsResponse, blocksResponse, settingsResponse, nuligaResponse] = await Promise.all(endpoints);

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
    setTeamPlayers(usersData.teamPlayers ?? []);
    setCourts(courtsData.courts);
    setBlocks(blocksData.blocks);
    setSettings(settingsData.settings);
    setNuLigaSummary(nuligaResponse.ok ? await nuligaResponse.json() : null);
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
      setMessage(data.error ?? "Buchung konnte nicht geändert werden.");
      return;
    }

    setMessage("Buchung geändert.");
    await loadAdminData();
  }

  async function deleteBooking(id: string) {
    const response = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Buchung konnte nicht gelöscht werden.");
      return;
    }

    setMessage("Buchung gelöscht.");
    await loadAdminData();
  }

  async function updateUser(user: User, patch: UserDraft) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Nutzer konnte nicht geändert werden.");
      return;
    }

    setMessage("Nutzer aktualisiert.");
    await loadAdminData();
  }

  async function importNuLigaData() {
    setNuLigaImporting(true);
    setMessage("Import läuft...");
    const response = await fetch("/api/admin/nuliga/import", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setNuLigaImporting(false);

    if (!response.ok) {
      setMessage(data.error ?? "Import fehlgeschlagen.");
      return;
    }

    setNuLigaSummary(data);
    setMessage(`Import abgeschlossen: ${data.importedTeams} Mannschaften, ${data.importedPlayers} Spieler.`);
    await loadAdminData();
  }

  async function linkTeamPlayer(user: User) {
    const teamPlayerId = selectedTeamPlayers[user.id] ?? user.teamPlayer?.id ?? possibleTeamPlayerMatch(user)?.id ?? "";
    await updateUser(user, { teamPlayerId: teamPlayerId || null });
  }

  async function updateContractType(user: User, contractType: ContractType) {
    const defaults = contractOptions[contractType];
    await updateUser(user, {
      contractType,
      annualFeeCents: defaults.feeCents,
      workHoursRequired: defaults.workHours ?? null
    });
  }

  async function updateKeyType(user: User, keyType: KeyType) {
    await updateUser(user, {
      keyType,
      hasKey: keyType !== "NONE"
    });
  }

  function openUserPanel(user: User) {
    setEditingUser(user);
    setUserDraft({ ...user, teamPlayerIds: linkedTeamPlayers(user).map((player) => player.id) } as Partial<User> & { teamPlayerIds: string[] });
    setDetailTab("Übersicht");
  }

  function updateDraft(patch: UserDraft) {
    setUserDraft((current) => ({ ...current, ...patch }));
  }

  async function saveUserDraft() {
    if (!editingUser) {
      return;
    }
    await updateUser(editingUser, userDraft);
    setEditingUser(null);
    setUserDraft({});
  }

  async function previewCsvImport(file: File | null) {
    if (!file) {
      return;
    }
    setImportingCsv(true);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/users/import-preview", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    setImportingCsv(false);

    if (!response.ok) {
      setMessage(data.error ?? "CSV konnte nicht gelesen werden.");
      return;
    }
    setImportPreview(data);
    setMessage(data.errors?.length ? "CSV enthält Fehler. Bitte korrigieren und erneut hochladen." : "CSV-Vorschau erstellt.");
  }

  async function confirmCsvImport() {
    if (!importPreview || importPreview.errors.length) {
      return;
    }
    const response = await fetch("/api/admin/users/import-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: importPreview.rows })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "CSV-Import konnte nicht gespeichert werden.");
      return;
    }

    setMessage(`CSV-Import gespeichert: ${data.created} neue Nutzer, ${data.updated} aktualisiert.`);
    setImportPreview(null);
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
        cancellationDeadlineHours: Number(editableSettings.cancellationDeadlineHours),
        maxActiveBookingsPerUser: Number(editableSettings.maxActiveBookingsPerUser),
        maxAdvanceBookingDaysMember: Number(editableSettings.maxAdvanceBookingDaysMember),
        maxAdvanceBookingDaysGuest: Number(editableSettings.maxAdvanceBookingDaysGuest),
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
      setMessage(data.error ?? "Sperre konnte nicht gelöscht werden.");
      return;
    }

    setMessage("Sperre gelöscht.");
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
                    <option value="CONFIRMED">Bestätigt</option>
                    <option value="PENDING">Pending</option>
                    <option value="CANCELLED">Storniert</option>
                  </select>
                  <button className="ghost-button danger" onClick={() => deleteBooking(booking.id)}>
                    Löschen
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "Nutzer" ? (
        <div className="admin-list member-admin">
          <div className="section-heading-row">
            <h2>Mitgliederverwaltung</h2>
            <span>{filteredUsers.length} von {users.length} Nutzern</span>
          </div>
          <section className="admin-import-card">
            <div>
              <p className="eyebrow">nuLiga Import</p>
              <h3>{nuligaSummary?.importedTeams ?? 0} Mannschaften · {nuligaSummary?.importedPlayers ?? 0} Spieler</h3>
              <p>
                Quelle:{" "}
                <a href={nuligaSummary?.sourceUrl ?? "#"} target="_blank" rel="noreferrer">
                  nuLiga TV Europabad Marbach
                </a>
              </p>
              <small>
                Saison: {nuligaSummary?.season ?? "noch unbekannt"} · Letzter Import:{" "}
                {formatDateTimeLocal(nuligaSummary?.lastImportedAt)}
                {nuligaSummary?.createdPlayers || nuligaSummary?.updatedPlayers || nuligaSummary?.skippedPlayers
                  ? ` · neu ${nuligaSummary.createdPlayers ?? 0}, aktualisiert ${nuligaSummary.updatedPlayers ?? 0}, übersprungen ${nuligaSummary.skippedPlayers ?? 0}`
                  : ""}
              </small>
            </div>
            <button className="button primary" disabled={nuligaImporting} onClick={importNuLigaData} type="button">
              {nuligaImporting ? "Import läuft..." : nuligaSummary?.lastImportedAt ? "Import aktualisieren" : "nuLiga-Daten importieren"}
            </button>
          </section>

          {nuligaSummary ? (
            <div className="nuliga-summary">
              <div className="team-summary-grid">
                {nuligaSummary.teams.map((team) => (
                  <span key={`${team.name}-${team.season ?? ""}`}>
                    {team.name}: {team.playerCount} Spieler{team.captainCount ? `, ${team.captainCount} MF` : ""}
                  </span>
                ))}
              </div>
              {nuligaSummary.warnings.length ? <small>Hinweis: {nuligaSummary.warnings.join(" ")}</small> : null}
            </div>
          ) : null}

          <section className="team-roster-panel">
            <div className="section-heading-row">
              <h3>Mannschaften / nuLiga-Spieler</h3>
              <small>{rosterPlayers.length} Spieler in der nuLiga-Auswahl</small>
            </div>
            <div className="team-chip-row">
              {["Alle", ...availableTeamNames, "Ohne Mannschaft", "Mannschaftsführer"].map((teamName) => (
                <button
                  className={teamRosterFilter === teamName ? "team-chip active" : "team-chip"}
                  key={teamName}
                  onClick={() => selectTeamChip(teamName)}
                  type="button"
                >
                  {teamName}
                </button>
              ))}
            </div>
            {teamRosterFilter !== "Ohne Mannschaft" ? (
              <div className="team-player-table">
                <div className="team-player-head">
                  <span>Rang</span>
                  <span>Name</span>
                  <span>LK</span>
                  <span>Jahrgang</span>
                  <span>Lizenznummer</span>
                  <span>ID-Nummer</span>
                  <span>Mannschaft</span>
                  <span>MF</span>
                  <span>Verknüpfter Nutzer</span>
                </div>
                {rosterPlayers.map((player) => (
                  <div className="team-player-row" key={player.id}>
                    <span>{player.rank ?? "-"}</span>
                    <strong>{player.fullName}</strong>
                    <span>{player.lk ?? "-"}</span>
                    <span>{player.birthYear ?? "-"}</span>
                    <span>{player.licenseNumber ?? "-"}</span>
                    <span>{player.nuLigaId ?? "-"}</span>
                    <span>
                      {player.team?.name ?? "-"}
                      {player.teamPosition ? ` · ${player.teamPosition}` : ""}
                    </span>
                    <span>{player.isCaptain ? "Ja" : "Nein"}</span>
                    <span>{player.userLinks?.map((link) => link.user.name).join(", ") || "-"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <div className="admin-actions-bar">
            <button className="ghost-button" onClick={() => { window.location.href = "/api/admin/users/export"; }} type="button">
              Mitglieder exportieren
            </button>
            <button className="ghost-button" onClick={() => { window.location.href = "/api/admin/users/import-template"; }} type="button">
              CSV-Vorlage herunterladen
            </button>
            <label className="ghost-button file-button">
              Mitglieder importieren
              <input accept=".csv,text/csv" type="file" onChange={(event) => void previewCsvImport(event.target.files?.[0] ?? null)} />
            </label>
          </div>

          {importPreview ? (
            <div className="csv-preview">
              <strong>
                CSV-Vorschau: {importPreview.rowCount} Zeilen · {importPreview.newUsers} neu · {importPreview.updateUsers} aktualisieren
              </strong>
              {importPreview.errors.length ? <p className="form-error">{importPreview.errors.join(" ")}</p> : null}
              {importPreview.warnings.length ? <small>{importPreview.warnings.join(" ")}</small> : null}
              <div className="row-actions">
                <button className="button primary" disabled={Boolean(importPreview.errors.length) || importingCsv} onClick={confirmCsvImport} type="button">
                  Import bestätigen
                </button>
                <button className="ghost-button" onClick={() => setImportPreview(null)} type="button">
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          <div className="admin-filter-bar">
            <label>
              Suche
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Name oder E-Mail" />
            </label>
            <label>
              Mitgliedsstatus
              <select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value as typeof memberFilter)}>
                <option value="ALL">Alle</option>
                <option value="PENDING">Mitgliedschaft in Prüfung</option>
                <option value="VERIFIED_MEMBER">Bestätigt</option>
                <option value="EXTERNAL">Gastspieler</option>
                <option value="REJECTED">Abgelehnt</option>
              </select>
            </label>
            <label>
              Vertragsstatus
              <select value={contractFilter} onChange={(event) => setContractFilter(event.target.value as ContractType | "ALL")}>
                <option value="ALL">Alle</option>
                {Object.entries(contractOptions).map(([value, option]) => (
                  <option value={value} key={value}>
                    {option.shortLabel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Schlüsselstatus
              <select value={keyFilter} onChange={(event) => setKeyFilter(event.target.value as KeyType | "ALL" | "WITH_KEY" | "WITHOUT_KEY")}>
                <option value="ALL">Alle</option>
                <option value="WITH_KEY">Mit Schlüssel</option>
                <option value="WITHOUT_KEY">Ohne Schlüssel</option>
                <option value="MAIN_CHANGING_COURTS">Haupttür / Umkleide / Plätze</option>
                <option value="MAIN_CHANGING_COURTS_CLUBROOM">Haupttür / Umkleide / Plätze & Gastraum</option>
              </select>
            </label>
            <label>
              Mannschaft
              <select value={teamFilter} onChange={(event) => selectTeamFilter(event.target.value)}>
                <option value="ALL">Alle</option>
                <option value="NONE">Ohne Mannschaft</option>
                <option value="POSSIBLE">Möglicher nuLiga-Treffer</option>
                <option value="LINKED">Verknüpft</option>
                <option value="CAPTAIN">Mannschaftsführer</option>
                {availableTeamNames.map((teamName) => (
                  <option value={teamName} key={teamName}>
                    {teamName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rolle
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
                <option value="ALL">Alle</option>
                <option value="USER">Nutzer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
          </div>

          <div className="member-table">
            <div className="section-heading-row registered-users-heading">
              <h3>Registrierte Nutzer</h3>
              <span>{filteredUsers.length} von {users.length} Nutzern</span>
            </div>
            <div className="member-table-head">
              <span>Name</span>
              <span>Mitgliedsstatus</span>
              <span>Kontotyp</span>
              <span>Vertrag</span>
              <span>Schlüssel</span>
              <span>Mannschaft(en)</span>
              <span>nuLiga</span>
              <span>Buchungen</span>
              <span>Registriert</span>
              <span>Aktionen</span>
            </div>
            {filteredUsers.map((user) => {
              const possibleMatches = unlinkedPossibleMatches(user, teamPlayers);
              const contract = contractOptions[user.contractType];
              const requiredHours = contractWorkHours(user);
              const linkedPlayers = linkedTeamPlayers(user);
              const teamNames = linkedPlayers.length
                ? Array.from(new Map(linkedPlayers.map((player) => [player.team?.name ?? "nuLiga", player])).values())
                : [];
              const nuLigaStatus = linkedPlayers.length
                ? possibleMatches.length
                  ? `Verknüpft · ${possibleMatches.length} weiterer Treffer`
                  : "Verknüpft"
                : possibleMatches.length
                  ? `${possibleMatches.length} Treffer prüfen`
                  : "Nicht verknüpft";

              return (
                <article className="member-table-row" key={user.id}>
                  <div className="member-name-cell">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  <span className={`status-badge ${user.membershipStatus.toLowerCase()} ${user.membershipType.toLowerCase()}`}>
                    {membershipLabel(user)}
                  </span>
                  <span className={`status-badge ${user.membershipType.toLowerCase()}`}>{user.membershipType === "MEMBER" ? "Mitglied" : "Gastspieler"}</span>
                  <span className={`status-badge contract-${user.contractType.toLowerCase().replaceAll("_", "-")}`}>
                    <strong>{contract.shortLabel}</strong>
                    <small>
                      {euroLabel(contractFee(user))}
                      {requiredHours ? ` · ${requiredHours} Arbeitsstunden` : ""}
                    </small>
                  </span>
                  <span className={`status-badge ${user.hasKey ? "linked" : "neutral"}`}>{keyOptions[user.keyType]}</span>
                  <span className="chip-list">
                    {teamNames.length || possibleMatches.length ? (
                      <>
                      {teamNames.map((player) => (
                        <span className="mini-chip team" key={`${user.id}-${player.team?.name}`}>
                          {player.team?.name ?? "nuLiga"}{player.isCaptain ? " · MF" : ""}
                        </span>
                      ))}
                      {possibleMatches.map((player) => (
                        <span className="mini-chip pending" key={`${user.id}-possible-${player.id}`}>
                          {player.team?.name ?? "nuLiga"} · Treffer{player.isCaptain ? " · MF" : ""}
                        </span>
                      ))}
                      </>
                    ) : (
                      <span className="mini-chip neutral">Ohne Mannschaft</span>
                    )}
                  </span>
                  <span className={`status-badge ${linkedPlayers.length ? "linked" : possibleMatches.length ? "pending" : "neutral"}`}>{nuLigaStatus}</span>
                  <span>{user.bookingCount} aktiv</span>
                  <span>
                    {user.lastLoginAt ? `Login ${dateInputValue(user.lastLoginAt)}` : `Registriert ${dateInputValue(user.createdAt)}`}
                  </span>
                  <div className="compact-actions quiet-actions">
                    {user.membershipStatus === "PENDING" && user.membershipType === "MEMBER" ? (
                      <button className="ghost-button" onClick={() => updateUser(user, { membershipStatus: "VERIFIED" })} type="button">
                        Bestätigen
                      </button>
                    ) : null}
                    <button className="table-action-button" onClick={() => openUserPanel(user)} type="button">
                      Details
                    </button>
                    <button className="table-action-button primary" onClick={() => openUserPanel(user)} type="button">
                      Bearbeiten
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "Preise & Zeiten" ? (
        <form className="admin-form settings-form" onSubmit={saveSettings}>
          <h2>Preise und buchbare Zeitfenster</h2>
          <div className="form-row">
            <label>
              Preis pro Stunde für Gastspieler
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
              Öffnung
              <input
                type="number"
                min="0"
                max="23"
                value={editableSettings.openingHour}
                onChange={(event) => setEditableSettings({ ...editableSettings, openingHour: event.target.value })}
              />
            </label>
            <label>
              Schließung
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
          <div className="form-row">
            <label>
              Stornofrist in Stunden
              <input
                type="number"
                min="0"
                value={editableSettings.cancellationDeadlineHours}
                onChange={(event) => setEditableSettings({ ...editableSettings, cancellationDeadlineHours: event.target.value })}
              />
            </label>
            <label>
              Max. aktive Buchungen
              <input
                type="number"
                min="1"
                value={editableSettings.maxActiveBookingsPerUser}
                onChange={(event) => setEditableSettings({ ...editableSettings, maxActiveBookingsPerUser: event.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Vorausbuchung Mitglieder in Tagen
              <input
                type="number"
                min="1"
                value={editableSettings.maxAdvanceBookingDaysMember}
                onChange={(event) => setEditableSettings({ ...editableSettings, maxAdvanceBookingDaysMember: event.target.value })}
              />
            </label>
            <label>
              Vorausbuchung Gäste in Tagen
              <input
                type="number"
                min="1"
                value={editableSettings.maxAdvanceBookingDaysGuest}
                onChange={(event) => setEditableSettings({ ...editableSettings, maxAdvanceBookingDaysGuest: event.target.value })}
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

      {activeTab === "Plätze & Sperren" ? (
        <div className="admin-two-column">
          <div className="admin-list">
            <h2>Platzübersicht</h2>
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
                      const notes = window.prompt("Notiz für den Platz", court.notes ?? "");
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
                  Löschen
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="member-detail-panel">
            <div className="detail-panel-header">
              <div>
                <p className="eyebrow">Mitglied bearbeiten</p>
                <h2>{editingUser.name}</h2>
                <small>{editingUser.email}</small>
              </div>
              <button className="ghost-button" onClick={() => setEditingUser(null)} type="button">
                Schließen
              </button>
            </div>

            <div className="detail-tabs">
              {detailTabs.map((tab) => (
                <button className={detailTab === tab ? "active" : ""} key={tab} onClick={() => setDetailTab(tab)} type="button">
                  {tab}
                </button>
              ))}
            </div>

            {detailTab === "Übersicht" ? (
            <>
            <section className="detail-section">
              <h3>Stammdaten</h3>
              <div className="form-row">
                <label>
                  Name
                  <input value={userDraft.name ?? ""} onChange={(event) => updateDraft({ name: event.target.value })} />
                </label>
                <label>
                  E-Mail
                  <input value={userDraft.email ?? ""} disabled />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Telefonnummer
                  <input value={userDraft.phoneNumber ?? ""} onChange={(event) => updateDraft({ phoneNumber: event.target.value || null })} />
                </label>
                <label>
                  Mitgliedsnummer
                  <input value={userDraft.memberNumber ?? ""} onChange={(event) => updateDraft({ memberNumber: event.target.value || null })} />
                </label>
              </div>
              <small>
                Registriert: {editingUser.createdAt ? formatDateTimeLocal(editingUser.createdAt) : "unbekannt"} · Letzter Login:{" "}
                {formatDateTimeLocal(editingUser.lastLoginAt)}
              </small>
            </section>

            <section className="detail-section">
              <h3>Mitgliedsstatus</h3>
              <div className="form-row">
                <label>
                  Kontotyp
                  <select value={userDraft.membershipType} onChange={(event) => updateDraft({ membershipType: event.target.value as User["membershipType"] })}>
                    <option value="MEMBER">Mitglied</option>
                    <option value="EXTERNAL">Gastspieler</option>
                  </select>
                </label>
                <label>
                  Mitgliedsstatus
                  <select
                    value={userDraft.membershipStatus}
                    onChange={(event) => updateDraft({ membershipStatus: event.target.value as User["membershipStatus"] })}
                  >
                    <option value="PENDING">Mitgliedschaft in Prüfung</option>
                    <option value="VERIFIED">Bestätigt</option>
                    <option value="REJECTED">Abgelehnt</option>
                  </select>
                </label>
                <label>
                  Rolle
                  <select value={userDraft.role} onChange={(event) => updateDraft({ role: event.target.value as User["role"] })}>
                    <option value="USER">Nutzer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
              </div>
              <label className="toggle-line">
                <input checked={userDraft.isActive ?? true} onChange={(event) => updateDraft({ isActive: event.target.checked })} type="checkbox" />
                Aktiv
              </label>
              <small>
                Zusammenfassung: {contractOptions[userDraft.contractType ?? "NONE"].shortLabel} · {keyOptions[userDraft.keyType ?? "NONE"]} ·{" "}
                {teamSummary({ ...editingUser, ...userDraft } as User)}
              </small>
            </section>
            </>
            ) : null}

            {detailTab === "Vertrag" ? (
            <section className="detail-section">
              <h3>Vertragsstatus</h3>
              <div className="form-row">
                <label>
                  Vertragsstatus
                  <select
                    value={userDraft.contractType}
                    onChange={(event) => {
                      const contractType = event.target.value as ContractType;
                      updateDraft({
                        contractType,
                        annualFeeCents: contractOptions[contractType].feeCents,
                        workHoursRequired: contractOptions[contractType].workHours ?? null
                      });
                    }}
                  >
                    {Object.entries(contractOptions).map(([value, option]) => (
                      <option value={value} key={value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Vertragsbeginn
                  <input
                    type="date"
                    value={dateInputValue(userDraft.contractStartDate)}
                    onChange={(event) => updateDraft({ contractStartDate: event.target.value || null })}
                  />
                </label>
                <label>
                  Vertragsende
                  <input
                    type="date"
                    value={dateInputValue(userDraft.contractEndDate)}
                    onChange={(event) => updateDraft({ contractEndDate: event.target.value || null })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Arbeitsstunden erforderlich
                  <input
                    min="0"
                    type="number"
                    value={userDraft.workHoursRequired ?? ""}
                    onChange={(event) => updateDraft({ workHoursRequired: event.target.value ? Number(event.target.value) : null })}
                  />
                </label>
                <label>
                  Arbeitsstunden erledigt
                  <input
                    min="0"
                    type="number"
                    value={userDraft.workHoursDone ?? 0}
                    onChange={(event) => updateDraft({ workHoursDone: Number(event.target.value) })}
                  />
                </label>
              </div>
              <small>
                Beitrag: {euroLabel(userDraft.annualFeeCents ?? contractOptions[userDraft.contractType ?? "NONE"].feeCents)}
                {contractOptions[userDraft.contractType ?? "NONE"].hint ? ` · ${contractOptions[userDraft.contractType ?? "NONE"].hint}` : ""}
              </small>
              <label>
                Vertragsnotiz
                <textarea value={userDraft.contractNote ?? ""} onChange={(event) => updateDraft({ contractNote: event.target.value || null })} />
              </label>
            </section>
            ) : null}

            {detailTab === "Schlüssel" ? (
            <section className="detail-section">
              <h3>Schlüssel</h3>
              <div className="form-row">
                <label>
                  Schlüsselart
                  <select value={userDraft.keyType} onChange={(event) => updateDraft({ keyType: event.target.value as KeyType, hasKey: event.target.value !== "NONE" })}>
                    {Object.entries(keyOptions).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ausgabedatum
                  <input type="date" value={dateInputValue(userDraft.keyIssuedAt)} onChange={(event) => updateDraft({ keyIssuedAt: event.target.value || null })} />
                </label>
                <label>
                  Rückgabedatum
                  <input type="date" value={dateInputValue(userDraft.keyReturnedAt)} onChange={(event) => updateDraft({ keyReturnedAt: event.target.value || null })} />
                </label>
              </div>
              <label>
                Schlüsselnotiz
                <textarea value={userDraft.keyNote ?? ""} onChange={(event) => updateDraft({ keyNote: event.target.value || null })} />
              </label>
            </section>
            ) : null}

            {detailTab === "nuLiga" ? (
            <section className="detail-section">
              <h3>nuLiga / Mannschaft</h3>
              {unlinkedPossibleMatches(editingUser, teamPlayers).length ? (
                <div className="possible-match-box">
                  <strong>{unlinkedPossibleMatches(editingUser, teamPlayers).length} weitere mögliche nuLiga-Treffer</strong>
                  <div className="chip-list">
                    {unlinkedPossibleMatches(editingUser, teamPlayers).map((player) => (
                      <span className="mini-chip pending" key={player.id}>
                        {player.fullName} · {player.team?.name}{player.isCaptain ? " · MF" : ""}
                      </span>
                    ))}
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      updateDraft({
                        teamPlayerIds: Array.from(
                          new Set([...(userDraft.teamPlayerIds ?? linkedTeamPlayers(editingUser).map((player) => player.id)), ...unlinkedPossibleMatches(editingUser, teamPlayers).map((player) => player.id)])
                        )
                      })
                    }
                    type="button"
                  >
                    Alle Treffer übernehmen
                  </button>
                </div>
              ) : null}
              <label>
                Verknüpfte nuLiga-Spielerprofile
                <select
                  multiple
                  value={userDraft.teamPlayerIds ?? linkedTeamPlayers(editingUser).map((player) => player.id)}
                  onChange={(event) =>
                    updateDraft({ teamPlayerIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value) })
                  }
                >
                  {teamPlayers.map((player) => (
                    <option value={player.id} key={player.id}>
                      {player.fullName} · {player.team?.name ?? "nuLiga"}{player.isCaptain ? " · Mannschaftsführer" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="linked-player-list">
                {(userDraft.teamPlayerIds ?? linkedTeamPlayers(editingUser).map((player) => player.id)).map((id) => {
                  const player = teamPlayers.find((entry) => entry.id === id);
                  return player ? (
                    <div className="linked-player-card" key={id}>
                      <strong>{player.fullName}</strong>
                      <small>
                        {player.team?.name} · Rang {player.rank ?? "-"} · Position {player.teamPosition ?? "-"} · {player.lk ?? "-"} · ID{" "}
                        {player.nuLigaId ?? "-"} · Lizenz {player.licenseNumber ?? "-"} · Jahrgang {player.birthYear ?? "-"}
                        {player.nation ? ` · Nation ${player.nation}` : ""}
                        {player.isCaptain ? " · Mannschaftsführer" : ""}
                      </small>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="row-actions">
                <button
                  className="ghost-button"
                  onClick={() => {
                    const match = possibleTeamPlayerMatch(editingUser);
                    if (match) {
                      updateDraft({ teamPlayerIds: Array.from(new Set([...(userDraft.teamPlayerIds ?? []), match.id])) });
                    }
                  }}
                  type="button"
                >
                  Mit nuLiga-Spieler verknüpfen
                </button>
                <button className="ghost-button danger" onClick={() => updateDraft({ teamPlayerIds: [] })} type="button">
                  Verknüpfung lösen
                </button>
                <button className="ghost-button" onClick={() => updateDraft({ membershipType: "MEMBER", membershipStatus: "VERIFIED" })} type="button">
                  Als Mitglied bestätigen
                </button>
              </div>
            </section>
            ) : null}

            {detailTab === "Buchungen" ? (
            <section className="detail-section">
              <h3>Buchungen</h3>
              <p>{editingUser.bookingCount} Buchungen insgesamt.</p>
            </section>
            ) : null}

            {detailTab === "Notizen" ? (
            <section className="detail-section">
              <h3>Adminnotiz</h3>
              <textarea value={userDraft.adminNote ?? ""} onChange={(event) => updateDraft({ adminNote: event.target.value || null })} />
            </section>
            ) : null}

            <div className="detail-panel-actions">
              <button className="button primary" onClick={saveUserDraft} type="button">
                Speichern
              </button>
              <button className="ghost-button" onClick={() => setEditingUser(null)} type="button">
                Abbrechen
              </button>
              <button
                className="ghost-button danger"
                onClick={() => {
                  if (window.confirm("Mitglied wirklich ablehnen?")) {
                    updateDraft({ membershipType: "MEMBER", membershipStatus: "REJECTED" });
                  }
                }}
                type="button"
              >
                Mitglied ablehnen
              </button>
              <button
                className="ghost-button"
                onClick={() => updateDraft({ membershipType: "EXTERNAL", membershipStatus: "VERIFIED", memberNumber: null })}
                type="button"
              >
                Als Gastspieler markieren
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
