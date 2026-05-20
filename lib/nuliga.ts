import * as cheerio from "cheerio";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Element } from "domhandler";
import { prisma } from "@/lib/prisma";

export const NULIGA_SOURCE = "nuLiga";
export const NULIGA_CLUB_URL = "https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubPools?club=24835";

type TeamLink = {
  name: string;
  url: string;
  externalId?: string;
};

type ParsedPlayer = {
  rank?: number;
  position?: string;
  teamPosition?: string;
  lk?: string;
  nuLigaId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  birthYear?: number;
  nation?: string;
  licenseNumber?: string;
  info?: string;
  msg?: string;
  isCaptain: boolean;
  sourceUrl: string;
  rawData: Prisma.InputJsonObject;
};

export type NuLigaImportSummary = {
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

export async function getNuLigaSummary(db: PrismaClient = prisma): Promise<NuLigaImportSummary> {
  const teams = await db.team.findMany({
    where: { source: NULIGA_SOURCE },
    orderBy: { name: "asc" },
    include: { players: { where: { isActive: true } } }
  });

  const lastImportedAt = teams
    .map((team) => team.lastImportedAt?.getTime() ?? 0)
    .reduce((latest, value) => Math.max(latest, value), 0);

  return {
    sourceUrl: NULIGA_CLUB_URL,
    season: teams.find((team) => team.season)?.season ?? null,
    lastImportedAt: lastImportedAt ? new Date(lastImportedAt).toISOString() : null,
    importedTeams: teams.length,
    importedPlayers: teams.reduce((sum, team) => sum + team.players.length, 0),
    createdPlayers: 0,
    updatedPlayers: 0,
    skippedPlayers: 0,
    warnings: [],
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      season: team.season,
      playerCount: team.players.length,
      captainCount: team.players.filter((player) => player.isCaptain).length,
      lastImportedAt: team.lastImportedAt?.toISOString() ?? null
    }))
  };
}

export async function importNuLigaClubData(db: PrismaClient = prisma): Promise<NuLigaImportSummary> {
  const warnings: string[] = [];
  const clubHtml = await fetchHtml(NULIGA_CLUB_URL);
  const $ = cheerio.load(clubHtml);
  const season = extractSeason($.text());
  const teamLinks = extractTeamLinks($);

  console.info(
    "[nuLiga] Gefundene Mannschaftslinks:",
    teamLinks.map((link) => `${link.name} -> ${link.url}`)
  );

  if (!teamLinks.length) {
    throw new Error("Keine Mannschaften gefunden.");
  }

  const importedTeams: NuLigaImportSummary["teams"] = [];
  let importedPlayers = 0;
  let createdPlayers = 0;
  let updatedPlayers = 0;
  let skippedPlayers = 0;

  for (const link of teamLinks) {
    try {
      console.info(`[nuLiga] Lade Detailseite: ${link.url}`);
      const detailHtml = await fetchHtml(link.url);
      const detail = cheerio.load(detailHtml);
      const teamName = extractTeamName(detail, link.name);
      const teamSeason = extractSeason(detail.text()) ?? season;
      const players = parsePlayers(detail, link.url);
      const now = new Date();

      console.info(`[nuLiga] ${teamName}: ${players.length} Spieler gefunden.`);

      if (!players.length && process.env.NODE_ENV !== "production") {
        console.info("[nuLiga] Debug Detailtext:", relevantPageText(detail).slice(0, 500));
      }

      const team = await db.team.upsert({
        where: { source_sourceUrl: { source: NULIGA_SOURCE, sourceUrl: link.url } },
        create: {
          name: teamName,
          season: teamSeason,
          source: NULIGA_SOURCE,
          sourceUrl: link.url,
          externalId: link.externalId,
          lastImportedAt: now
        },
        update: {
          name: teamName,
          season: teamSeason,
          externalId: link.externalId,
          lastImportedAt: now
        }
      });

      await db.teamPlayer.updateMany({
        where: { teamId: team.id },
        data: { isActive: false, lastImportedAt: now }
      });

      for (const player of players) {
        const importKey = makeImportKey(team.id, player);
        const exists = await db.teamPlayer.findUnique({ where: { importKey }, select: { id: true } });
        await db.teamPlayer.upsert({
          where: { importKey },
          create: {
            teamId: team.id,
            rank: player.rank,
            position: player.position,
            teamPosition: player.teamPosition,
            lk: player.lk,
            nuLigaId: player.nuLigaId,
            firstName: player.firstName,
            lastName: player.lastName,
            fullName: player.fullName,
            birthYear: player.birthYear,
            nation: player.nation,
            licenseNumber: player.licenseNumber,
            info: player.info,
            msg: player.msg,
            isCaptain: player.isCaptain,
            isActive: true,
            sourceUrl: player.sourceUrl,
            importKey,
            rawData: player.rawData,
            lastImportedAt: now
          },
          update: {
            rank: player.rank,
            position: player.position,
            teamPosition: player.teamPosition,
            lk: player.lk,
            nuLigaId: player.nuLigaId,
            firstName: player.firstName,
            lastName: player.lastName,
            fullName: player.fullName,
            birthYear: player.birthYear,
            nation: player.nation,
            licenseNumber: player.licenseNumber,
            info: player.info,
            msg: player.msg,
            isCaptain: player.isCaptain,
            isActive: true,
            sourceUrl: player.sourceUrl,
            rawData: player.rawData,
            lastImportedAt: now
          }
        });
        if (exists) {
          updatedPlayers += 1;
        } else {
          createdPlayers += 1;
        }
      }
      skippedPlayers += Math.max(0, players.length - new Set(players.map((player) => makeImportKey(team.id, player))).size);

      importedPlayers += players.length;
      importedTeams.push({
        id: team.id,
        name: team.name,
        season: team.season,
        playerCount: players.length,
        captainCount: players.filter((player) => player.isCaptain).length,
        lastImportedAt: now.toISOString()
      });

      if (!players.length) {
        warnings.push(`Für ${team.name} wurden keine Spieler gefunden.`);
      }
    } catch (error) {
      warnings.push(`${link.name}: ${error instanceof Error ? error.message : "Daten konnten nicht gelesen werden."}`);
    }
  }

  if (!importedTeams.length) {
    throw new Error(warnings[0] ?? "nuLiga konnte nicht erreicht werden.");
  }

  const lastImportedAt = importedTeams
    .map((team) => (team.lastImportedAt ? new Date(team.lastImportedAt).getTime() : 0))
    .reduce((latest, value) => Math.max(latest, value), 0);

  return {
    sourceUrl: NULIGA_CLUB_URL,
    season: importedTeams.find((team) => team.season)?.season ?? season ?? null,
    lastImportedAt: lastImportedAt ? new Date(lastImportedAt).toISOString() : null,
    importedTeams: importedTeams.length,
    importedPlayers,
    createdPlayers,
    updatedPlayers,
    skippedPlayers,
    warnings,
    teams: importedTeams
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "TV Europabad Marbach Buchungsapp/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("nuLiga konnte nicht erreicht werden.");
  }

  return response.text();
}

function extractSeason(text: string) {
  return normalizeText(text).match(/\b(?:Sommer|Winter)\s+\d{4}\b/i)?.[0] ?? normalizeText(text).match(/\b20\d{2}\b/)?.[0] ?? null;
}

function extractTeamName($: cheerio.CheerioAPI, fallback: string) {
  const heading = $("h1, h2, h3")
    .map((_, element) => normalizeText($(element).text()))
    .get()
    .find((text) => looksLikeTeamName(text));
  return cleanTeamName(heading ?? fallback);
}

function extractTeamLinks($: cheerio.CheerioAPI) {
  const links = new Map<string, TeamLink>();

  $("a[href]").each((_, element) => {
    const text = normalizeText($(element).text());
    const href = String($(element).attr("href") ?? "");
    if (!text || !href || !looksLikeTeamName(text)) {
      return;
    }

    let url: string;
    try {
      url = new URL(href, NULIGA_CLUB_URL).toString();
    } catch {
      return;
    }

    if (url === NULIGA_CLUB_URL || /mailto:|javascript:/i.test(url)) {
      return;
    }

    links.set(url, {
      name: cleanTeamName(text),
      url,
      externalId: extractExternalId(url)
    });
  });

  return Array.from(links.values());
}

function parsePlayers($: cheerio.CheerioAPI, sourceUrl: string) {
  const players = new Map<string, ParsedPlayer>();

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("th, td")
      .map((__, cell) => normalizeText($(cell).text()))
      .get()
      .filter(Boolean);

    if (cells.length < 2 || cells.some((cell) => /^name$/i.test(cell))) {
      return;
    }

    const player = parsePlayerCells($, row, cells, sourceUrl);
    if (player) {
      players.set(`${player.fullName}-${player.birthYear ?? ""}-${player.licenseNumber ?? player.nuLigaId ?? ""}`, player);
    }
  });

  for (const player of parsePlayersFromText(relevantPageText($), sourceUrl)) {
    players.set(`${player.fullName}-${player.birthYear ?? ""}-${player.licenseNumber ?? player.nuLigaId ?? ""}`, player);
  }

  return Array.from(players.values());
}

function parsePlayerCells($: cheerio.CheerioAPI, row: Element, cells: string[], sourceUrl: string): ParsedPlayer | null {
  const rowText = normalizeText(cells.join(" "));
  const nameIndex = cells.findIndex((cell) => looksLikePersonName(cell));
  const nameCell = nameIndex >= 0 ? cells[nameIndex] : "";

  if (!nameCell || !/\bLK\s*\d{1,2}(?:[,.]\d)?\b/i.test(rowText) || /verein|termin|begegnung|tabelle/i.test(rowText)) {
    return null;
  }

  const name = splitName(nameCell);
  if (!name) {
    return null;
  }

  const firstCellNumber = Number(cells[0]?.replace(".", ""));
  const rank = Number.isInteger(firstCellNumber) && firstCellNumber > 0 && firstCellNumber < 200 ? firstCellNumber : undefined;
  const position = /^\d+$/.test(cells[1] ?? "") ? cells[1] : rank ? String(rank) : cells[0];
  const lk = rowText.match(/\bLK\s*\d{1,2}(?:[,.]\d)?\b/i)?.[0] ?? cells.find((cell) => /^\d{1,2}[,.]\d$/.test(cell));
  const birthYear = Number(nameCell.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? rowText.match(/\b(?:19|20)\d{2}\b/)?.[0]) || undefined;
  const numericCells = cells.map((cell) => cell.match(/^\d{5,}$/)?.[0] ?? "").filter(Boolean);
  const nuLigaId = cells[3]?.match(/^\d{5,}$/)?.[0] ?? numericCells[0];
  const licenseNumber =
    cells
      .slice(nameIndex + 1)
      .map((cell) => cell.match(/^\d{5,}$/)?.[0] ?? "")
      .find(Boolean) ?? numericCells.find((value) => value !== nuLigaId);
  const href = $(row).find("a[href]").first().attr("href") ?? "";
  const nation = cells[nameIndex + 1] && !/^\d{5,}$/.test(cells[nameIndex + 1]) ? cells[nameIndex + 1] : undefined;
  const info = cells.at(-3) && !/^(MSG|MF)$/i.test(cells.at(-3) ?? "") ? cells.at(-3) : undefined;
  const msg = cells.find((cell) => /^MSG$/i.test(cell));

  return {
    rank,
    position,
    teamPosition: position,
    lk,
    nuLigaId: nuLigaId ?? href.match(/[?&](?:person|spieler|id)=([^&]+)/i)?.[1],
    firstName: name.firstName,
    lastName: name.lastName,
    fullName: name.fullName,
    birthYear,
    nation,
    licenseNumber,
    info,
    msg,
    isCaptain: /\bMF\b|Mannschaftsf(?:ü|ue)hrer/i.test(rowText),
    sourceUrl,
    rawData: { cells, rowText, href }
  };
}

function parsePlayersFromText(text: string, sourceUrl: string) {
  const players: ParsedPlayer[] = [];
  const normalized = normalizeText(text);
  const playerPattern =
    /(?:^|\s)(\d{1,3})\s+(\d{1,2})\s+(LK\s*\d{1,2}[,.]\d)\s+(\d{5,})\s+([^,\d()]+),\s+([^()]+?)\s+\(((?:19|20)\d{2})\)\s+(\d{5,})(?:\s+((?:MSG|MF)(?:\s+(?:MSG|MF))*))?(?=\s+\d{1,3}\s+\d{1,2}\s+LK|$)/gi;

  for (const match of normalized.matchAll(playerPattern)) {
    const [, rank, position, lk, nuLigaId, lastName, firstName, birthYear, licenseNumber, flags = ""] = match;
    const cleanFirstName = normalizeText(firstName);
    const cleanLastName = normalizeText(lastName);

    players.push({
      rank: Number(rank),
      position,
      teamPosition: position,
      lk: normalizeText(lk),
      nuLigaId,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      fullName: `${cleanFirstName} ${cleanLastName}`,
      birthYear: Number(birthYear),
      licenseNumber,
      msg: /\bMSG\b/i.test(flags) ? "MSG" : undefined,
      isCaptain: /\bMF\b/i.test(flags),
      sourceUrl,
      rawData: { source: "text-fallback", line: match[0].trim(), flags }
    });
  }

  return players;
}

function splitName(value: string) {
  const cleaned = value
    .replace(/\bCLOSE\b/g, "")
    .replace(/\bMF\b/g, "")
    .replace(/\bLK\s*\d{1,2}(?:[,.]\d)?\b/gi, "")
    .replace(/\((?:19|20)\d{2}\)/g, "")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\b\d{5,}\b/g, "")
    .trim();

  if (cleaned.includes(",")) {
    const [lastName, firstName] = cleaned.split(",").map((part) => normalizeText(part));
    if (firstName && lastName) {
      return { firstName, lastName, fullName: `${firstName} ${lastName}` };
    }
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const lastName = parts.at(-1);
  const firstName = parts.slice(0, -1).join(" ");

  if (!firstName || !lastName) {
    return null;
  }

  return { firstName, lastName, fullName: `${firstName} ${lastName}` };
}

function makeImportKey(teamId: string, player: ParsedPlayer) {
  if (player.nuLigaId) {
    return `team:${teamId}:nuliga:${player.nuLigaId}`;
  }
  if (player.licenseNumber) {
    return `team:${teamId}:license:${player.licenseNumber}`;
  }
  return `team:${teamId}:${slug(player.fullName)}:${player.birthYear ?? "unknown"}`;
}

function extractExternalId(url: string) {
  return new URL(url).searchParams.get("team") ?? new URL(url).searchParams.get("club") ?? undefined;
}

function looksLikeTeamName(value: string) {
  return /^(Damen|Herren|Juniorinnen|Junioren|Gemischt|U\s?\d+|Midcourt|Kleinfeld)(?:\s|$)/i.test(cleanTeamName(value));
}

function looksLikePersonName(value: string) {
  const text = normalizeText(value);
  const withoutBirthYear = text.replace(/\((?:19|20)\d{2}\)/g, "");
  if (withoutBirthYear.length < 5 || withoutBirthYear.length > 90 || /\d{4,}|LK|Mannschaft|Verein|Tabelle|Termin/i.test(withoutBirthYear)) {
    return false;
  }
  return withoutBirthYear.includes(",") || withoutBirthYear.split(/\s+/).length >= 2;
}

function relevantPageText($: cheerio.CheerioAPI) {
  return normalizeText($("table").text() || $("body").text());
}

function cleanTeamName(value: string) {
  return normalizeText(value)
    .replace(/\s+\(\d+\)$/g, "")
    .replace(/\s+Mannschaftsmeldung.*$/i, "")
    .trim();
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
