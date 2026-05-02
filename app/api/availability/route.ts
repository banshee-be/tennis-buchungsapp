import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredPendingBookings } from "@/lib/bookings";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addMinutes, buildUtcDate, getDayRange, isoDate, isoTime, minutesToTime, rangesOverlap } from "@/lib/time";
import { readSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await releaseExpiredPendingBookings(prisma);

    const date = request.nextUrl.searchParams.get("date") ?? isoDate();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Bitte ein gueltiges Datum waehlen.");
    }

    const session = await readSession();
    const settings = await getSettings();
    const courts = await prisma.court.findMany({ orderBy: { id: "asc" } });
    const { start: dayStart, end: dayEnd } = getDayRange(date);
    const bookings = await prisma.booking.findMany({
      where: {
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
        OR: [
          { status: "CONFIRMED" },
          {
            status: "PENDING",
            expiresAt: { gt: new Date() }
          }
        ]
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });
    const blocks = await prisma.courtBlock.findMany({
      where: {
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart }
      }
    });

    const openingMinutes = settings.openingHour * 60;
    const closingMinutes = settings.closingHour * 60;
    const slotStarts: string[] = [];

    for (let minutes = openingMinutes; minutes < closingMinutes; minutes += settings.slotDurationMinutes) {
      slotStarts.push(minutesToTime(minutes));
    }

    const courtPayload = courts.map((court) => {
      const slots = slotStarts.map((time) => {
        const slotStart = buildUtcDate(date, Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)));
        const slotEnd = addMinutes(slotStart, settings.slotDurationMinutes);
        const block = blocks.find(
          (entry) => entry.courtId === court.id && rangesOverlap(slotStart, slotEnd, entry.startTime, entry.endTime)
        );
        const booking = bookings.find(
          (entry) => entry.courtId === court.id && rangesOverlap(slotStart, slotEnd, entry.startTime, entry.endTime)
        );

        if (!court.isActive) {
          return { time, status: "blocked", label: "Platz gesperrt" };
        }

        if (block) {
          return { time, status: "blocked", label: block.title };
        }

        if (booking) {
          return {
            time,
            status: booking.userId === session?.id ? "own" : "booked",
            label: booking.userId === session?.id ? "Eigene Buchung" : "Belegt",
            bookingId: booking.id,
            range: `${isoTime(booking.startTime)}-${isoTime(booking.endTime)}`
          };
        }

        return { time, status: "free", label: "Frei" };
      });

      return {
        id: court.id,
        name: court.name,
        isActive: court.isActive,
        notes: court.notes,
        slots
      };
    });

    return NextResponse.json({
      date,
      settings: {
        externalHourlyRateCents: settings.externalHourlyRateCents,
        openingHour: settings.openingHour,
        closingHour: settings.closingHour,
        slotDurationMinutes: settings.slotDurationMinutes,
        maxBookingDurationMinutes: settings.maxBookingDurationMinutes,
        cancellationRules: settings.cancellationRules
      },
      courts: courtPayload,
      legend: {
        free: "Frei",
        booked: "Belegt",
        blocked: "Gesperrt",
        own: "Eigene Buchung"
      }
    });
  });
}
