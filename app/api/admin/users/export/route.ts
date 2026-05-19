import { NextResponse } from "next/server";
import { toCsv } from "@/lib/admin-user-csv";
import { handleRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

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
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] }, endTime: { gt: new Date() } }, select: { id: true } },
        teamPlayer: { include: { team: true } }
      }
    });

    const csv = toCsv([
      [
        "Name",
        "E-Mail",
        "Telefonnummer",
        "Mitgliedsnummer",
        "Kontotyp",
        "Mitgliedsstatus",
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
      ...users.map((user) => [
        user.name,
        user.email,
        user.phoneNumber ?? "",
        user.memberNumber ?? "",
        user.membershipType === "MEMBER" ? "Mitglied" : "Gastspieler",
        user.membershipStatus,
        user.role === "ADMIN" ? "Admin" : "Nutzer",
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
        user.teamPlayer?.team.name ?? "",
        user.teamPlayer?.fullName ?? "",
        user.teamPlayer?.nuLigaId ?? "",
        user.teamPlayer?.licenseNumber ?? "",
        user.teamPlayer?.isCaptain ? "Ja" : "Nein",
        user.bookings.length,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString(),
        user.isActive ? "Aktiv" : "Inaktiv"
      ])
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
