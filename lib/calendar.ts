type CalendarBooking = {
  bookingCode: string;
  courtName: string;
  startTime: Date;
  endTime: Date;
};

function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

export function createBookingCalendarFile(booking: CalendarBooking) {
  const now = icsDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TV Europabad Marbach//Platzbuchung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsText(booking.bookingCode)}@tveuropabad-marbach.de`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsDate(booking.startTime)}`,
    `DTEND:${icsDate(booking.endTime)}`,
    `SUMMARY:${icsText(`Tennisplatz ${booking.courtName}`)}`,
    `LOCATION:${icsText("Tennisanlage Marburg-Marbach")}`,
    `DESCRIPTION:${icsText(`Buchungsnummer: ${booking.bookingCode}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ];

  return lines.join("\r\n");
}
