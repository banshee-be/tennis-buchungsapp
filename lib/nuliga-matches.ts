import * as cheerio from "cheerio";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addMinutes, buildUtcDate, timeToMinutes } from "@/lib/time";
import { NULIGA_SOURCE } from "@/lib/nuliga";

export const NULIGA_MATCH_SOURCE_URL = "https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubTeams?club=24835";

type ScheduleLink = {
  teamName: string;
  scheduleUrl: string;
  groupName?: string;
  season?: string | null;
};

type ParsedMatch = {
  season?: string | null;
  date: Date;
  startTime: Date;
  endTime: Date;
  homeTeam: string;
  awayTeam: string;
  opponent: string;
  isHomeMatch: boolean;
  league?: string;
  groupName?: string;
  sourceUrl: string;
  importKey: string;
  importStatus: string;
  blockStatus: string;
  rawData: Prisma.InputJsonObject;
};

export type NuLigaMatchSummary = {
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
    blockStatus: string;
    importStatus: string;
    blockId?: string | null;
    sourceUrl: string;
  }[];
};

export async function getNuLigaMatchSummary(db: PrismaClient = prisma): Promise<NuLigaMatchSummary> {
  const matches = await db.teamMatch.findMany({
    include: { team: true },
    orderBy: [{ startTime: "asc" }, { team: { name: "asc" } }]
  });

  return formatMatchSummary(matches);
}

export async function importNuLigaMatches(db: PrismaClient = prisma): Promise<NuLigaMatchSummary> {
  const warnings: string[] = [];
  const settings = await getSettings();
  const html = await fetchHtml(NULIGA_MATCH_SOURCE_URL);
  const $ = cheerio.load(html);
  const links = extractScheduleLinks($);

  console.info(
    "[nuLiga Spieltage] Gefundene Spielplanlinks:",
    links.map((link) => `${link.teamName} -> ${link.scheduleUrl}`)
  );

  if (!links.length) {
    throw new Error("Keine Spielplanlinks gefunden.");
  }

  const savedMatches = [];

  for (const link of links) {
    try {
      console.info(`[nuLiga Spieltage] Lade Spielplan: ${link.scheduleUrl}`);
      const detailHtml = await fetchHtml(link.scheduleUrl);
      const detail = cheerio.load(detailHtml);
      const season = extractSeason(detail.text()) ?? link.season;
      const teamName = cleanTeamName(link.teamName);
      const team = await findOrCreateTeam(db, teamName, season, link.scheduleUrl);
      const parsedMatches = parseScheduleMatches(detail, link, team.id, settings);

      console.info(`[nuLiga Spieltage] ${teamName}: ${parsedMatches.length} Begegnungen gefunden.`);

      if (!parsedMatches.length && process.env.NODE_ENV !== "production") {
        console.info("[nuLiga Spieltage] Debug Spielplantext:", normalizeText(detail("table").text() || detail("body").text()).slice(0, 500));
      }

      if (!parsedMatches.length) {
        warnings.push(`${teamName}: Keine Begegnungen gefunden.`);
      }

      for (const match of parsedMatches) {
        const existing = await db.teamMatch.findUnique({ where: { importKey: match.importKey }, select: { blockStatus: true, blockId: true } });
        const keepBlockStatus = existing?.blockStatus === "CREATED" || existing?.blockStatus === "SKIPPED";
        const saved = await db.teamMatch.upsert({
          where: { importKey: match.importKey },
          create: {
            teamId: team.id,
            ...match
          },
          update: {
            season: match.season,
            date: match.date,
            startTime: match.startTime,
            endTime: match.endTime,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            opponent: match.opponent,
            isHomeMatch: match.isHomeMatch,
            league: match.league,
            groupName: match.groupName,
            sourceUrl: match.sourceUrl,
            importStatus: match.importStatus,
            blockStatus: keepBlockStatus ? existing.blockStatus : match.blockStatus,
            blockId: existing?.blockId ?? null,
            rawData: match.rawData
          },
          include: { team: true }
        });
        savedMatches.push(saved);
      }
    } catch (error) {
      warnings.push(`${link.teamName}: ${error instanceof Error ? error.message : "Spielplan konnte nicht gelesen werden."}`);
    }
  }

  const summary = await getNuLigaMatchSummary(db);
  return { ...summary, warnings: [...summary.warnings, ...warnings] };
}

export async function createBlocksForMatch(matchId: string, db: PrismaClient = prisma) {
  const match = await db.teamMatch.findUnique({ where: { id: matchId }, include: { team: true } });
  if (!match) {
    throw new Error("Spieltermin nicht gefunden.");
  }
  if (!match.isHomeMatch) {
    throw new Error("Für Auswärtsspiele werden keine Platzsperren erstellt.");
  }
  return createMatchBlocks(match, db);
}

export async function createBlocksForProposedMatches(db: PrismaClient = prisma) {
  const matches = await db.teamMatch.findMany({
    where: { isHomeMatch: true, blockStatus: "PROPOSED" },
    include: { team: true },
    orderBy: { startTime: "asc" }
  });
  const results = [];

  for (const match of matches) {
    try {
      results.push(await createMatchBlocks(match, db));
    } catch (error) {
      results.push({ matchId: match.id, created: 0, warnings: [error instanceof Error ? error.message : "Sperre konnte nicht erstellt werden."] });
    }
  }

  return results;
}

export async function skipMatchBlock(matchId: string, db: PrismaClient = prisma) {
  return db.teamMatch.update({
    where: { id: matchId },
    data: { blockStatus: "SKIPPED" }
  });
}

async function createMatchBlocks(
  match: Prisma.TeamMatchGetPayload<{ include: { team: true } }>,
  db: PrismaClient
) {
  const settings = await getSettings();
  const courtIds = parseCourtIds(settings.matchBlockCourtIds);
  const start = addMinutes(match.startTime, -settings.matchBlockBufferBeforeMinutes);
  const end = addMinutes(match.startTime, settings.matchBlockDurationHours * 60 + settings.matchBlockBufferAfterMinutes);
  const title = `Medenspiel: ${match.team.name} vs. ${match.opponent ?? match.awayTeam}`;
  const reason = "Automatisch aus nuLiga importiertes Heimspiel";
  const warnings: string[] = [];

  const conflictingBooking = await db.booking.findFirst({
    where: {
      courtId: { in: courtIds },
      startTime: { lt: end },
      endTime: { gt: start },
      OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: new Date() } }]
    }
  });

  if (conflictingBooking) {
    await db.teamMatch.update({ where: { id: match.id }, data: { blockStatus: "NEEDS_REVIEW" } });
    throw new Error("Es bestehen bereits Buchungen in diesem Zeitraum.");
  }

  const createdBlockIds: string[] = [];
  for (const courtId of courtIds) {
    const existingBlock = await db.courtBlock.findFirst({
      where: {
        courtId,
        title,
        startTime: { lt: end },
        endTime: { gt: start }
      }
    });

    if (existingBlock) {
      createdBlockIds.push(existingBlock.id);
      continue;
    }

    const block = await db.courtBlock.create({
      data: { courtId, title, reason, startTime: start, endTime: end }
    });
    createdBlockIds.push(block.id);
  }

  await db.teamMatch.update({
    where: { id: match.id },
    data: { blockStatus: "CREATED", blockId: createdBlockIds[0] ?? match.blockId }
  });

  return { matchId: match.id, created: createdBlockIds.length, warnings };
}

async function findOrCreateTeam(db: PrismaClient, name: string, season: string | null | undefined, sourceUrl: string) {
  const existing = await db.team.findFirst({
    where: { source: NULIGA_SOURCE, name, season: season ?? undefined },
    orderBy: { updatedAt: "desc" }
  });

  if (existing) {
    return db.team.update({
      where: { id: existing.id },
      data: { lastImportedAt: new Date() }
    });
  }

  return db.team.upsert({
    where: { source_sourceUrl: { source: NULIGA_SOURCE, sourceUrl } },
    create: { name, season, source: NULIGA_SOURCE, sourceUrl, lastImportedAt: new Date() },
    update: { name, season, lastImportedAt: new Date() }
  });
}

function parseScheduleMatches($: cheerio.CheerioAPI, link: ScheduleLink, teamId: string, settings: Awaited<ReturnType<typeof getSettings>>) {
  const matches = new Map<string, ParsedMatch>();
  let currentDate = "";
  let currentMinutes = safeTimeToMinutes(settings.matchBlockDefaultStartTime);
  const season = extractSeason($.text()) ?? link.season;

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("th, td")
      .map((__, cell) => normalizeText($(cell).text()))
      .get();

    if (cells.length < 5 || cells.some((cell) => /Heimmannschaft|Gastmannschaft|Spielbericht/i.test(cell))) {
      return;
    }

    const dateTime = parseGermanDateTime(cells[1]);
    if (dateTime) {
      currentDate = dateTime.date;
      currentMinutes = dateTime.minutes ?? currentMinutes;
    }

    const homeTeam = cells[3];
    const awayTeam = cells[4];

    if (!currentDate || !homeTeam || !awayTeam || homeTeam === "-" || awayTeam === "-") {
      return;
    }

    const startTime = buildUtcDate(currentDate, currentMinutes);
    const endTime = addMinutes(startTime, settings.matchBlockDurationHours * 60);
    const isHomeMatch = isEuropabadTeam(homeTeam);
    const mentionsClub = isHomeMatch || isEuropabadTeam(awayTeam);
    const opponent = isHomeMatch ? awayTeam : homeTeam;
    const importStatus = mentionsClub ? "IMPORTED" : "NEEDS_REVIEW";
    const blockStatus = isHomeMatch ? "PROPOSED" : mentionsClub ? "NONE" : "NEEDS_REVIEW";
    const importKey = makeMatchImportKey(teamId, currentDate, currentMinutes, homeTeam, awayTeam);

    matches.set(importKey, {
      season,
      date: startTime,
      startTime,
      endTime,
      homeTeam,
      awayTeam,
      opponent,
      isHomeMatch,
      league: link.groupName,
      groupName: link.groupName,
      sourceUrl: link.scheduleUrl,
      importKey,
      importStatus,
      blockStatus,
      rawData: { cells, source: "nuLiga groupPage" }
    });
  });

  return Array.from(matches.values());
}

function extractScheduleLinks($: cheerio.CheerioAPI) {
  const links = new Map<string, ScheduleLink>();
  const pageSeason = extractSeason($.text());

  $("tr").each((_, row) => {
    const anchors = $(row)
      .find("a[href]")
      .map((__, anchor) => ({
        text: normalizeText($(anchor).text()),
        href: String($(anchor).attr("href") ?? "")
      }))
      .get();
    const teamAnchor = anchors.find((anchor) => /teamPortrait/i.test(anchor.href));
    const groupAnchor = anchors.find((anchor) => /groupPage/i.test(anchor.href));

    if (!teamAnchor || !groupAnchor || !teamAnchor.text || !groupAnchor.href) {
      return;
    }

    try {
      const scheduleUrl = new URL(groupAnchor.href, NULIGA_MATCH_SOURCE_URL).toString();
      links.set(scheduleUrl, {
        teamName: cleanTeamName(teamAnchor.text),
        scheduleUrl,
        groupName: groupAnchor.text,
        season: pageSeason
      });
    } catch {
      // Unlesbare nuLiga-Links werden ignoriert.
    }
  });

  return Array.from(links.values());
}

function formatMatchSummary(matches: Prisma.TeamMatchGetPayload<{ include: { team: true } }>[]): NuLigaMatchSummary {
  const teams = new Map<string, NuLigaMatchSummary["teams"][number]>();
  let lastImportedAt = 0;

  for (const match of matches) {
    const existing = teams.get(match.teamId) ?? {
      id: match.teamId,
      name: match.team.name,
      season: match.team.season,
      matchCount: 0,
      homeMatchCount: 0
    };
    existing.matchCount += 1;
    existing.homeMatchCount += match.isHomeMatch ? 1 : 0;
    teams.set(match.teamId, existing);
    lastImportedAt = Math.max(lastImportedAt, match.updatedAt.getTime());
  }

  return {
    sourceUrl: NULIGA_MATCH_SOURCE_URL,
    lastImportedAt: lastImportedAt ? new Date(lastImportedAt).toISOString() : null,
    importedTeams: teams.size,
    importedMatches: matches.length,
    homeMatches: matches.filter((match) => match.isHomeMatch).length,
    proposedBlocks: matches.filter((match) => match.blockStatus === "PROPOSED").length,
    createdBlocks: matches.filter((match) => match.blockStatus === "CREATED").length,
    needsReview: matches.filter((match) => match.blockStatus === "NEEDS_REVIEW").length,
    warnings: [],
    teams: Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name, "de")),
    matches: matches.map((match) => ({
      id: match.id,
      teamName: match.team.name,
      season: match.season,
      date: match.date.toISOString(),
      startTime: match.startTime.toISOString(),
      endTime: match.endTime?.toISOString() ?? null,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      opponent: match.opponent,
      isHomeMatch: match.isHomeMatch,
      league: match.league,
      groupName: match.groupName,
      blockStatus: match.blockStatus,
      importStatus: match.importStatus,
      blockId: match.blockId,
      sourceUrl: match.sourceUrl
    }))
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "TV Europabad Marbach Buchungsapp/1.0" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("nuLiga konnte nicht erreicht werden.");
  }

  return response.text();
}

function parseGermanDateTime(value: string) {
  const match = normalizeText(value).match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/);
  if (!match) {
    return null;
  }
  const [, day, month, year, time] = match;
  return {
    date: `${year}-${month}-${day}`,
    minutes: time ? safeTimeToMinutes(time) : undefined
  };
}

function safeTimeToMinutes(value: string) {
  try {
    return timeToMinutes(value);
  } catch {
    return 9 * 60;
  }
}

function isEuropabadTeam(value: string) {
  const text = slug(value);
  return text.includes("tv-europabad-marb") || text.includes("europabad-marbach") || text.includes("europabad-marb");
}

function makeMatchImportKey(teamId: string, date: string, minutes: number, homeTeam: string, awayTeam: string) {
  return `team:${teamId}:match:${date}:${minutes}:${slug(homeTeam)}:${slug(awayTeam)}`;
}

function parseCourtIds(value: string) {
  const ids = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  return ids.length ? ids : [1, 2, 3, 4];
}

function extractSeason(text: string) {
  const normalized = normalizeText(text);
  const full = normalized.match(/\b(?:Sommer|Winter)\s+\d{4}\b/i)?.[0];
  if (full) return full;
  const championship = normalized.match(/Medenrunde\s+(\d{4})/i)?.[1];
  return championship ? `Sommer ${championship}` : normalized.match(/\b20\d{2}\b/)?.[0] ?? null;
}

function cleanTeamName(value: string) {
  return normalizeText(value)
    .replace(/\s*\(4er\)\s*MSG$/i, "")
    .replace(/\s*\(4er\)$/i, "")
    .replace(/\s+MSG$/i, "")
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
