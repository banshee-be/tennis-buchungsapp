import type { Booking, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export function paymentConfirmationDecision(
  booking: Pick<Booking, "status" | "paymentStatus" | "expiresAt">,
  now = new Date()
) {
  if (booking.status === "CONFIRMED" && booking.paymentStatus === "PAID") {
    return "ALREADY_CONFIRMED" as const;
  }

  if (booking.status !== "PENDING" || (booking.expiresAt && booking.expiresAt <= now)) {
    return "REFUND" as const;
  }

  return "CONFIRM" as const;
}

export async function releaseExpiredPendingBookings(db: Db) {
  const now = new Date();
  const expired = await db.booking.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now }
    },
    select: { id: true }
  });
  const ids = expired.map((booking) => booking.id);

  if (ids.length === 0) {
    return;
  }

  await db.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await db.payment.updateMany({
    where: { bookingId: { in: ids }, status: "PENDING" },
    data: { status: "FAILED" }
  });
  await db.booking.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      cancelReason: "Zahlung abgelaufen."
    }
  });
}

export async function assertCourtCanBeBooked(
  db: Db,
  courtId: number,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
) {
  const court = await db.court.findUnique({ where: { id: courtId } });

  if (!court || !court.isActive) {
    throw new Error("Dieser Platz ist aktuell gesperrt.");
  }

  const overlappingBlock = await db.courtBlock.findFirst({
    where: {
      courtId,
      startTime: { lt: endTime },
      endTime: { gt: startTime }
    }
  });

  if (overlappingBlock) {
    throw new Error("Der Platz ist in diesem Zeitraum gesperrt.");
  }

  const overlappingBooking = await db.booking.findFirst({
    where: {
      courtId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: [
        { status: "CONFIRMED" },
        {
          status: "PENDING",
          expiresAt: { gt: new Date() }
        }
      ]
    }
  });

  if (overlappingBooking) {
    throw new Error("Dieses Zeitfenster ist bereits belegt.");
  }
}

export async function createSlotsForBooking(
  db: Db,
  bookingId: string,
  courtId: number,
  slotStarts: Date[]
) {
  await db.bookingSlot.createMany({
    data: slotStarts.map((slotStart) => ({
      bookingId,
      courtId,
      slotStart
    }))
  });
}

export async function cancelBooking(db: Db, bookingId: string, reason: string) {
  const existing = await db.booking.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true }
  });

  const booking = await db.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancelReason: reason,
      paymentStatus: existing?.paymentStatus === "PENDING" ? "FAILED" : existing?.paymentStatus
    }
  });

  await db.bookingSlot.deleteMany({ where: { bookingId } });
  await db.payment.updateMany({
    where: { bookingId, status: "PENDING" },
    data: { status: "FAILED" }
  });

  return booking;
}

export async function deletePendingBookingHold(db: Db, bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId }
  });

  if (!booking) {
    return null;
  }

  return cancelBooking(db, bookingId, booking.status === "PENDING" ? "Zahlung abgelaufen." : "Zahlung fehlgeschlagen.");
}

export async function assertUserCanCancelBooking(
  booking: Pick<Booking, "startTime" | "status">,
  cancellationDeadlineHours: number
) {
  if (booking.status === "CANCELLED") {
    throw new Error("Diese Buchung ist bereits storniert.");
  }

  const now = Date.now();
  const startTime = booking.startTime.getTime();

  if (startTime <= now) {
    throw new Error("Vergangene Buchungen können nicht storniert werden.");
  }

  if (startTime - now < cancellationDeadlineHours * 60 * 60_000) {
    throw new Error("Stornierung nicht mehr möglich.");
  }
}

export async function confirmPaidBooking(
  bookingId: string,
  providerPaymentId?: string | null,
  paidAmount?: { amountCents: number; currency: string }
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true }
    });

    if (!booking) {
      return null;
    }

    const decision = paymentConfirmationDecision(booking);

    if (decision === "ALREADY_CONFIRMED") {
      return booking;
    }

    if (decision === "REFUND" || !booking.payment) {
      return booking;
    }

    if (
      paidAmount &&
      (booking.payment.amountCents !== paidAmount.amountCents || booking.payment.currency.toLowerCase() !== paidAmount.currency.toLowerCase())
    ) {
      throw new Error("Der von PayPal bestätigte Betrag stimmt nicht mit der Buchung überein.");
    }

    await tx.payment.update({
      where: { bookingId },
      data: {
        status: "PAID",
        providerPaymentId: providerPaymentId ?? booking.payment?.providerPaymentId
      }
    });

    return tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        expiresAt: null
      }
    });
  });
}

export async function markBookingRefunded(bookingId: string, providerRefundId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    await tx.bookingSlot.deleteMany({ where: { bookingId } });
    await tx.payment.update({
      where: { bookingId },
      data: { status: "REFUNDED", providerRefundId, refundedAt: new Date() }
    });

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED", paymentStatus: "REFUNDED", cancelReason: reason, expiresAt: null }
    });
  });
}

export function bookingInclude() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        membershipType: true,
        membershipStatus: true,
        memberNumber: true
      }
    },
    court: true,
    payment: true
  } satisfies Prisma.BookingInclude;
}

export function serializeBooking(
  booking: Booking & {
    user?: {
      id?: string;
      name: string;
      email: string;
      role?: string;
      membershipType?: string;
      membershipStatus?: string;
      memberNumber?: string | null;
    } | null;
    court?: { name: string };
  }
) {
  return {
    ...booking,
    user:
      booking.user ??
      (booking.guestName && booking.guestEmail
        ? {
            name: booking.guestName,
            email: booking.guestEmail,
            role: "GUEST",
            membershipType: "EXTERNAL",
            membershipStatus: "VERIFIED",
            memberNumber: null
          }
        : null),
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString()
  };
}
