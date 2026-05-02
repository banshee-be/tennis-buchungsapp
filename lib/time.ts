export type BookingInputTime = {
  date: string;
  startTime: string;
  durationMinutes: number;
};

export function assertDateString(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Bitte ein gueltiges Datum waehlen.");
  }
}

export function timeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (!match) {
    throw new Error("Bitte eine gueltige Uhrzeit waehlen.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("Bitte eine gueltige Uhrzeit waehlen.");
  }

  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const rest = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${rest}`;
}

export function buildUtcDate(date: string, minutes: number) {
  assertDateString(date);
  return new Date(`${date}T${minutesToTime(minutes)}:00.000Z`);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function getDayRange(date: string) {
  assertDateString(date);
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = addMinutes(start, 24 * 60);
  return { start, end };
}

export function isoDate(date = new Date()) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

export function isoTime(date: Date) {
  return date.toISOString().slice(11, 16);
}

export function makeSlotStarts(start: Date, end: Date, slotDurationMinutes: number) {
  const slots: Date[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    slots.push(new Date(cursor));
    cursor = addMinutes(cursor, slotDurationMinutes);
  }

  return slots;
}

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

export function parseBookingInput(
  input: BookingInputTime,
  settings: {
    openingHour: number;
    closingHour: number;
    slotDurationMinutes: number;
    maxBookingDurationMinutes: number;
  }
) {
  assertDateString(input.date);
  const startMinutes = timeToMinutes(input.startTime);
  const durationMinutes = Number(input.durationMinutes);
  const openingMinutes = settings.openingHour * 60;
  const closingMinutes = settings.closingHour * 60;

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Bitte eine gueltige Buchungsdauer waehlen.");
  }

  if (durationMinutes > settings.maxBookingDurationMinutes) {
    throw new Error("Die gewaehlte Dauer ist laenger als erlaubt.");
  }

  if (durationMinutes % settings.slotDurationMinutes !== 0) {
    throw new Error("Die Buchung muss in buchbaren Zeitfenstern liegen.");
  }

  if (startMinutes < openingMinutes || startMinutes + durationMinutes > closingMinutes) {
    throw new Error("Die Buchung liegt ausserhalb der Oeffnungszeiten.");
  }

  if ((startMinutes - openingMinutes) % settings.slotDurationMinutes !== 0) {
    throw new Error("Die Startzeit liegt nicht in einem buchbaren Zeitfenster.");
  }

  const start = buildUtcDate(input.date, startMinutes);
  const end = addMinutes(start, durationMinutes);

  return {
    start,
    end,
    startMinutes,
    durationMinutes,
    slotStarts: makeSlotStarts(start, end, settings.slotDurationMinutes)
  };
}
