import { NextResponse } from "next/server";
import { toCsv } from "@/lib/admin-user-csv";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

const contractLabels: Record<string, string> = {
  FULL_MEMBER: "Vollmitglied",
  FAMILY_MEMBER: "Familienmitglied",
  PASSIVE_MEMBER: "Passivmitglied",
  YOUTH_MEMBER: "Jugend bis 18 Jahre",
  SEASON_CARD: "Saisonkarte",
  NONE: "Nicht festgelegt"
};

const keyLabels: Record<string, string> = {
  NONE: "Kein Schlüssel",
  MAIN_CHANGING_COURTS: "Haupttür / Umkleide / Plätze",
  MAIN_CHANGING_COURTS_CLUBROOM: "Haupttür / Umkleide / Plätze & Gastraum"
};

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("members.export");
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] }, endTime: { gt: new Date() } }, select: { id: true } },
        teamPlayer: { include: { team: true } },
        teamPlayerLinks: { include: { teamPlayer: { include: { team: true } } } }
      }
    });

    const csv = toCsv([
      [
        "Name",
        "E-Mail",
        "Telefonnummer",
        "Geburtsdatum",
        "Straße",
        "Adresszusatz",
        "PLZ",
        "Ort",
        "Land",
        "Notfallkontakt",
        "Notfall-Telefon",
        "Mitgliedsnummer",
        "Kontotyp",
        "Mitgliedsstatus",
        "Lebenszyklus",
        "Eintritt",
        "Austritt",
        "Austrittsgrund",
        "Rolle",
        "Vertragsstatus",
        "Beitrag",
        "Arbeitsstunden erforderlich",
        "Arbeitsstunden erledigt",
        "Vertragsbeginn",
        "Vertragsende",
        "Schlüsselstatus",
        "Schlüsselart",
        "Schlüsselausgabe",
        "Schlüsselrückgabe",
        "Mannschaften",
        "nuLiga-Spieler verknüpft",
        "nuLiga-ID",
        "Lizenznummer",
        "Mannschaftsführer",
        "Anzahl aktiver Buchungen",
        "Registriert am",
        "Letzte Änderung",
        "Aktiv/Inaktiv"
      ],
      ...users.map((user) => {
        const linkedPlayers = user.teamPlayerLinks.length
          ? user.teamPlayerLinks.map((link) => link.teamPlayer)
          : user.teamPlayer
            ? [user.teamPlayer]
            : [];
        return [
        user.name,
        user.email,
        user.phoneNumber ?? "",
        user.birthDate?.toISOString().slice(0, 10) ?? "",
        user.street ?? "",
        user.addressAdditional ?? "",
        user.postalCode ?? "",
        user.city ?? "",
        user.country,
        user.emergencyContactName ?? "",
        user.emergencyContactPhone ?? "",
        user.memberNumber ?? "",
        user.membershipType === "MEMBER" ? "Mitglied" : "Gastspieler",
        user.membershipStatus,
        user.lifecycleStatus,
        user.joinedAt?.toISOString().slice(0, 10) ?? "",
        user.leftAt?.toISOString().slice(0, 10) ?? "",
        user.resignationReason ?? "",
        user.role,
        contractLabels[user.contractType],
        user.annualFeeCents === null || user.annualFeeCents === undefined ? "" : String(user.annualFeeCents / 100),
        user.workHoursRequired ?? "",
        user.workHoursDone,
        user.contractStartDate?.toISOString().slice(0, 10) ?? "",
        user.contractEndDate?.toISOString().slice(0, 10) ?? "",
        user.hasKey ? "Mit Schlüssel" : "Ohne Schlüssel",
        keyLabels[user.keyType],
        user.keyIssuedAt?.toISOString().slice(0, 10) ?? "",
        user.keyReturnedAt?.toISOString().slice(0, 10) ?? "",
        Array.from(new Set(linkedPlayers.map((player) => player.team.name))).join("; "),
        linkedPlayers.map((player) => player.fullName).join("; "),
        linkedPlayers.map((player) => `${player.team.name}: ${player.nuLigaId ?? ""}`).filter((value) => !value.endsWith(": ")).join("; "),
        linkedPlayers.map((player) => `${player.team.name}: ${player.licenseNumber ?? ""}`).filter((value) => !value.endsWith(": ")).join("; "),
        linkedPlayers.map((player) => `${player.team.name}: ${player.isCaptain ? "Ja" : "Nein"}`).join("; "),
        user.bookings.length,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString(),
        user.isActive ? "Aktiv" : "Inaktiv"
        ];
      })
    ]);

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="mitglieder-tv-europabad-marbach-${date}.csv"`
      }
    });
  });
}
