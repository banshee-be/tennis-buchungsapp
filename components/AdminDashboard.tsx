"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Booking = {
  id: string;
  bookingCode?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentStatus: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED";
  totalAmountCents: number;
  confirmationEmailSentAt?: string | null;
  reminderEmailSentAt?: string | null;
  lastEmailError?: string | null;
  emailRetryCount?: number;
  user?: { name: string; email: string; membershipType?: "MEMBER" | "EXTERNAL"; membershipStatus?: "PENDING" | "VERIFIED" | "REJECTED" };
  court?: { name: string };
};

type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN" | "MEMBER_MANAGER" | "SPORTS_MANAGER" | "TREASURER" | "COURT_MANAGER";
  isActive: boolean;
  hasAccount?: boolean;
  membershipType: "MEMBER" | "EXTERNAL";
  membershipStatus: "PENDING" | "VERIFIED" | "REJECTED";
  memberNumber?: string | null;
  birthDate?: string | null;
  street?: string | null;
  addressAdditional?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  lifecycleStatus: "ACTIVE" | "PAUSED" | "RESIGNED" | "ENDED" | "ARCHIVED";
  joinedAt?: string | null;
  leftAt?: string | null;
  resignationAt?: string | null;
  resignationReason?: string | null;
  archivedAt?: string | null;
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
  contributions?: Array<{ id: string; year: number; amountDueCents: number; amountPaidCents: number; status: string; dueDate?: string | null; paidAt?: string | null; paymentMethod?: string | null; isExempt: boolean; note?: string | null }>;
  workHourEntries?: Array<{ id: string; minutes: number; activity: string; performedAt: string; correctionReason?: string | null }>;
  keyAssignments?: Array<{ id: string; keyType: KeyType; keyNumber?: string | null; issuedAt: string; returnedAt?: string | null; depositCents?: number | null; depositStatus: string; note?: string | null }>;
  memberEmails?: Array<{ id: string; kind: string; status: string; error?: string | null; sentAt?: string | null; createdAt: string }>;
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

type NuLigaMatchSummary = {
  sourceUrl: string;
  lastImportedAt?: string | null;
  importedTeams: number;
  importedMatches: number;
  homeMatches: number;
  proposedBlocks: number;
  createdBlocks: number;
  needsReview: number;
  warnings: string[];
  teams: {
    id: string;
    name: string;
    season?: string | null;
    matchCount: number;
    homeMatchCount: number;
  }[];
  matches: {
    id: string;
    teamName: string;
    season?: string | null;
    date: string;
    startTime: string;
    endTime?: string | null;
    homeTeam: string;
    awayTeam: string;
    opponent?: string | null;
    isHomeMatch: boolean;
    league?: string | null;
    groupName?: string | null;
    blockStatus: "NONE" | "PROPOSED" | "CREATED" | "SKIPPED" | "NEEDS_REVIEW" | string;
    importStatus: string;
    blockId?: string | null;
    sourceUrl: string;
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
  guestDataRetentionDays: number;
  reminderHoursBefore: number;
  matchBlockDurationHours: number;
  matchBlockDefaultStartTime: string;
  matchBlockCourtIds: string;
  matchBlockBufferBeforeMinutes: number;
  matchBlockBufferAfterMinutes: number;
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

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  actor?: { name: string; email: string } | null;
};

type DuplicatePair = {
  left: { id: string; name: string; email: string };
  right: { id: string; name: string; email: string };
  score: number;
  reasons: string[];
};

type Permission = "admin.access" | "members.read" | "members.write" | "members.export" | "members.roles" | "members.finance" | "members.keys" | "members.sports" | "bookings.manage" | "courts.read" | "courts.manage" | "settings.manage";

const tabs = ["Übersicht", "Buchungen", "Mitglieder", "Preise & Zeiten", "Plätze & Sperren"] as const;
type Tab = (typeof tabs)[number];
type DetailTab = "Übersicht" | "Vertrag" | "Beiträge" | "Arbeitsstunden" | "Schlüssel" | "nuLiga" | "Buchungen" | "Kommunikation" | "Notizen";
const detailTabs: DetailTab[] = ["Übersicht", "Vertrag", "Beiträge", "Arbeitsstunden", "Schlüssel", "nuLiga", "Buchungen", "Kommunikation", "Notizen"];

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

function blockStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NONE: "Keine Sperre",
    PROPOSED: "Sperre vorgeschlagen",
    CREATED: "Sperre erstellt",
    SKIPPED: "Übersprungen",
    NEEDS_REVIEW: "Prüfen"
  };
  return labels[status] ?? status;
}

function formatDateLocal(value: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    new Date(value)
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Übersicht");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayerOption[]>([]);
  const [selectedTeamPlayers, setSelectedTeamPlayers] = useState<Record<string, string>>({});
  const [nuligaSummary, setNuLigaSummary] = useState<NuLigaSummary | null>(null);
  const [nuligaImporting, setNuLigaImporting] = useState(false);
  const [nuligaMatchSummary, setNuLigaMatchSummary] = useState<NuLigaMatchSummary | null>(null);
  const [nuligaMatchesImporting, setNuLigaMatchesImporting] = useState(false);
  const [nuligaBlocksCreating, setNuLigaBlocksCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contractFilter, setContractFilter] = useState<ContractType | "ALL">("ALL");
  const [keyFilter, setKeyFilter] = useState<KeyType | "ALL" | "WITH_KEY" | "WITHOUT_KEY">("ALL");
  const [memberFilter, setMemberFilter] = useState<"ALL" | "PENDING" | "VERIFIED_MEMBER" | "EXTERNAL" | "REJECTED">("ALL");
  const [teamFilter, setTeamFilter] = useState<"ALL" | "NONE" | "POSSIBLE" | "LINKED" | string>("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | User["role"]>("ALL");
  const [teamRosterFilter, setTeamRosterFilter] = useState("Alle");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userDraft, setUserDraft] = useState<UserDraft>({});
  const [detailTab, setDetailTab] = useState<DetailTab>("Übersicht");
  const [memberPage, setMemberPage] = useState(1);
  const memberPageSize = 20;
  const [newMember, setNewMember] = useState({ name: "", email: "", phoneNumber: "", memberNumber: "" });
  const [workHourForm, setWorkHourForm] = useState({ minutes: "60", activity: "", performedAt: today(), correctionReason: "" });
  const [contributionForm, setContributionForm] = useState({ year: String(new Date().getFullYear()), amountDue: "", amountPaid: "", status: "OPEN" });
  const [keyRecordForm, setKeyRecordForm] = useState({ keyType: "MAIN_CHANGING_COURTS" as Exclude<KeyType, "NONE">, keyNumber: "", issuedAt: today(), deposit: "" });
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [duplicatePairs, setDuplicatePairs] = useState<DuplicatePair[]>([]);
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
      guestDataRetentionDays: String(settings?.guestDataRetentionDays ?? 180),
      reminderHoursBefore: String(settings?.reminderHoursBefore ?? 24),
      matchBlockDurationHours: String(settings?.matchBlockDurationHours ?? 6),
      matchBlockDefaultStartTime: settings?.matchBlockDefaultStartTime ?? "09:00",
      matchBlockCourtIds: settings?.matchBlockCourtIds ?? "1,2,3,4",
      matchBlockBufferBeforeMinutes: String(settings?.matchBlockBufferBeforeMinutes ?? 0),
      matchBlockBufferAfterMinutes: String(settings?.matchBlockBufferAfterMinutes ?? 30),
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

  useEffect(() => setMemberPage(1), [searchTerm, contractFilter, keyFilter, memberFilter, teamFilter, roleFilter]);
  const memberPageCount = Math.max(1, Math.ceil(filteredUsers.length / memberPageSize));
  const pagedUsers = filteredUsers.slice((memberPage - 1) * memberPageSize, memberPage * memberPageSize);

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");
    return {
      today: confirmed.filter((booking) => {
        const start = new Date(booking.startTime);
        return start >= todayStart && start < todayEnd;
      }).length,
      upcoming: confirmed.filter((booking) => new Date(booking.startTime) > now).length,
      monthlyRevenueCents: confirmed
        .filter((booking) => booking.paymentStatus === "PAID" && new Date(booking.startTime) >= monthStart)
        .reduce((sum, booking) => sum + booking.totalAmountCents, 0),
      paymentIssues: bookings.filter((booking) => booking.paymentStatus === "FAILED" || booking.paymentStatus === "PENDING").length,
      emailIssues: bookings.filter((booking) => Boolean(booking.lastEmailError)).length,
      pendingMembers: users.filter((user) => user.membershipType === "MEMBER" && user.membershipStatus === "PENDING").length
      ,activeMembers: users.filter((user) => user.membershipType === "MEMBER" && user.lifecycleStatus === "ACTIVE").length
      ,pausedMembers: users.filter((user) => user.lifecycleStatus === "PAUSED").length
      ,openContributions: users.flatMap((user) => user.contributions ?? []).filter((entry) => entry.status === "OPEN" || entry.amountPaidCents < entry.amountDueCents).length
      ,openWorkHours: users.filter((user) => (user.workHoursRequired ?? 0) > user.workHoursDone).length
      ,keyReturns: users.filter((user) => user.lifecycleStatus !== "ACTIVE" && user.hasKey).length
    };
  }, [bookings, users]);

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
    const sessionResponse = await fetch("/api/auth/me", { cache: "no-store" });
    const sessionData = await sessionResponse.json().catch(() => ({ user: null }));
    const currentPermissions = (sessionData.user?.permissions ?? []) as Permission[];
    setPermissions(currentPermissions);
    if (!currentPermissions.includes("admin.access")) {
      setMessage("Kein Zugriff. Bitte mit einer Admin-Rolle einloggen.");
      setLoading(false);
      return [] as User[];
    }
    const can = (permission: Permission) => currentPermissions.includes(permission);
    const emptyResponse = (body: object) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    const endpoints = [
      can("bookings.manage") ? fetch("/api/admin/bookings", { cache: "no-store" }) : emptyResponse({ bookings: [] }),
      fetch("/api/admin/users", { cache: "no-store" }),
      can("courts.read") ? fetch("/api/admin/courts", { cache: "no-store" }) : emptyResponse({ courts: [] }),
      can("courts.manage") ? fetch("/api/admin/blocks", { cache: "no-store" }) : emptyResponse({ blocks: [] }),
      can("settings.manage") ? fetch("/api/admin/settings", { cache: "no-store" }) : emptyResponse({ settings: null }),
      can("members.sports") ? fetch("/api/admin/nuliga/import", { cache: "no-store" }) : emptyResponse(null as unknown as object),
      can("members.sports") ? fetch("/api/admin/nuliga/matches", { cache: "no-store" }) : emptyResponse(null as unknown as object),
      can("settings.manage") ? fetch("/api/admin/audit", { cache: "no-store" }) : emptyResponse({ logs: [] })
    ];
    const [bookingsResponse, usersResponse, courtsResponse, blocksResponse, settingsResponse, nuligaResponse, nuligaMatchesResponse, auditResponse] =
      await Promise.all(endpoints);

    if (!usersResponse.ok) {
      const data = await usersResponse.json().catch(() => ({}));
      setMessage(data.error ?? "Kein Zugriff. Bitte als Admin einloggen.");
      setLoading(false);
      return [] as User[];
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
    setNuLigaMatchSummary(nuligaMatchesResponse.ok ? await nuligaMatchesResponse.json() : null);
    setAuditLogs(auditResponse.ok ? (await auditResponse.json()).logs : []);
    if (can("members.roles")) {
      const duplicateResponse = await fetch("/api/admin/users/duplicates", { cache: "no-store" });
      setDuplicatePairs(duplicateResponse.ok ? (await duplicateResponse.json()).duplicates ?? [] : []);
    } else {
      setDuplicatePairs([]);
    }
    setLoading(false);
    return usersData.users as User[];
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

    setMessage("Buchung storniert und archiviert.");
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

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMember)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Mitglied konnte nicht angelegt werden.");
      return;
    }
    setNewMember({ name: "", email: "", phoneNumber: "", memberNumber: "" });
    setMessage("Mitglied wurde angelegt und wartet auf Freigabe.");
    await loadAdminData();
  }

  async function runMemberAction(user: User, action: "approve" | "reject" | "pause" | "resign" | "reactivate" | "archive" | "invite" | "password_reset") {
    let reason: string | undefined;
    if (action === "resign") {
      const value = window.prompt("Austrittsgrund (optional)", "");
      if (value === null) return;
      reason = value;
    }
    const response = await fetch(`/api/admin/users/${user.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Aktion konnte nicht ausgeführt werden.");
      return;
    }
    const labels = { approve: "Mitglied bestätigt", reject: "Mitglied abgelehnt", pause: "Mitgliedschaft pausiert", resign: "Austritt erfasst", reactivate: "Mitglied reaktiviert", archive: "Mitglied archiviert", invite: "Einladung versendet", password_reset: "Passwort-Link versendet" };
    setMessage(`${labels[action]}${data.emailStatus === "FAILED" ? ", aber die E-Mail konnte nicht versendet werden" : ""}.`);
    setEditingUser(null);
    await loadAdminData();
  }

  async function addMemberRecord(type: "CONTRIBUTION" | "WORK_HOUR" | "KEY_ASSIGNMENT", payload: Record<string, unknown>) {
    if (!editingUser) return;
    const response = await fetch(`/api/admin/users/${editingUser.id}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Eintrag konnte nicht gespeichert werden.");
      return;
    }
    setMessage("Eintrag gespeichert.");
    const refreshedUsers = await loadAdminData();
    const refreshed = refreshedUsers.find((user) => user.id === editingUser.id);
    if (refreshed) openUserPanel(refreshed);
  }

  async function returnMemberKey(recordId: string) {
    if (!editingUser) return;
    const response = await fetch(`/api/admin/users/${editingUser.id}/records`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "KEY_ASSIGNMENT", recordId, returnedAt: today(), depositStatus: "RETURNED" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error ?? "Schlüsselrückgabe konnte nicht gespeichert werden."); return; }
    setMessage("Schlüsselrückgabe gespeichert.");
    const refreshedUsers = await loadAdminData();
    const refreshed = refreshedUsers.find((user) => user.id === editingUser.id);
    if (refreshed) openUserPanel(refreshed);
  }

  async function mergeDuplicate(source: DuplicatePair["left"], target: DuplicatePair["right"]) {
    const confirmation = window.prompt(`„${source.name}“ wird archiviert und in „${target.name}“ übernommen. Zum Bestätigen ZUSAMMENFÜHREN eingeben.`);
    if (confirmation !== "ZUSAMMENFÜHREN") return;
    const response = await fetch("/api/admin/users/duplicates/merge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUserId: source.id, targetUserId: target.id, confirmation })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error ?? "Dubletten konnten nicht zusammengeführt werden."); return; }
    setMessage("Mitgliederprofile wurden revisionssicher zusammengeführt.");
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

  async function importNuLigaMatchesData() {
    setNuLigaMatchesImporting(true);
    setMessage("nuLiga-Spieltage werden importiert...");
    const response = await fetch("/api/admin/nuliga/import-matches", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setNuLigaMatchesImporting(false);

    if (!response.ok) {
      setMessage(data.error ?? "Spieltermine konnten nicht importiert werden.");
      return;
    }

    setNuLigaMatchSummary(data);
    setMessage(
      `Spieltermine importiert: ${data.importedMatches} Begegnungen, ${data.homeMatches} Heimspiele, ${data.proposedBlocks} Sperren vorgeschlagen.`
    );
    await loadAdminData();
  }

  async function createMatchBlock(matchId: string, action?: "skip") {
    const response = await fetch(`/api/admin/nuliga/matches/${matchId}/create-block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action ? { action } : {})
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "Platzsperre konnte nicht erstellt werden.");
      return;
    }

    setMessage(action === "skip" ? "Spieltermin übersprungen." : "Platzsperre für Heimspiel erstellt.");
    await loadAdminData();
  }

  async function createAllMatchBlocks() {
    setNuLigaBlocksCreating(true);
    const response = await fetch("/api/admin/nuliga/matches/create-blocks", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setNuLigaBlocksCreating(false);

    if (!response.ok) {
      setMessage(data.error ?? "Platzsperren konnten nicht erstellt werden.");
      return;
    }

    setMessage(`Heimspiel-Sperren erstellt: ${data.created ?? 0}${data.warnings?.length ? ` · Hinweise: ${data.warnings.join(" ")}` : ""}`);
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
    const patch = permissions.includes("members.write")
      ? userDraft
      : permissions.includes("members.sports")
        ? { teamPlayerIds: userDraft.teamPlayerIds }
        : {};
    await updateUser(editingUser, patch);
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
        guestDataRetentionDays: Number(editableSettings.guestDataRetentionDays),
        reminderHoursBefore: Number(editableSettings.reminderHoursBefore),
        matchBlockDurationHours: Number(editableSettings.matchBlockDurationHours),
        matchBlockDefaultStartTime: editableSettings.matchBlockDefaultStartTime,
        matchBlockCourtIds: editableSettings.matchBlockCourtIds,
        matchBlockBufferBeforeMinutes: Number(editableSettings.matchBlockBufferBeforeMinutes),
        matchBlockBufferAfterMinutes: Number(editableSettings.matchBlockBufferAfterMinutes),
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

  const visibleTabs = tabs.filter((tab) =>
    tab === "Übersicht" || tab === "Mitglieder" ||
    (tab === "Buchungen" && permissions.includes("bookings.manage")) ||
    (tab === "Preise & Zeiten" && permissions.includes("settings.manage")) ||
    (tab === "Plätze & Sperren" && permissions.includes("courts.manage"))
  );
  const visibleDetailTabs = detailTabs.filter((tab) => {
    if (tab === "Beiträge") return permissions.includes("members.finance");
    if (tab === "Arbeitsstunden" || tab === "Kommunikation" || tab === "Notizen") return permissions.includes("members.write");
    if (tab === "Schlüssel") return permissions.includes("members.keys");
    if (tab === "nuLiga") return permissions.includes("members.sports") || permissions.includes("members.write");
    return true;
  });

  return (
    <div className="admin-layout">
      <div className="admin-tabs">
        {visibleTabs.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {message ? <p className={message.includes("konnte") || message.includes("Kein") ? "form-error" : "form-success"}>{message}</p> : null}

      {activeTab === "Übersicht" ? (
        <div className="admin-overview">
          <div className="admin-metric-grid">
            <article><span>Heute</span><strong>{dashboardStats.today}</strong><small>bestätigte Buchungen</small></article>
            <article><span>Kommend</span><strong>{dashboardStats.upcoming}</strong><small>bestätigte Termine</small></article>
            <article><span>Gastumsatz im Monat</span><strong>{euroLabel(dashboardStats.monthlyRevenueCents)}</strong><small>bezahlte Buchungen</small></article>
            <article><span>Zahlungen prüfen</span><strong>{dashboardStats.paymentIssues}</strong><small>offen oder fehlgeschlagen</small></article>
            <article><span>E-Mail-Probleme</span><strong>{dashboardStats.emailIssues}</strong><small>werden automatisch erneut versucht</small></article>
            <article><span>Mitglieder prüfen</span><strong>{dashboardStats.pendingMembers}</strong><small>offene Freigaben</small></article>
            <article><span>Aktive Mitglieder</span><strong>{dashboardStats.activeMembers}</strong><small>{dashboardStats.pausedMembers} pausiert</small></article>
            <article><span>Offene Beiträge</span><strong>{dashboardStats.openContributions}</strong><small>Beitragskonten prüfen</small></article>
            <article><span>Arbeitsstunden</span><strong>{dashboardStats.openWorkHours}</strong><small>Mitglieder mit Reststunden</small></article>
            <article><span>Schlüsselrückgabe</span><strong>{dashboardStats.keyReturns}</strong><small>bei inaktiven Mitgliedern</small></article>
          </div>
          <section className="admin-list overview-attention">
            <div className="section-heading-row">
              <h2>Handlungsbedarf</h2>
              <button className="ghost-button" onClick={() => setActiveTab("Buchungen")} type="button">Alle Buchungen</button>
            </div>
            {bookings.filter((booking) => booking.paymentStatus === "FAILED" || booking.paymentStatus === "PENDING" || booking.lastEmailError).slice(0, 12).map((booking) => (
              <article className="admin-row" key={booking.id}>
                <div>
                  <strong>{booking.bookingCode ?? booking.id} · {booking.court?.name}</strong>
                  <p>{formatDateTime(booking.startTime, booking.endTime)}</p>
                  <small>{booking.lastEmailError ? `E-Mail: ${booking.lastEmailError}` : `Zahlung: ${booking.paymentStatus}`}</small>
                </div>
              </article>
            ))}
            {!dashboardStats.paymentIssues && !dashboardStats.emailIssues ? <p className="form-success">Aktuell gibt es keine offenen Zahlungs- oder E-Mail-Probleme.</p> : null}
          </section>
          <section className="admin-list overview-attention">
            <div className="section-heading-row"><h2>Letzte Admin-Aktivitäten</h2><span>{auditLogs.length} Einträge</span></div>
            {auditLogs.slice(0, 12).map((entry) => (
              <article className="admin-row" key={entry.id}>
                <div>
                  <strong>{entry.action.replaceAll("_", " ")}</strong>
                  <p>{entry.actor?.name ?? "System"} · {entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}</p>
                  <small>{formatDateTimeLocal(entry.createdAt)}</small>
                </div>
              </article>
            ))}
          </section>
        </div>
      ) : null}

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
                    Archivieren
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "Mitglieder" ? (
        <div className="admin-list member-admin">
          <div className="section-heading-row">
            <h2>Mitgliederverwaltung</h2>
            <span>{filteredUsers.length} von {users.length} Nutzern</span>
          </div>
          {permissions.includes("members.write") ? <form className="admin-import-card" onSubmit={createMember}>
            <div>
              <p className="eyebrow">Manuell anlegen</p>
              <h3>Neues Mitglied</h3>
              <small>Das Konto wird zunächst als „in Prüfung“ angelegt. Anschließend kann eine Einladung versendet werden.</small>
            </div>
            <div className="form-row">
              <label>Name<input required value={newMember.name} onChange={(event) => setNewMember({ ...newMember, name: event.target.value })} /></label>
              <label>E-Mail<input required type="email" value={newMember.email} onChange={(event) => setNewMember({ ...newMember, email: event.target.value })} /></label>
              <label>Telefon<input value={newMember.phoneNumber} onChange={(event) => setNewMember({ ...newMember, phoneNumber: event.target.value })} /></label>
              <label>Mitgliedsnummer<input value={newMember.memberNumber} onChange={(event) => setNewMember({ ...newMember, memberNumber: event.target.value })} /></label>
            </div>
            <button className="button primary" type="submit">Mitglied anlegen</button>
          </form> : null}
          {permissions.includes("members.roles") && duplicatePairs.length ? (
            <section className="admin-import-card">
              <div><p className="eyebrow">Dublettenprüfung</p><h3>{duplicatePairs.length} mögliche Dublette{duplicatePairs.length === 1 ? "" : "n"}</h3><small>Zusammenführen überträgt Historien in das Zielprofil und archiviert die Quelle anonymisiert. Beitragskonflikte werden automatisch blockiert.</small></div>
              <div className="linked-player-list">
                {duplicatePairs.slice(0, 10).map((pair) => (
                  <div className="linked-player-card" key={`${pair.left.id}-${pair.right.id}`}>
                    <strong>{pair.left.name} ↔ {pair.right.name}</strong>
                    <small>{pair.reasons.join(", ")} · Trefferwert {pair.score}</small>
                    <div className="row-actions">
                      <button className="table-action-button" onClick={() => mergeDuplicate(pair.left, pair.right)} type="button">Links in rechts übernehmen</button>
                      <button className="table-action-button" onClick={() => mergeDuplicate(pair.right, pair.left)} type="button">Rechts in links übernehmen</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
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
            <button className="button primary" disabled={nuligaImporting || !permissions.includes("members.sports")} onClick={importNuLigaData} type="button">
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

          <section className="admin-import-card match-import-card">
            <div>
              <p className="eyebrow">nuLiga Spieltage</p>
              <h3>
                {nuligaMatchSummary?.importedMatches ?? 0} Begegnungen · {nuligaMatchSummary?.homeMatches ?? 0} Heimspiele
              </h3>
              <p>
                {nuligaMatchSummary?.proposedBlocks ?? 0} Sperren vorgeschlagen · {nuligaMatchSummary?.createdBlocks ?? 0} Sperren erstellt ·{" "}
                {nuligaMatchSummary?.needsReview ?? 0} Termine prüfen
              </p>
              <small>Letzter Import: {formatDateTimeLocal(nuligaMatchSummary?.lastImportedAt)}</small>
            </div>
            <div className="row-actions">
              <button className="button primary" disabled={nuligaMatchesImporting || !permissions.includes("members.sports")} onClick={importNuLigaMatchesData} type="button">
                {nuligaMatchesImporting ? "Import läuft..." : "Spieltage importieren"}
              </button>
              <button
                className="ghost-button"
                disabled={nuligaBlocksCreating || !nuligaMatchSummary?.proposedBlocks}
                onClick={createAllMatchBlocks}
                type="button"
              >
                Alle Heimspiel-Sperren erstellen
              </button>
            </div>
          </section>

          {nuligaMatchSummary ? (
            <section className="team-roster-panel">
              <div className="section-heading-row">
                <h3>Importierte Spieltage</h3>
                <small>
                  {nuligaMatchSummary.importedTeams} Mannschaften · {nuligaMatchSummary.importedMatches} Begegnungen
                </small>
              </div>
              <div className="team-summary-grid">
                {nuligaMatchSummary.teams.map((team) => (
                  <span key={team.id}>
                    {team.name}: {team.matchCount} Spiele{team.homeMatchCount ? `, ${team.homeMatchCount} Heimspiele` : ""}
                  </span>
                ))}
              </div>
              {nuligaMatchSummary.warnings.length ? <small>Hinweis: {nuligaMatchSummary.warnings.join(" ")}</small> : null}
              <div className="match-table">
                <div className="match-table-head">
                  <span>Datum</span>
                  <span>Uhrzeit</span>
                  <span>Mannschaft</span>
                  <span>Gegner</span>
                  <span>Ort</span>
                  <span>Status</span>
                  <span>Aktion</span>
                </div>
                {nuligaMatchSummary.matches.slice(0, 80).map((match) => (
                  <div className="match-table-row" key={match.id}>
                    <span>{formatDateLocal(match.startTime)}</span>
                    <span>{match.startTime.slice(11, 16)} Uhr</span>
                    <span>{match.teamName}</span>
                    <span>{match.opponent ?? "-"}</span>
                    <span>{match.isHomeMatch ? "Heimspiel" : "Auswärts"}</span>
                    <span className={`status-badge block-${match.blockStatus.toLowerCase().replaceAll("_", "-")}`}>
                      {blockStatusLabel(match.blockStatus)}
                    </span>
                    <span className="compact-actions">
                      {match.isHomeMatch && match.blockStatus === "PROPOSED" ? (
                        <>
                          <button className="table-action-button primary" onClick={() => createMatchBlock(match.id)} type="button">
                            Sperre erstellen
                          </button>
                          <button className="table-action-button" onClick={() => createMatchBlock(match.id, "skip")} type="button">
                            Überspringen
                          </button>
                        </>
                      ) : (
                        <a className="table-action-button" href={match.sourceUrl} target="_blank" rel="noreferrer">
                          Details
                        </a>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
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
            {permissions.includes("members.export") ? <button className="ghost-button" onClick={() => { window.location.href = "/api/admin/users/export"; }} type="button">
              Mitglieder exportieren
            </button> : null}
            {permissions.includes("members.export") ? <button className="ghost-button" onClick={() => { window.location.href = "/api/admin/users/import-template"; }} type="button">
              CSV-Vorlage herunterladen
            </button> : null}
            {permissions.includes("members.write") ? <label className="ghost-button file-button">
              Mitglieder importieren
              <input accept=".csv,text/csv" type="file" onChange={(event) => void previewCsvImport(event.target.files?.[0] ?? null)} />
            </label> : null}
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
                <option value="MEMBER_MANAGER">Mitgliederverwaltung</option>
                <option value="SPORTS_MANAGER">Sportwart</option>
                <option value="TREASURER">Kassenwart</option>
                <option value="COURT_MANAGER">Platzwart</option>
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
            {pagedUsers.map((user) => {
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
            <div className="admin-actions-bar">
              <button className="ghost-button" disabled={memberPage <= 1} onClick={() => setMemberPage((page) => page - 1)} type="button">Zurück</button>
              <span>Seite {memberPage} von {memberPageCount}</span>
              <button className="ghost-button" disabled={memberPage >= memberPageCount} onClick={() => setMemberPage((page) => page + 1)} type="button">Weiter</button>
            </div>
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
          <h3>Datenschutz und Benachrichtigungen</h3>
          <div className="form-row">
            <label>
              Gastdaten anonymisieren nach Tagen
              <input
                type="number"
                min="30"
                max="1095"
                value={editableSettings.guestDataRetentionDays}
                onChange={(event) => setEditableSettings({ ...editableSettings, guestDataRetentionDays: event.target.value })}
              />
            </label>
            <label>
              Erinnerung vor Termin in Stunden
              <input
                type="number"
                min="1"
                max="72"
                value={editableSettings.reminderHoursBefore}
                onChange={(event) => setEditableSettings({ ...editableSettings, reminderHoursBefore: event.target.value })}
              />
            </label>
          </div>
          <h3>Heimspiel-Sperren aus nuLiga</h3>
          <div className="form-row">
            <label>
              Standarddauer in Stunden
              <input
                type="number"
                min="1"
                max="12"
                value={editableSettings.matchBlockDurationHours}
                onChange={(event) => setEditableSettings({ ...editableSettings, matchBlockDurationHours: event.target.value })}
              />
            </label>
            <label>
              Standard-Startzeit
              <input
                type="time"
                value={editableSettings.matchBlockDefaultStartTime}
                onChange={(event) => setEditableSettings({ ...editableSettings, matchBlockDefaultStartTime: event.target.value })}
              />
            </label>
            <label>
              Zu sperrende Plätze
              <input
                placeholder="1,2,3,4"
                value={editableSettings.matchBlockCourtIds}
                onChange={(event) => setEditableSettings({ ...editableSettings, matchBlockCourtIds: event.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Puffer vor Spielbeginn in Minuten
              <input
                type="number"
                min="0"
                value={editableSettings.matchBlockBufferBeforeMinutes}
                onChange={(event) => setEditableSettings({ ...editableSettings, matchBlockBufferBeforeMinutes: event.target.value })}
              />
            </label>
            <label>
              Puffer nach Spielende in Minuten
              <input
                type="number"
                min="0"
                value={editableSettings.matchBlockBufferAfterMinutes}
                onChange={(event) => setEditableSettings({ ...editableSettings, matchBlockBufferAfterMinutes: event.target.value })}
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
              {visibleDetailTabs.map((tab) => (
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
                <label>Geburtsdatum<input type="date" value={dateInputValue(userDraft.birthDate)} onChange={(event) => updateDraft({ birthDate: event.target.value || null })} /></label>
                <label>Straße und Hausnummer<input value={userDraft.street ?? ""} onChange={(event) => updateDraft({ street: event.target.value || null })} /></label>
                <label>Adresszusatz<input value={userDraft.addressAdditional ?? ""} onChange={(event) => updateDraft({ addressAdditional: event.target.value || null })} /></label>
              </div>
              <div className="form-row">
                <label>PLZ<input value={userDraft.postalCode ?? ""} onChange={(event) => updateDraft({ postalCode: event.target.value || null })} /></label>
                <label>Ort<input value={userDraft.city ?? ""} onChange={(event) => updateDraft({ city: event.target.value || null })} /></label>
                <label>Land<input value={userDraft.country ?? "Deutschland"} onChange={(event) => updateDraft({ country: event.target.value || null })} /></label>
              </div>
              <div className="form-row">
                <label>Notfallkontakt<input value={userDraft.emergencyContactName ?? ""} onChange={(event) => updateDraft({ emergencyContactName: event.target.value || null })} /></label>
                <label>Notfall-Telefon<input value={userDraft.emergencyContactPhone ?? ""} onChange={(event) => updateDraft({ emergencyContactPhone: event.target.value || null })} /></label>
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
                    <option value="MEMBER_MANAGER">Mitgliederverwaltung</option>
                    <option value="SPORTS_MANAGER">Sportwart</option>
                    <option value="TREASURER">Kassenwart</option>
                    <option value="COURT_MANAGER">Platzwart</option>
                    <option value="SUPER_ADMIN">Super-Admin</option>
                    <option value="ADMIN">Admin (bisherige Rolle)</option>
                  </select>
                </label>
                <label>
                  Lebenszyklus
                  <select value={userDraft.lifecycleStatus} onChange={(event) => updateDraft({ lifecycleStatus: event.target.value as User["lifecycleStatus"] })}>
                    <option value="ACTIVE">Aktiv</option><option value="PAUSED">Pausiert</option><option value="RESIGNED">Ausgetreten</option><option value="ENDED">Beendet</option><option value="ARCHIVED">Archiviert</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>Eintritt<input type="date" value={dateInputValue(userDraft.joinedAt)} onChange={(event) => updateDraft({ joinedAt: event.target.value || null })} /></label>
                <label>Austritt<input type="date" value={dateInputValue(userDraft.leftAt)} onChange={(event) => updateDraft({ leftAt: event.target.value || null })} /></label>
                <label>Austrittsgrund<input value={userDraft.resignationReason ?? ""} onChange={(event) => updateDraft({ resignationReason: event.target.value || null })} /></label>
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

            {detailTab === "Beiträge" ? (
            <section className="detail-section">
              <h3>Beiträge</h3>
              <div className="linked-player-list">
                {(editingUser.contributions ?? []).map((entry) => (
                  <div className="linked-player-card" key={entry.id}><strong>{entry.year}: {euroLabel(entry.amountPaidCents)} von {euroLabel(entry.amountDueCents)}</strong><small>Status {entry.status}{entry.paidAt ? ` · bezahlt ${dateInputValue(entry.paidAt)}` : ""}</small></div>
                ))}
                {!editingUser.contributions?.length ? <small>Noch keine Beitragshistorie.</small> : null}
              </div>
              <div className="form-row">
                <label>Jahr<input type="number" value={contributionForm.year} onChange={(event) => setContributionForm({ ...contributionForm, year: event.target.value })} /></label>
                <label>Sollbetrag €<input inputMode="decimal" value={contributionForm.amountDue} onChange={(event) => setContributionForm({ ...contributionForm, amountDue: event.target.value })} /></label>
                <label>Bezahlt €<input inputMode="decimal" value={contributionForm.amountPaid} onChange={(event) => setContributionForm({ ...contributionForm, amountPaid: event.target.value })} /></label>
                <label>Status<select value={contributionForm.status} onChange={(event) => setContributionForm({ ...contributionForm, status: event.target.value })}><option value="OPEN">Offen</option><option value="PAID">Bezahlt</option><option value="EXEMPT">Befreit</option><option value="OVERDUE">Überfällig</option></select></label>
              </div>
              <button className="ghost-button" onClick={() => addMemberRecord("CONTRIBUTION", { year: Number(contributionForm.year), amountDueCents: centsFromEuro(contributionForm.amountDue || "0"), amountPaidCents: centsFromEuro(contributionForm.amountPaid || "0"), status: contributionForm.status, isExempt: contributionForm.status === "EXEMPT" })} type="button">Beitrag speichern</button>
            </section>
            ) : null}

            {detailTab === "Arbeitsstunden" ? (
            <section className="detail-section">
              <h3>Arbeitsstunden</h3>
              <p>{editingUser.workHoursDone} von {editingUser.workHoursRequired ?? 0} Stunden angerechnet.</p>
              <div className="linked-player-list">
                {(editingUser.workHourEntries ?? []).map((entry) => <div className="linked-player-card" key={entry.id}><strong>{entry.minutes / 60} Std. · {entry.activity}</strong><small>{dateInputValue(entry.performedAt)}{entry.correctionReason ? ` · Korrektur: ${entry.correctionReason}` : ""}</small></div>)}
              </div>
              <div className="form-row">
                <label>Minuten<input type="number" value={workHourForm.minutes} onChange={(event) => setWorkHourForm({ ...workHourForm, minutes: event.target.value })} /></label>
                <label>Tätigkeit<input value={workHourForm.activity} onChange={(event) => setWorkHourForm({ ...workHourForm, activity: event.target.value })} /></label>
                <label>Datum<input type="date" value={workHourForm.performedAt} onChange={(event) => setWorkHourForm({ ...workHourForm, performedAt: event.target.value })} /></label>
                <label>Korrekturgrund<input value={workHourForm.correctionReason} onChange={(event) => setWorkHourForm({ ...workHourForm, correctionReason: event.target.value })} /></label>
              </div>
              <button className="ghost-button" onClick={() => addMemberRecord("WORK_HOUR", { minutes: Number(workHourForm.minutes), activity: workHourForm.activity, performedAt: workHourForm.performedAt, correctionReason: workHourForm.correctionReason || null })} type="button">Arbeitszeit erfassen</button>
            </section>
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
              <h3>Schlüsselhistorie</h3>
              {(editingUser.keyAssignments ?? []).map((entry) => <div className="linked-player-card" key={entry.id}><strong>{keyOptions[entry.keyType]}{entry.keyNumber ? ` · Nr. ${entry.keyNumber}` : ""}</strong><small>Ausgabe {dateInputValue(entry.issuedAt)}{entry.returnedAt ? ` · Rückgabe ${dateInputValue(entry.returnedAt)}` : " · noch ausgegeben"}</small>{!entry.returnedAt ? <button className="table-action-button" onClick={() => returnMemberKey(entry.id)} type="button">Rückgabe heute</button> : null}</div>)}
              <div className="form-row">
                <label>Neue Schlüsselart<select value={keyRecordForm.keyType} onChange={(event) => setKeyRecordForm({ ...keyRecordForm, keyType: event.target.value as Exclude<KeyType, "NONE"> })}><option value="MAIN_CHANGING_COURTS">Haupttür / Plätze</option><option value="MAIN_CHANGING_COURTS_CLUBROOM">inkl. Gastraum</option></select></label>
                <label>Schlüsselnummer<input value={keyRecordForm.keyNumber} onChange={(event) => setKeyRecordForm({ ...keyRecordForm, keyNumber: event.target.value })} /></label>
                <label>Ausgabe<input type="date" value={keyRecordForm.issuedAt} onChange={(event) => setKeyRecordForm({ ...keyRecordForm, issuedAt: event.target.value })} /></label>
                <label>Pfand €<input value={keyRecordForm.deposit} onChange={(event) => setKeyRecordForm({ ...keyRecordForm, deposit: event.target.value })} /></label>
              </div>
              <button className="ghost-button" onClick={() => addMemberRecord("KEY_ASSIGNMENT", { keyType: keyRecordForm.keyType, keyNumber: keyRecordForm.keyNumber || null, issuedAt: keyRecordForm.issuedAt, depositCents: keyRecordForm.deposit ? centsFromEuro(keyRecordForm.deposit) : null, depositStatus: keyRecordForm.deposit ? "PAID" : "NOT_REQUIRED" })} type="button">Schlüsselausgabe erfassen</button>
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

            {detailTab === "Kommunikation" ? (
            <section className="detail-section">
              <h3>Kommunikation</h3>
              <div className="row-actions"><button className="ghost-button" onClick={() => runMemberAction(editingUser, "invite")} type="button">Einladung senden</button><button className="ghost-button" onClick={() => runMemberAction(editingUser, "password_reset")} type="button">Passwort-Link senden</button></div>
              {(editingUser.memberEmails ?? []).map((entry) => <div className="linked-player-card" key={entry.id}><strong>{entry.kind.replaceAll("_", " ")} · {entry.status}</strong><small>{formatDateTimeLocal(entry.sentAt ?? entry.createdAt)}{entry.error ? ` · ${entry.error}` : ""}</small></div>)}
              {!editingUser.memberEmails?.length ? <small>Noch keine protokollierten Mitglieder-E-Mails.</small> : null}
            </section>
            ) : null}

            {detailTab === "Notizen" ? (
            <section className="detail-section">
              <h3>Adminnotiz</h3>
              <textarea value={userDraft.adminNote ?? ""} onChange={(event) => updateDraft({ adminNote: event.target.value || null })} />
            </section>
            ) : null}

            <div className="detail-panel-actions">
              {permissions.includes("members.write") || permissions.includes("members.sports") ? <button className="button primary" onClick={saveUserDraft} type="button">Speichern</button> : null}
              <button className="ghost-button" onClick={() => setEditingUser(null)} type="button">
                Abbrechen
              </button>
              {permissions.includes("members.write") ? <button
                className="ghost-button danger"
                onClick={() => {
                  if (window.confirm("Mitglied wirklich ablehnen?")) {
                    void runMemberAction(editingUser, "reject");
                  }
                }}
                type="button"
              >
                Mitglied ablehnen
              </button> : null}
              {permissions.includes("members.write") ? <button
                className="ghost-button"
                onClick={() => updateDraft({ membershipType: "EXTERNAL", membershipStatus: "VERIFIED", memberNumber: null })}
                type="button"
              >
                Als Gastspieler markieren
              </button> : null}
              {permissions.includes("members.write") && editingUser.membershipStatus === "PENDING" ? <button className="ghost-button" onClick={() => runMemberAction(editingUser, "approve")} type="button">Mitglied bestätigen</button> : null}
              {permissions.includes("members.write") ? editingUser.lifecycleStatus === "ACTIVE" ? <button className="ghost-button" onClick={() => runMemberAction(editingUser, "pause")} type="button">Pausieren</button> : <button className="ghost-button" onClick={() => runMemberAction(editingUser, "reactivate")} type="button">Reaktivieren</button> : null}
              {permissions.includes("members.write") ? <button className="ghost-button" onClick={() => runMemberAction(editingUser, "resign")} type="button">Austritt erfassen</button> : null}
              {permissions.includes("members.write") ? <button className="ghost-button danger" onClick={() => { if (window.confirm("Mitglied archivieren? Die Daten bleiben revisionssicher erhalten.")) void runMemberAction(editingUser, "archive"); }} type="button">Archivieren</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
