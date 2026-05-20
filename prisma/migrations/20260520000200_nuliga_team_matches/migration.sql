ALTER TABLE "Settings"
  ADD COLUMN "matchBlockDurationHours" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "matchBlockDefaultStartTime" TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN "matchBlockCourtIds" TEXT NOT NULL DEFAULT '1,2,3,4',
  ADD COLUMN "matchBlockBufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "matchBlockBufferAfterMinutes" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "TeamMatch" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "season" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "homeTeam" TEXT NOT NULL,
  "awayTeam" TEXT NOT NULL,
  "opponent" TEXT,
  "isHomeMatch" BOOLEAN NOT NULL DEFAULT false,
  "venue" TEXT,
  "league" TEXT,
  "groupName" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "importKey" TEXT NOT NULL,
  "rawData" JSONB,
  "importStatus" TEXT NOT NULL DEFAULT 'IMPORTED',
  "blockStatus" TEXT NOT NULL DEFAULT 'NONE',
  "blockId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamMatch_importKey_key" ON "TeamMatch"("importKey");
CREATE INDEX "TeamMatch_teamId_date_idx" ON "TeamMatch"("teamId", "date");
CREATE INDEX "TeamMatch_isHomeMatch_blockStatus_idx" ON "TeamMatch"("isHomeMatch", "blockStatus");

ALTER TABLE "TeamMatch" ADD CONSTRAINT "TeamMatch_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
