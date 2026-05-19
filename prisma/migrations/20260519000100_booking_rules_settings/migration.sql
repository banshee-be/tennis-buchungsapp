ALTER TABLE "Settings" ADD COLUMN "cancellationDeadlineHours" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Settings" ADD COLUMN "maxActiveBookingsPerUser" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Settings" ADD COLUMN "maxAdvanceBookingDaysMember" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Settings" ADD COLUMN "maxAdvanceBookingDaysGuest" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "Settings" ALTER COLUMN "maxBookingDurationMinutes" SET DEFAULT 120;

UPDATE "Settings"
SET
  "cancellationDeadlineHours" = 2,
  "maxActiveBookingsPerUser" = 3,
  "maxAdvanceBookingDaysMember" = 7,
  "maxAdvanceBookingDaysGuest" = 3,
  "maxBookingDurationMinutes" = LEAST("maxBookingDurationMinutes", 120);
