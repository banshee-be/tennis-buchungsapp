import { prisma } from "@/lib/prisma";

export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      maxBookingDurationMinutes: 480
    }
  });
}

export function formatEuroFromCents(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(cents / 100);
}

export function calculateAmountCents(hourlyRateCents: number, durationMinutes: number) {
  return Math.round((hourlyRateCents * durationMinutes) / 60);
}
