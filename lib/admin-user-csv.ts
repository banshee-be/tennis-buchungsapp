import type { ContractType, KeyType } from "@prisma/client";

export const csvHeaders = [
  "Name",
  "E-Mail",
  "Telefonnummer",
  "Mitgliedsnummer",
  "Kontotyp",
  "Mitgliedsstatus",
  "Rolle",
  "Vertragsstatus",
  "Vertragsbeginn",
  "Vertragsende",
  "Arbeitsstunden erforderlich",
  "Arbeitsstunden erledigt",
  "Schlüsselart",
  "Schlüsselausgabe",
  "Schlüsselrückgabe",
  "Mannschaft"
];

export type CsvImportUser = {
  name: string;
  email?: string;
  phoneNumber?: string | null;
  memberNumber?: string | null;
  membershipType: "MEMBER" | "EXTERNAL";
  membershipStatus: "PENDING" | "VERIFIED" | "REJECTED";
  role: "USER" | "ADMIN";
  contractType: ContractType;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  workHoursRequired?: number | null;
  workHoursDone?: number;
  keyType: KeyType;
  keyIssuedAt?: string | null;
  keyReturnedAt?: string | null;
};

export type CsvPreview = {
  rows: CsvImportUser[];
  rowCount: number;
  newUsers: number;
  updateUsers: number;
  errors: string[];
  warnings: string[];
};

const membershipTypeMap = new Map([
  ["mitglied", "MEMBER"],
  ["member", "MEMBER"],
  ["gastspieler", "EXTERNAL"],
  ["external", "EXTERNAL"]
]);

const membershipStatusMap = new Map([
  ["in pruefung", "PENDING"],
  ["in prüfung", "PENDING"],
  ["pending", "PENDING"],
  ["bestaetigt", "VERIFIED"],
  ["bestätigt", "VERIFIED"],
  ["verified", "VERIFIED"],
  ["abgelehnt", "REJECTED"],
  ["rejected", "REJECTED"]
]);

const contractMap = new Map([
  ["vollmitglied", "FULL_MEMBER"],
  ["full_member", "FULL_MEMBER"],
  ["familienmitglied", "FAMILY_MEMBER"],
  ["family_member", "FAMILY_MEMBER"],
  ["passivmitglied", "PASSIVE_MEMBER"],
  ["passive_member", "PASSIVE_MEMBER"],
  ["jugend", "YOUTH_MEMBER"],
  ["jugend bis 18 jahre", "YOUTH_MEMBER"],
  ["youth_member", "YOUTH_MEMBER"],
  ["saisonkarte", "SEASON_CARD"],
  ["season_card", "SEASON_CARD"],
  ["nicht festgelegt", "NONE"],
  ["none", "NONE"],
  ["", "NONE"]
]);

const keyMap = new Map([
  ["kein schluessel", "NONE"],
  ["kein schlüssel", "NONE"],
  ["none", "NONE"],
  ["", "NONE"],
  ["haupttuer / umkleide / plaetze", "MAIN_CHANGING_COURTS"],
  ["haupttür / umkleide / plätze", "MAIN_CHANGING_COURTS"],
  ["main_changing_courts", "MAIN_CHANGING_COURTS"],
  ["haupttuer / umkleide / plaetze & gastraum", "MAIN_CHANGING_COURTS_CLUBROOM"],
  ["haupttür / umkleide / plätze & gastraum", "MAIN_CHANGING_COURTS_CLUBROOM"],
  ["main_changing_courts_clubroom", "MAIN_CHANGING_COURTS_CLUBROOM"]
]);

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  return rows;
}

export function parseImportRows(text: string, existingKeys: Set<string>) {
  const csv = parseCsv(text);
  const [headers = [], ...rows] = csv;
  const normalizedHeaders = headers.map(normalizeKey);
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedRows: CsvImportUser[] = [];
  let newUsers = 0;
  let updateUsers = 0;

  rows.forEach((values, index) => {
    const line = index + 2;
    const get = (header: string) => values[normalizedHeaders.indexOf(normalizeKey(header))]?.trim() ?? "";
    const email = get("E-Mail").toLowerCase();
    const memberNumber = get("Mitgliedsnummer");
    const name = get("Name");

    if (!email && !memberNumber) {
      errors.push(`Zeile ${line}: E-Mail-Adresse oder Mitgliedsnummer fehlt.`);
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Zeile ${line}: E-Mail-Adresse ist ungültig.`);
      return;
    }
    if (!name) {
      errors.push(`Zeile ${line}: Name fehlt.`);
      return;
    }

    const membershipType = readMappedValue(get("Kontotyp"), membershipTypeMap, `Zeile ${line}: Kontotyp ist unbekannt.`, errors) as
      | "MEMBER"
      | "EXTERNAL"
      | undefined;
    const membershipStatus = readMappedValue(
      get("Mitgliedsstatus"),
      membershipStatusMap,
      `Zeile ${line}: Mitgliedsstatus ist unbekannt.`,
      errors
    ) as "PENDING" | "VERIFIED" | "REJECTED" | undefined;
    const contractType = readMappedValue(get("Vertragsstatus"), contractMap, `Zeile ${line}: Vertragsstatus ist unbekannt.`, errors) as
      | ContractType
      | undefined;
    const keyType = readMappedValue(get("Schlüsselart"), keyMap, `Zeile ${line}: Schlüsselart ist unbekannt.`, errors) as KeyType | undefined;
    const role = normalizeText(get("Rolle")) === "admin" ? "ADMIN" : "USER";

    parsedRows.push({
      name,
      email,
      phoneNumber: get("Telefonnummer") || null,
      memberNumber: memberNumber || null,
      membershipType: membershipType ?? "MEMBER",
      membershipStatus: membershipStatus ?? "PENDING",
      role,
      contractType: contractType ?? "NONE",
      contractStartDate: get("Vertragsbeginn") || null,
      contractEndDate: get("Vertragsende") || null,
      workHoursRequired: optionalNumber(get("Arbeitsstunden erforderlich")),
      workHoursDone: optionalNumber(get("Arbeitsstunden erledigt")) ?? 0,
      keyType: keyType ?? "NONE",
      keyIssuedAt: get("Schlüsselausgabe") || null,
      keyReturnedAt: get("Schlüsselrückgabe") || null
    });

    if (existingKeys.has(email) || (memberNumber && existingKeys.has(`member:${memberNumber}`))) {
      updateUsers += 1;
    } else {
      newUsers += 1;
      warnings.push(`Zeile ${line}: Neuer Nutzer wird ohne Passwort angelegt.`);
    }
  });

  return { rows: parsedRows, rowCount: rows.length, newUsers, updateUsers, errors, warnings };
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function csvTemplate() {
  return toCsv([
    csvHeaders,
    [
      "Max Mustermann",
      "max@example.de",
      "",
      "1234",
      "Mitglied",
      "In Prüfung",
      "Nutzer",
      "Vollmitglied",
      "2026-01-01",
      "",
      "6",
      "0",
      "Kein Schlüssel",
      "",
      "",
      "Herren"
    ]
  ]);
}

function readMappedValue(value: string, map: Map<string, string>, error: string, errors: string[]) {
  const key = normalizeText(value);
  const mapped = map.get(key);
  if (!mapped) {
    errors.push(error);
  }
  return mapped;
}

function optionalNumber(value: string) {
  if (!value) {
    return null;
  }
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
