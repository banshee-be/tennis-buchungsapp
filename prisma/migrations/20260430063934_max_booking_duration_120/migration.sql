-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "externalHourlyRateCents" INTEGER NOT NULL DEFAULT 1800,
    "openingHour" INTEGER NOT NULL DEFAULT 8,
    "closingHour" INTEGER NOT NULL DEFAULT 21,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxBookingDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "cancellationRules" TEXT NOT NULL DEFAULT 'Kostenfreie Stornierung bis 24 Stunden vor Spielbeginn.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("cancellationRules", "closingHour", "createdAt", "externalHourlyRateCents", "id", "maxBookingDurationMinutes", "openingHour", "slotDurationMinutes", "updatedAt") SELECT "cancellationRules", "closingHour", "createdAt", "externalHourlyRateCents", "id", "maxBookingDurationMinutes", "openingHour", "slotDurationMinutes", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
