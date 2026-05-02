import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const settings = await getSettings();
    return NextResponse.json({ settings });
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as
      | {
          externalHourlyRateCents?: number;
          openingHour?: number;
          closingHour?: number;
          slotDurationMinutes?: number;
          maxBookingDurationMinutes?: number;
          cancellationRules?: string;
        }
      | null;

    if (!body) {
      return jsonError("Keine Einstellungen angegeben.");
    }

    const openingHour = Number(body.openingHour);
    const closingHour = Number(body.closingHour);
    const slotDurationMinutes = Number(body.slotDurationMinutes);
    const maxBookingDurationMinutes = Number(body.maxBookingDurationMinutes);
    const externalHourlyRateCents = Number(body.externalHourlyRateCents);

    if (
      !Number.isInteger(openingHour) ||
      !Number.isInteger(closingHour) ||
      openingHour < 0 ||
      closingHour > 24 ||
      openingHour >= closingHour
    ) {
      return jsonError("Bitte gueltige Oeffnungszeiten eintragen.");
    }

    if (![15, 30, 60].includes(slotDurationMinutes)) {
      return jsonError("Zeitfenster muessen 15, 30 oder 60 Minuten lang sein.");
    }

    if (maxBookingDurationMinutes < slotDurationMinutes || maxBookingDurationMinutes > 480) {
      return jsonError("Die maximale Buchungsdauer muss zwischen Slotdauer und 480 Minuten liegen.");
    }

    if (externalHourlyRateCents < 0) {
      return jsonError("Der Preis darf nicht negativ sein.");
    }

    const settings = await prisma.settings.update({
      where: { id: "default" },
      data: {
        externalHourlyRateCents,
        openingHour,
        closingHour,
        slotDurationMinutes,
        maxBookingDurationMinutes,
        cancellationRules: body.cancellationRules?.trim() || undefined
      }
    });

    return NextResponse.json({ settings });
  });
}
