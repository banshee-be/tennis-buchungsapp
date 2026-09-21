import { NextRequest, NextResponse } from "next/server";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("settings.manage");
    const settings = await getSettings();
    return NextResponse.json({ settings });
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requirePermission("settings.manage");
    const body = (await request.json().catch(() => null)) as
      | {
          externalHourlyRateCents?: number;
          openingHour?: number;
          closingHour?: number;
          slotDurationMinutes?: number;
          maxBookingDurationMinutes?: number;
          cancellationDeadlineHours?: number;
          maxActiveBookingsPerUser?: number;
          maxAdvanceBookingDaysMember?: number;
          maxAdvanceBookingDaysGuest?: number;
          guestDataRetentionDays?: number;
          reminderHoursBefore?: number;
          matchBlockDurationHours?: number;
          matchBlockDefaultStartTime?: string;
          matchBlockCourtIds?: string;
          matchBlockBufferBeforeMinutes?: number;
          matchBlockBufferAfterMinutes?: number;
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
    const cancellationDeadlineHours = Number(body.cancellationDeadlineHours);
    const maxActiveBookingsPerUser = Number(body.maxActiveBookingsPerUser);
    const maxAdvanceBookingDaysMember = Number(body.maxAdvanceBookingDaysMember);
    const maxAdvanceBookingDaysGuest = Number(body.maxAdvanceBookingDaysGuest);
    const externalHourlyRateCents = Number(body.externalHourlyRateCents);
    const guestDataRetentionDays = Number(body.guestDataRetentionDays);
    const reminderHoursBefore = Number(body.reminderHoursBefore);
    const matchBlockDurationHours = Number(body.matchBlockDurationHours);
    const matchBlockDefaultStartTime = body.matchBlockDefaultStartTime?.trim() || "09:00";
    const matchBlockCourtIds = body.matchBlockCourtIds?.trim() || "1,2,3,4";
    const matchBlockBufferBeforeMinutes = Number(body.matchBlockBufferBeforeMinutes);
    const matchBlockBufferAfterMinutes = Number(body.matchBlockBufferAfterMinutes);

    if (
      !Number.isInteger(openingHour) ||
      !Number.isInteger(closingHour) ||
      openingHour < 0 ||
      closingHour > 24 ||
      openingHour >= closingHour
    ) {
      return jsonError("Bitte gültige Öffnungszeiten eintragen.");
    }

    if (![15, 30, 60].includes(slotDurationMinutes)) {
      return jsonError("Zeitfenster müssen 15, 30 oder 60 Minuten lang sein.");
    }

    if (maxBookingDurationMinutes < slotDurationMinutes || maxBookingDurationMinutes > 480) {
      return jsonError("Die maximale Buchungsdauer muss zwischen Slotdauer und 480 Minuten liegen.");
    }

    if (
      !Number.isInteger(cancellationDeadlineHours) ||
      cancellationDeadlineHours < 0 ||
      !Number.isInteger(maxActiveBookingsPerUser) ||
      maxActiveBookingsPerUser < 1 ||
      !Number.isInteger(maxAdvanceBookingDaysMember) ||
      maxAdvanceBookingDaysMember < 1 ||
      !Number.isInteger(maxAdvanceBookingDaysGuest) ||
      maxAdvanceBookingDaysGuest < 1 ||
      !Number.isInteger(guestDataRetentionDays) ||
      guestDataRetentionDays < 30 ||
      guestDataRetentionDays > 1095 ||
      !Number.isInteger(reminderHoursBefore) ||
      reminderHoursBefore < 1 ||
      reminderHoursBefore > 72
    ) {
      return jsonError("Bitte gültige Buchungsregeln eintragen.");
    }

    if (externalHourlyRateCents < 0) {
      return jsonError("Der Preis darf nicht negativ sein.");
    }

    if (
      !Number.isInteger(matchBlockDurationHours) ||
      matchBlockDurationHours < 1 ||
      matchBlockDurationHours > 12 ||
      !/^\d{2}:\d{2}$/.test(matchBlockDefaultStartTime) ||
      !/^\d+(,\d+)*$/.test(matchBlockCourtIds.replace(/\s+/g, "")) ||
      !Number.isInteger(matchBlockBufferBeforeMinutes) ||
      matchBlockBufferBeforeMinutes < 0 ||
      !Number.isInteger(matchBlockBufferAfterMinutes) ||
      matchBlockBufferAfterMinutes < 0
    ) {
      return jsonError("Bitte gültige Regeln für Heimspiel-Sperren eintragen.");
    }

    const settings = await prisma.settings.update({
      where: { id: "default" },
      data: {
        externalHourlyRateCents,
        openingHour,
        closingHour,
        slotDurationMinutes,
        maxBookingDurationMinutes,
        cancellationDeadlineHours,
        maxActiveBookingsPerUser,
        maxAdvanceBookingDaysMember,
        maxAdvanceBookingDaysGuest,
        guestDataRetentionDays,
        reminderHoursBefore,
        matchBlockDurationHours,
        matchBlockDefaultStartTime,
        matchBlockCourtIds: matchBlockCourtIds.replace(/\s+/g, ""),
        matchBlockBufferBeforeMinutes,
        matchBlockBufferAfterMinutes,
        cancellationRules: body.cancellationRules?.trim() || undefined
      }
    });

    await writeAuditLog({
      actorUserId: admin.id,
      action: "SETTINGS_UPDATED",
      entityType: "Settings",
      entityId: settings.id,
      details: { changedFields: Object.keys(body).sort() },
      request
    });

    return NextResponse.json({ settings });
  });
}
