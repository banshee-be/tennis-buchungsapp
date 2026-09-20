ALTER TABLE "Booking"
  ADD COLUMN "reminderEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "lastEmailError" TEXT,
  ADD COLUMN "emailRetryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "guestDataAnonymizedAt" TIMESTAMP(3);

ALTER TABLE "Settings"
  ADD COLUMN "guestDataRetentionDays" INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
