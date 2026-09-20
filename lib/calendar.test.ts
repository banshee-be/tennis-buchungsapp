import { describe, expect, it, vi } from "vitest";
import { createBookingCalendarFile } from "@/lib/calendar";

describe("createBookingCalendarFile", () => {
  it("erstellt einen importierbaren Termin mit Buchungsnummer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T08:00:00Z"));
    const result = createBookingCalendarFile({
      bookingCode: "TVE-123",
      courtName: "Platz 1",
      startTime: new Date("2026-09-21T16:00:00Z"),
      endTime: new Date("2026-09-21T17:00:00Z")
    });

    expect(result).toContain("BEGIN:VCALENDAR");
    expect(result).toContain("DTSTART:20260921T160000Z");
    expect(result).toContain("UID:TVE-123@tveuropabad-marbach.de");
    vi.useRealTimers();
  });
});
