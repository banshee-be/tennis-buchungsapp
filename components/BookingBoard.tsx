"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ViewMode = "week" | "two-days" | "day";

type User = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  membershipStatus: "MEMBER" | "EXTERNAL";
};

type SlotStatus = "free" | "booked" | "blocked" | "own";

type Slot = {
  time: string;
  status: SlotStatus;
  label: string;
  bookingId?: string;
  range?: string;
};

type CourtAvailability = {
  id: number;
  name: string;
  isActive: boolean;
  notes?: string | null;
  slots: Slot[];
};

type Availability = {
  date: string;
  settings: {
    externalHourlyRateCents: number;
    openingHour: number;
    closingHour: number;
    slotDurationMinutes: number;
    maxBookingDurationMinutes: number;
    cancellationRules: string;
  };
  courts: CourtAvailability[];
};

type Selection = {
  courtId: number;
  courtName: string;
  date: string;
  time: string;
};

type SlotBar = {
  key: string;
  status: SlotStatus | "selected" | "preview";
  label: string;
  startIndex: number;
  span: number;
  startTime: string;
  endTime: string;
};

const durationPresets = [
  { label: "1 Stunde", minutes: 60 },
  { label: "1,5 Stunden", minutes: 90 },
  { label: "2 Stunden", minutes: 120 }
];

const viewModes: Array<{ key: ViewMode; label: string; days: number }> = [
  { key: "week", label: "Woche", days: 7 },
  { key: "two-days", label: "2 Tage", days: 2 },
  { key: "day", label: "Tag", days: 1 }
];

function today() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function startOfMonth(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function addMonths(dateString: string, months: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function calendarDays(monthDate: string) {
  const date = new Date(`${monthDate}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const leadingEmptyDays = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<string | null> = Array.from({ length: leadingEmptyDays }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, month, day, 12);
    current.setMinutes(current.getMinutes() - current.getTimezoneOffset());
    days.push(current.toISOString().slice(0, 10));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function euro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function addMinutesToTime(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

function minutesFromTime(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function isPastDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime() < Date.now();
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("de-DE", options).format(new Date(`${date}T12:00:00`));
}

function getViewDays(viewMode: ViewMode) {
  return viewModes.find((mode) => mode.key === viewMode)?.days ?? 7;
}

function courtNumber(name: string) {
  return name.match(/\d+/)?.[0] ?? name;
}

function courtCaption(court: CourtAvailability) {
  const notes = court.notes?.trim();

  if (court.name.includes("4") || notes?.toLowerCase().includes("flutlicht")) {
    return "";
  }

  return notes || (court.isActive ? "Buchbar" : "Gesperrt");
}

function isTodayDate(date: string) {
  return date === today();
}

function isWeekend(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function statusText(slot: Pick<Slot, "status" | "label">) {
  if (slot.status === "free") {
    return "Frei";
  }

  if (slot.status === "own") {
    return "Eigene Buchung";
  }

  if (slot.status === "blocked") {
    return slot.label || "Gesperrt";
  }

  return "Belegt";
}

function priceZone(time: string) {
  const minutes = minutesFromTime(time);

  if (minutes < 10 * 60) {
    return "early";
  }

  if (minutes >= 17 * 60 && minutes < 20 * 60) {
    return "prime";
  }

  if (minutes >= 20 * 60) {
    return "late";
  }

  return "normal";
}

function makePeriodLabel(days: Availability[]) {
  const first = days[0];
  const last = days[days.length - 1];

  if (!first) {
    return "Wird geladen";
  }

  if (!last || first.date === last.date) {
    return formatDate(first.date, { weekday: "long", day: "2-digit", month: "long" });
  }

  return `${formatDate(first.date, { weekday: "short", day: "2-digit", month: "2-digit" })} - ${formatDate(last.date, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  })}`;
}

function getSlot(court: CourtAvailability, time: string) {
  return court.slots.find((slot) => slot.time === time);
}

function makeSlotBars(court: CourtAvailability, slotDurationMinutes: number): SlotBar[] {
  const bars: SlotBar[] = [];
  let index = 0;

  while (index < court.slots.length) {
    const slot = court.slots[index];

    if (slot.status === "free") {
      index += 1;
      continue;
    }

    const groupKey = `${slot.status}-${slot.bookingId ?? slot.label}-${slot.range ?? ""}`;
    let endIndex = index + 1;

    while (endIndex < court.slots.length) {
      const next = court.slots[endIndex];
      const nextKey = `${next.status}-${next.bookingId ?? next.label}-${next.range ?? ""}`;

      if (next.status === "free" || nextKey !== groupKey) {
        break;
      }

      endIndex += 1;
    }

    const [rangeStart, rangeEnd] = slot.range?.split("-") ?? [];

    bars.push({
      key: `${court.id}-${slot.time}-${groupKey}`,
      status: slot.status,
      label: statusText(slot),
      startIndex: index,
      span: endIndex - index,
      startTime: rangeStart || slot.time,
      endTime: rangeEnd || addMinutesToTime(court.slots[endIndex - 1].time, slotDurationMinutes)
    });
    index = endIndex;
  }

  return bars;
}

function makeSelectedBar(
  day: Availability,
  court: CourtAvailability,
  selection: Selection | null,
  durationMinutes: number
): SlotBar | null {
  if (!selection || selection.date !== day.date || selection.courtId !== court.id) {
    return null;
  }

  const startIndex = court.slots.findIndex((slot) => slot.time === selection.time);

  if (startIndex < 0) {
    return null;
  }

  return {
    key: `${day.date}-${court.id}-selected-${selection.time}`,
    status: "selected",
    label: "Ausgewählt",
    startIndex,
    span: durationMinutes / day.settings.slotDurationMinutes,
    startTime: selection.time,
    endTime: addMinutesToTime(selection.time, durationMinutes)
  };
}

function makePreviewBar(day: Availability, court: CourtAvailability, preview: Selection | null, durationMinutes: number): SlotBar | null {
  if (!preview || preview.date !== day.date || preview.courtId !== court.id) {
    return null;
  }

  const startIndex = court.slots.findIndex((slot) => slot.time === preview.time);

  if (startIndex < 0) {
    return null;
  }

  return {
    key: `${day.date}-${court.id}-preview-${preview.time}`,
    status: "preview",
    label: "Vorschau",
    startIndex,
    span: durationMinutes / day.settings.slotDurationMinutes,
    startTime: preview.time,
    endTime: addMinutesToTime(preview.time, durationMinutes)
  };
}

function barTitle(day: Availability, court: CourtAvailability, bar: SlotBar) {
  return `${formatDate(day.date, { weekday: "short", day: "2-digit", month: "2-digit" })} · Platz ${courtNumber(court.name)} · ${
    bar.startTime
  }-${bar.endTime} · ${bar.label}`;
}

function DatePickerCalendar({
  month,
  onMonthChange,
  onSelect,
  selectedDate
}: {
  month: string;
  onMonthChange: (date: string) => void;
  onSelect: (date: string) => void;
  selectedDate: string;
}) {
  const currentToday = today();
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="date-picker-calendar">
      <div className="date-picker-monthbar">
        <button aria-label="Vorheriger Monat" onClick={() => onMonthChange(addMonths(month, -1))} type="button">
          ‹
        </button>
        <strong>{formatDate(month, { month: "long", year: "numeric" })}</strong>
        <button aria-label="Nächster Monat" onClick={() => onMonthChange(addMonths(month, 1))} type="button">
          ›
        </button>
      </div>

      <div className="date-picker-weekdays" aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="date-picker-days">
        {calendarDays(month).map((day, index) =>
          day
            ? (() => {
                const isPast = day < currentToday;
                return (
                  <button
                    aria-label={`${formatDate(day, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} auswählen`}
                    className={`date-picker-day ${day === selectedDate ? "selected" : ""} ${day === currentToday ? "today" : ""} ${
                      isPast ? "past" : ""
                    }`}
                    disabled={isPast}
                    key={day}
                    onClick={() => onSelect(day)}
                    title={isPast ? "Vergangene Tage sind nicht buchbar." : "Datum wählen"}
                    type="button"
                  >
                    <span>{Number(day.slice(8, 10))}</span>
                    {day === currentToday ? <small>Heute</small> : null}
                  </button>
                );
              })()
            : <span aria-hidden="true" className="date-picker-day empty" key={`empty-${index}`} />
        )}
      </div>
    </div>
  );
}

export function BookingBoard() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customHours, setCustomHours] = useState("");
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(today()));
  const [desktopCalendarOpen, setDesktopCalendarOpen] = useState(false);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  const desktopDatePickerRef = useRef<HTMLDivElement>(null);

  const displayDays = availabilities;
  const activeDay = availabilities[activeDayIndex] ?? availabilities[0] ?? null;
  const mobileDay = availabilities.find((day) => day.date === selectedDate) ?? availabilities[0] ?? null;
  const baseSlots = displayDays[0]?.courts[0]?.slots ?? [];
  const slotDurationMinutes = activeDay?.settings.slotDurationMinutes ?? displayDays[0]?.settings.slotDurationMinutes ?? 30;
  const maxDurationMinutes = activeDay?.settings.maxBookingDurationMinutes ?? displayDays[0]?.settings.maxBookingDurationMinutes ?? 480;
  const price = activeDay ? Math.round((activeDay.settings.externalHourlyRateCents * durationMinutes) / 60) : 0;
  const durationIsValid =
    Number.isInteger(durationMinutes) &&
    durationMinutes > 0 &&
    durationMinutes <= maxDurationMinutes &&
    durationMinutes % slotDurationMinutes === 0;
  const selectedEndTime = selection ? addMinutesToTime(selection.time, durationMinutes) : null;
  const isExternal = user?.membershipStatus === "EXTERNAL";
  const selectedOrActiveDate = selection?.date ?? activeDay?.date ?? selectedDate;
  const periodLabel = makePeriodLabel(displayDays);
  const activeView = viewModes.find((mode) => mode.key === viewMode) ?? viewModes[0];
  const totalCourtColumns = displayDays.reduce((sum, day) => sum + day.courts.length, 0);
  const bookingButtonLabel = !selection || !durationIsValid ? "Zeitfenster auswählen" : isExternal ? "Weiter zur Zahlung" : "Buchung bestätigen";

  async function loadSession() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setUser(data.user);
  }

  const loadAvailability = useCallback(async () => {
    setLoading(true);

    try {
      const firstVisibleDate = viewMode === "week" ? startOfWeek(selectedDate) : selectedDate;
      const dates = Array.from({ length: getViewDays(viewMode) }, (_, index) => addDays(firstVisibleDate, index));
      const responses = await Promise.all(dates.map((day) => fetch(`/api/availability?date=${day}`, { cache: "no-store" })));

      if (responses.some((response) => !response.ok)) {
        throw new Error("Die Verfügbarkeit konnte nicht geladen werden.");
      }

      const data = (await Promise.all(responses.map((response) => response.json()))) as Availability[];
      setAvailabilities(data);
      const selectedIndex = data.findIndex((day) => day.date === selectedDate);
      setActiveDayIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } catch (error) {
      setAvailabilities([]);
      setMessage(error instanceof Error ? error.message : "Die Verfügbarkeit konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    void loadSession();
    const listener = () => void loadSession();
    window.addEventListener("session-changed", listener);
    return () => window.removeEventListener("session-changed", listener);
  }, []);

  useEffect(() => {
    setSelection(null);
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!desktopCalendarOpen && !mobileCalendarOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDesktopCalendarOpen(false);
        setMobileCalendarOpen(false);
      }
    }

    function closeDesktopOnOutsideClick(event: PointerEvent) {
      if (!desktopCalendarOpen) {
        return;
      }

      const target = event.target;

      if (target instanceof Node && desktopDatePickerRef.current && !desktopDatePickerRef.current.contains(target)) {
        setDesktopCalendarOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeDesktopOnOutsideClick);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeDesktopOnOutsideClick);
    };
  }, [desktopCalendarOpen, mobileCalendarOpen]);

  function selectDuration(minutes: number) {
    setDurationMinutes(minutes);
    setCustomHours("");
    setSelection(null);
    setMessage("");
  }

  function updateCustomHours(value: string) {
    setCustomHours(value);
    setSelection(null);
    setMessage("");

    const normalized = value.trim().replace(",", ".");
    const hours = Number(normalized);
    const minutes = Math.round(hours * 60);

    if (normalized && Number.isFinite(hours) && hours > 0) {
      setDurationMinutes(minutes);
    }
  }

  function previousView() {
    setSelectedDate((current) => addDays(current, -getViewDays(viewMode)));
  }

  function nextView() {
    setSelectedDate((current) => addDays(current, getViewDays(viewMode)));
  }

  function previousMobileDay() {
    setSelectedDate((current) => addDays(current, -1));
  }

  function nextMobileDay() {
    setSelectedDate((current) => addDays(current, 1));
  }

  function openDesktopDatePicker() {
    setCalendarMonth(startOfMonth(selectedDate));
    setDesktopCalendarOpen((open) => !open);
  }

  function openMobileDatePicker() {
    setCalendarMonth(startOfMonth(selectedDate));
    setMobileCalendarOpen(true);
  }

  function chooseDate(date: string) {
    if (date < today()) {
      setMessage("Buchungen in der Vergangenheit sind nicht möglich.");
      return;
    }

    setSelectedDate(date);
    setCalendarMonth(startOfMonth(date));
    setDesktopCalendarOpen(false);
    setMobileCalendarOpen(false);
    setSelection(null);
    setMessage("");
  }

  function selectViewMode(mode: ViewMode) {
    setViewMode(mode);
    setSelection(null);
    setMessage("");
  }

  function canStart(day: Availability, court: CourtAvailability, time: string) {
    if (!durationIsValid) {
      return false;
    }

    if (isPastDateTime(day.date, time)) {
      return false;
    }

    const neededSlots = durationMinutes / day.settings.slotDurationMinutes;
    const startIndex = court.slots.findIndex((slot) => slot.time === time);

    if (startIndex < 0 || startIndex + neededSlots > court.slots.length) {
      return false;
    }

    return court.slots.slice(startIndex, startIndex + neededSlots).every((slot) => slot.status === "free");
  }

  function isInSelectedRange(day: string, courtId: number, time: string) {
    if (!selection || selection.date !== day || selection.courtId !== courtId) {
      return false;
    }

    const current = minutesFromTime(time);
    const start = minutesFromTime(selection.time);
    return current >= start && current < start + durationMinutes;
  }

  function chooseSlot(day: Availability, court: CourtAvailability, slot: Slot) {
    if (slot.status !== "free") {
      setMessage("Dieser Zeitraum ist nicht verfügbar.");
      return;
    }

    if (!durationIsValid) {
      setMessage("Bitte eine gültige Dauer in buchbaren Zeitfenstern wählen.");
      return;
    }

    if (isPastDateTime(day.date, slot.time)) {
      setMessage("Buchungen in der Vergangenheit sind nicht möglich.");
      return;
    }

    if (!canStart(day, court, slot.time)) {
      setMessage("Dieser Zeitraum ist nicht vollständig verfügbar.");
      return;
    }

    const dayIndex = displayDays.findIndex((visibleDay) => visibleDay.date === day.date);
    setActiveDayIndex(dayIndex >= 0 ? dayIndex : 0);
    setSelection({ courtId: court.id, courtName: court.name, date: day.date, time: slot.time });
    setMessage("");
  }

  function showUnavailableMessage() {
    setMessage("Dieser Zeitraum ist nicht verfügbar.");
  }

  async function confirmBooking() {
    if (!selection) {
      setMessage("Bitte zuerst ein freies Zeitfenster wählen.");
      return;
    }

    if (!durationIsValid) {
      setMessage("Bitte eine gültige Dauer in buchbaren Zeitfenstern wählen.");
      return;
    }

    if (!user) {
      setMessage("Bitte oben mit Name und E-Mail einloggen oder registrieren.");
      return;
    }

    setBooking(true);
    setMessage("");

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courtId: selection.courtId,
        date: selection.date,
        startTime: selection.time,
        durationMinutes
      })
    });
    const data = await response.json();
    setBooking(false);

    if (!response.ok) {
      setMessage(data.error ?? "Buchung nicht möglich.");
      await loadAvailability();
      return;
    }

    if (data.requiresPayment && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    setMessage("Buchung bestätigt.");
    setSelection(null);
    await loadAvailability();
  }

  const durationLabel = `${durationMinutes / 60} ${durationMinutes === 60 ? "Stunde" : "Stunden"}`;
  const displayCourtColumns = displayDays.flatMap((day, dayIndex) => {
    const dayOffset = displayDays.slice(0, dayIndex).reduce((sum, currentDay) => sum + currentDay.courts.length, 0);

    return day.courts.map((court, courtIndex) => ({
      column: dayOffset + courtIndex + 2,
      court,
      courtIndex,
      day,
      dayIndex,
      isFirstCourtOfDay: courtIndex === 0,
      isLastCourtOfDay: courtIndex === day.courts.length - 1
    }));
  });

  const legendItems = (
    <>
      <span className="legend-token free">Frei</span>
      <span className="legend-token booked">Belegt</span>
      <span className="legend-token blocked">Gesperrt</span>
      <span className="legend-token own">Eigene Buchung</span>
      <span className="legend-token selected">Ausgewählt</span>
    </>
  );

  function renderDurationControls() {
    return (
      <>
        <span>Dauer</span>
        <div className="duration-presets">
          {durationPresets.map((preset) => (
            <button
              className={!customHours && durationMinutes === preset.minutes ? "active" : ""}
              key={preset.minutes}
              onClick={() => selectDuration(preset.minutes)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="duration-input compact-label">
          Individuell in Stunden
          <input
            inputMode="decimal"
            max={maxDurationMinutes / 60}
            min={slotDurationMinutes / 60}
            onChange={(event) => updateCustomHours(event.target.value)}
            placeholder="z. B. 2,5 oder 8"
            value={customHours}
          />
        </label>
        {!durationIsValid ? (
          <p className="field-hint error">Bitte in {slotDurationMinutes}-Minuten-Schritten bis maximal {maxDurationMinutes / 60} Stunden.</p>
        ) : null}
      </>
    );
  }

  function renderMobileDurationControls() {
    const mobilePresets = [
      { label: "1h", minutes: 60 },
      { label: "1,5h", minutes: 90 },
      { label: "2h", minutes: 120 }
    ];

    return (
      <div className="mobile-duration-compact">
        <div className="mobile-duration-row">
          <span>Dauer:</span>
          <div className="duration-presets mobile-duration-presets">
            {mobilePresets.map((preset) => (
              <button
                className={!customHours && durationMinutes === preset.minutes ? "active" : ""}
                key={preset.minutes}
                onClick={() => selectDuration(preset.minutes)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <label className="mobile-custom-duration">
          <span>Individuell:</span>
          <input
            inputMode="decimal"
            max={maxDurationMinutes / 60}
            min={slotDurationMinutes / 60}
            onChange={(event) => updateCustomHours(event.target.value)}
            placeholder="z. B. 2,5 oder 8"
            value={customHours}
          />
        </label>
        {!durationIsValid ? (
          <p className="field-hint error">Bitte in {slotDurationMinutes}-Minuten-Schritten bis maximal {maxDurationMinutes / 60} Stunden.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="booking-experience">
      <aside className="booking-summary-card">
        <div className="summary-kicker">Tennisanlage Marburg-Marbach</div>
        <h2>Buchungsübersicht</h2>

        <div className="summary-section">
          <span>Datum</span>
          <strong>{formatDate(selectedOrActiveDate, { weekday: "long", day: "2-digit", month: "2-digit" })}</strong>
        </div>

        <div className="field-group desktop-duration-field">{renderDurationControls()}</div>

        <dl className="summary-list">
          <div>
            <dt>Datum</dt>
            <dd>{formatDate(selectedOrActiveDate, { weekday: "short", day: "2-digit", month: "2-digit" })}</dd>
          </div>
          <div>
            <dt>Dauer</dt>
            <dd>{durationLabel}</dd>
          </div>
          <div>
            <dt>Mitgliedsstatus</dt>
            <dd>{user ? (user.membershipStatus === "MEMBER" ? "Mitglied" : "Gastspieler") : "Nicht eingeloggt"}</dd>
          </div>
          <div>
            <dt>Preis</dt>
            <dd>{user?.membershipStatus === "MEMBER" ? "Kostenfrei" : euro(price)}</dd>
          </div>
          <div>
            <dt>Platz</dt>
            <dd>{selection?.courtName ?? "Noch offen"}</dd>
          </div>
          <div>
            <dt>Uhrzeit</dt>
            <dd>{selection ? `${selection.time} bis ${selectedEndTime}` : "Noch offen"}</dd>
          </div>
        </dl>

        {message ? <p className={message.includes("bestätigt") ? "form-success" : "form-error"}>{message}</p> : null}

        <button className="button primary full" disabled={booking || !selection || !durationIsValid} onClick={confirmBooking}>
          {bookingButtonLabel}
        </button>
      </aside>

      <section className="booking-picker" aria-label="Platz buchen">
        <div className="desktop-calendar-toolbar">
          <div className="desktop-navigation">
            <button className="date-jump" onClick={previousView} type="button">
              Zurück
            </button>
            <div className="date-picker-anchor" ref={desktopDatePickerRef}>
              <button
                aria-expanded={desktopCalendarOpen}
                aria-label="Datum auswählen"
                className="period-chip date-picker-trigger"
                onClick={openDesktopDatePicker}
                title="Datum wählen"
                type="button"
              >
                <span aria-hidden="true" className="calendar-trigger-icon" />
                <span>{periodLabel}</span>
              </button>
              {desktopCalendarOpen ? (
                <div className="date-picker-popover" role="dialog" aria-label="Datum auswählen">
                  <DatePickerCalendar month={calendarMonth} onMonthChange={setCalendarMonth} onSelect={chooseDate} selectedDate={selectedDate} />
                </div>
              ) : null}
            </div>
            <button className="date-jump" onClick={nextView} type="button">
              Weiter
            </button>
          </div>

          <div className="view-switcher" aria-label="Ansicht">
            <span>Ansicht:</span>
            {viewModes.map((mode) => (
              <button className={viewMode === mode.key ? "active" : ""} key={mode.key} onClick={() => selectViewMode(mode.key)} type="button">
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {loading || !activeDay ? (
          <div className="loading-box">Verfügbarkeit wird geladen...</div>
        ) : (
          <div className="schedule-shell">
            <div className="schedule-header">
              <div>
                <p className="eyebrow mobile-only">Tagesraster</p>
                <h2>
                  <span className="desktop-only">Kalenderansicht · {activeView.label}</span>
                  <span className="mobile-only">
                    {formatDate(mobileDay?.date ?? selectedDate, { weekday: "long" })} /{" "}
                    {formatDate(mobileDay?.date ?? selectedDate, { day: "2-digit", month: "long" })}
                  </span>
                </h2>
              </div>
              <div className="schedule-legend desktop-legend">{legendItems}</div>
            </div>

            <div className="mobile-calendar-controls">
              <div className="mobile-day-toolbar">
                <button aria-label="Vorheriger Tag" className="date-jump" onClick={previousMobileDay} type="button">
                  ‹
                </button>
                <button
                  aria-label="Datum auswählen"
                  className="mobile-date-chip date-picker-trigger"
                  onClick={openMobileDatePicker}
                  title="Datum wählen"
                  type="button"
                >
                  <span aria-hidden="true" className="calendar-trigger-icon" />
                  <strong>{formatDate(mobileDay?.date ?? selectedDate, { weekday: "short", day: "2-digit", month: "2-digit" })}</strong>
                </button>
                <button aria-label="Nächster Tag" className="date-jump" onClick={nextMobileDay} type="button">
                  ›
                </button>
                <button className="today-button" onClick={() => setSelectedDate(today())} type="button">
                  Heute
                </button>
              </div>
              {renderMobileDurationControls()}
              {message ? <p className={message.includes("bestätigt") ? "form-success mobile-message" : "form-error mobile-message"}>{message}</p> : null}
              <details className="mobile-legend">
                <summary>Legende anzeigen</summary>
                <div className="schedule-legend">{legendItems}</div>
              </details>
            </div>

            <DesktopBookingCalendar
              baseSlots={baseSlots}
              canStart={canStart}
              chooseSlot={chooseSlot}
              columns={displayCourtColumns}
              dayCount={displayDays.length}
              days={displayDays}
              durationMinutes={durationMinutes}
              isInSelectedRange={isInSelectedRange}
              selection={selection}
              showUnavailableMessage={showUnavailableMessage}
              totalCourtColumns={totalCourtColumns}
              viewMode={viewMode}
            />

            {mobileDay ? (
              <MobileDayGrid
                canStart={canStart}
                chooseSlot={chooseSlot}
                day={mobileDay}
                durationMinutes={durationMinutes}
                isInSelectedRange={isInSelectedRange}
                selection={selection}
                showUnavailableMessage={showUnavailableMessage}
              />
            ) : null}
          </div>
        )}
      </section>

      {selection ? (
        <div className="mobile-booking-bar" aria-label="Ausgewählte Buchung" role="region">
          <div>
            <strong>
              {selection.courtName} · {selection.time} bis {selectedEndTime}
            </strong>
            <span>
              {formatDate(selection.date, { weekday: "short", day: "2-digit", month: "2-digit" })} · {durationLabel} ·{" "}
              {user?.membershipStatus === "MEMBER" ? "Kostenfrei" : euro(price)}
            </span>
          </div>
          <button className="button primary" disabled={booking || !durationIsValid} onClick={confirmBooking} type="button">
            {bookingButtonLabel}
          </button>
        </div>
      ) : null}

      {mobileCalendarOpen ? (
        <div aria-label="Datum auswählen" aria-modal="true" className="mobile-calendar-sheet" role="dialog">
          <button aria-label="Kalender schließen" className="mobile-calendar-backdrop" onClick={() => setMobileCalendarOpen(false)} type="button" />
          <div className="mobile-calendar-panel">
            <div className="mobile-calendar-panel-header">
              <div>
                <span>Datum auswählen</span>
                <strong>{formatDate(selectedDate, { weekday: "long", day: "2-digit", month: "long" })}</strong>
              </div>
              <button aria-label="Kalender schließen" onClick={() => setMobileCalendarOpen(false)} type="button">
                Schließen
              </button>
            </div>
            <DatePickerCalendar month={calendarMonth} onMonthChange={setCalendarMonth} onSelect={chooseDate} selectedDate={selectedDate} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopBookingCalendar({
  baseSlots,
  canStart,
  chooseSlot,
  columns,
  dayCount,
  days,
  durationMinutes,
  isInSelectedRange,
  selection,
  showUnavailableMessage,
  totalCourtColumns,
  viewMode
}: {
  baseSlots: Slot[];
  canStart: (day: Availability, court: CourtAvailability, time: string) => boolean;
  chooseSlot: (day: Availability, court: CourtAvailability, slot: Slot) => void;
  columns: Array<{
    column: number;
    court: CourtAvailability;
    courtIndex: number;
    day: Availability;
    dayIndex: number;
    isFirstCourtOfDay: boolean;
    isLastCourtOfDay: boolean;
  }>;
  dayCount: number;
  days: Availability[];
  durationMinutes: number;
  isInSelectedRange: (day: string, courtId: number, time: string) => boolean;
  selection: Selection | null;
  showUnavailableMessage: () => void;
  totalCourtColumns: number;
  viewMode: ViewMode;
}) {
  const safeCourtColumns = Math.max(totalCourtColumns, 1);
  const courtColumnMinWidth = viewMode === "week" ? 26 : viewMode === "two-days" ? 58 : 118;
  const scheduleMinWidth = viewMode === "week" ? "100%" : `${72 + safeCourtColumns * (viewMode === "two-days" ? 64 : 128)}px`;
  const [preview, setPreview] = useState<Selection | null>(null);

  return (
    <div className="desktop-schedule">
      <div className="schedule-scroll">
        <div
          className={`multi-day-schedule view-${viewMode} ${viewMode === "day" ? "single-day-view" : ""}`}
          style={{
            gridTemplateColumns: `72px repeat(${safeCourtColumns}, minmax(${courtColumnMinWidth}px, 1fr))`,
            minWidth: scheduleMinWidth
          }}
        >
          <div className="schedule-corner">Zeit</div>

          {days.map((day, dayIndex) => {
            const dayOffset = days.slice(0, dayIndex).reduce((sum, currentDay) => sum + currentDay.courts.length, 0);

            return (
              <div
                className={`day-group-label ${isTodayDate(day.date) ? "is-today" : ""} ${isWeekend(day.date) ? "is-weekend" : ""}`}
                key={day.date}
                style={{ gridColumn: `${dayOffset + 2} / span ${day.courts.length}`, gridRow: 1 }}
              >
                <span>{formatDate(day.date, { weekday: "short" })}</span>
                <strong>{formatDate(day.date, { day: "2-digit", month: "2-digit" })}</strong>
                {isTodayDate(day.date) ? <em>Heute</em> : null}
              </div>
            );
          })}

          {columns.map(({ column, court, day, isFirstCourtOfDay, isLastCourtOfDay }) => (
            <div
              className={`court-mini-title ${isFirstCourtOfDay ? "day-start" : ""} ${isLastCourtOfDay ? "day-end" : ""} ${
                isTodayDate(day.date) ? "is-today" : ""
              }`}
              key={`${day.date}-${court.id}`}
              style={{ gridColumn: column, gridRow: 2 }}
            >
              <strong>{courtNumber(court.name)}</strong>
              <span>{courtCaption(court)}</span>
            </div>
          ))}

          {baseSlots.map((timeSlot, index) => [
            <div className="time-cell-sticky" key={`time-${timeSlot.time}`} style={{ gridColumn: 1, gridRow: index + 3 }}>
              {timeSlot.time.endsWith(":00") ? timeSlot.time : ""}
            </div>,
            ...columns.map(({ column, court, day, isFirstCourtOfDay, isLastCourtOfDay }) => {
              const slot = getSlot(court, timeSlot.time);
              const isFree = slot?.status === "free";
              const selectable = Boolean(slot && isFree && canStart(day, court, timeSlot.time));
              const selectedRange = isInSelectedRange(day.date, court.id, timeSlot.time);
              const label = selectedRange ? "Ausgewählt" : slot ? statusText(slot) : "Nicht buchbar";
              const rangeEnd = isFree ? addMinutesToTime(timeSlot.time, durationMinutes) : slot?.range?.split("-")[1] ?? addMinutesToTime(timeSlot.time, day.settings.slotDurationMinutes);
              const freeCellLabel = viewMode === "week" ? "" : "Frei";
              const title = `${formatDate(day.date, { weekday: "short", day: "2-digit", month: "2-digit" })} · Platz ${courtNumber(court.name)} · ${
                timeSlot.time
              }-${rangeEnd} · ${selectable ? "Frei" : label}`;

              return (
                <button
                  aria-label={title}
                  className={`calendar-cell ${slot?.status ?? "blocked"} zone-${priceZone(timeSlot.time)} ${isFree ? "free clickable" : "disabled"} ${
                    selectable ? "" : "unavailable"
                  } ${selectedRange ? "selected" : ""} ${isFirstCourtOfDay ? "day-start" : ""} ${isLastCourtOfDay ? "day-end" : ""}`}
                  disabled={!slot || !isFree}
                  key={`${day.date}-${court.id}-${timeSlot.time}`}
                  onMouseEnter={() => (selectable ? setPreview({ courtId: court.id, courtName: court.name, date: day.date, time: timeSlot.time }) : setPreview(null))}
                  onMouseLeave={() => setPreview(null)}
                  onClick={() => slot && chooseSlot(day, court, slot)}
                  style={{ gridColumn: column, gridRow: index + 3 }}
                  title={title}
                  type="button"
                >
                  <span>{selectable ? freeCellLabel : label}</span>
                </button>
              );
            })
          ])}

          {columns.flatMap(({ column, court, day, isFirstCourtOfDay, isLastCourtOfDay }) => {
            const selectedBar = makeSelectedBar(day, court, selection, durationMinutes);
            const previewBar =
              preview && (!selection || preview.date !== selection.date || preview.courtId !== selection.courtId || preview.time !== selection.time)
                ? makePreviewBar(day, court, preview, durationMinutes)
                : null;
            const bars = makeSlotBars(court, day.settings.slotDurationMinutes);
            const allBars = [...bars, ...(previewBar ? [previewBar] : []), ...(selectedBar ? [selectedBar] : [])];

            return allBars.map((bar) => (
              <button
                aria-label={barTitle(day, court, bar)}
                className={`booking-bar ${bar.status} ${isFirstCourtOfDay ? "day-start" : ""} ${isLastCourtOfDay ? "day-end" : ""}`}
                disabled={bar.status === "selected" || bar.status === "preview"}
                key={`${day.date}-${bar.key}`}
                onClick={bar.status === "selected" || bar.status === "preview" ? undefined : showUnavailableMessage}
                style={{ gridColumn: column, gridRow: `${bar.startIndex + 3} / span ${bar.span}` }}
                title={barTitle(day, court, bar)}
                type="button"
              >
                <strong>{bar.label}</strong>
                {viewMode === "week" ? null : (
                  <span>{viewMode === "day" ? `${bar.startTime} bis ${bar.endTime}` : `${bar.startTime}-${bar.endTime}`}</span>
                )}
              </button>
            ));
          })}
        </div>
      </div>
    </div>
  );
}

function MobileDayGrid({
  canStart,
  chooseSlot,
  day,
  durationMinutes,
  isInSelectedRange,
  selection,
  showUnavailableMessage
}: {
  canStart: (day: Availability, court: CourtAvailability, time: string) => boolean;
  chooseSlot: (day: Availability, court: CourtAvailability, slot: Slot) => void;
  day: Availability;
  durationMinutes: number;
  isInSelectedRange: (day: string, courtId: number, time: string) => boolean;
  selection: Selection | null;
  showUnavailableMessage: () => void;
}) {
  const slots = day.courts[0]?.slots ?? [];

  return (
    <div className="mobile-grid-wrap">
      <div className="mobile-day-grid" style={{ gridTemplateColumns: "52px repeat(4, minmax(58px, 1fr))" }}>
        <div className="mobile-grid-corner">Zeit</div>

        {day.courts.map((court, courtIndex) => (
          <div className="mobile-court-head" key={court.id} style={{ gridColumn: courtIndex + 2, gridRow: 1 }}>
            <strong>{courtNumber(court.name)}</strong>
          </div>
        ))}

        {slots.map((timeSlot, index) => [
          <div className="mobile-time-cell" key={`mobile-time-${timeSlot.time}`} style={{ gridColumn: 1, gridRow: index + 2 }}>
            {timeSlot.time.endsWith(":00") ? timeSlot.time : ""}
          </div>,
          ...day.courts.map((court, courtIndex) => {
            const slot = getSlot(court, timeSlot.time);
            const isFree = slot?.status === "free";
            const selectable = Boolean(slot && isFree && canStart(day, court, timeSlot.time));
            const selectedRange = isInSelectedRange(day.date, court.id, timeSlot.time);
            const label = selectedRange ? "Ausgewählt" : slot ? statusText(slot) : "Nicht buchbar";
            const rangeEnd = isFree ? addMinutesToTime(timeSlot.time, durationMinutes) : slot?.range?.split("-")[1] ?? addMinutesToTime(timeSlot.time, day.settings.slotDurationMinutes);
            const title = `${formatDate(day.date, { weekday: "short", day: "2-digit", month: "2-digit" })} · Platz ${courtNumber(court.name)} · ${
              timeSlot.time
            }-${rangeEnd} · ${selectable ? "Frei" : label}`;

            return (
              <button
                aria-label={title}
                className={`mobile-grid-cell ${slot?.status ?? "blocked"} zone-${priceZone(timeSlot.time)} ${isFree ? "free" : "disabled"} ${
                  selectable ? "" : "unavailable"
                } ${selectedRange ? "selected" : ""}`}
                disabled={!slot || !isFree}
                key={`${day.date}-${court.id}-${timeSlot.time}`}
                onClick={() => slot && chooseSlot(day, court, slot)}
                style={{ gridColumn: courtIndex + 2, gridRow: index + 2 }}
                title={title}
                type="button"
              >
                <span>{selectable ? "Frei" : label}</span>
              </button>
            );
          })
        ])}

        {day.courts.flatMap((court, courtIndex) => {
          const selectedBar = makeSelectedBar(day, court, selection, durationMinutes);
          const bars = makeSlotBars(court, day.settings.slotDurationMinutes);
          const allBars = selectedBar ? [...bars, selectedBar] : bars;

          return allBars.map((bar) => (
            <button
              aria-label={barTitle(day, court, bar)}
              className={`mobile-booking-block ${bar.status}`}
              disabled={bar.status === "selected"}
              key={`${day.date}-mobile-${bar.key}`}
              onClick={bar.status === "selected" ? undefined : showUnavailableMessage}
              style={{ gridColumn: courtIndex + 2, gridRow: `${bar.startIndex + 2} / span ${bar.span}` }}
              title={barTitle(day, court, bar)}
              type="button"
            >
              <strong>{bar.label}</strong>
              <span>{bar.startTime}-{bar.endTime}</span>
            </button>
          ));
        })}
      </div>
    </div>
  );
}
