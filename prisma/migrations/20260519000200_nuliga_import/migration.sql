ALTER TABLE "User" ADD COLUMN "teamPlayerId" TEXT;

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "season" TEXT,
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "externalId" TEXT,
  "lastImportedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamPlayer" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "rank" INTEGER,
  "position" TEXT,
  "lk" TEXT,
  "nuLigaId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "birthYear" INTEGER,
  "licenseNumber" TEXT,
  "isCaptain" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sourceUrl" TEXT NOT NULL,
  "importKey" TEXT NOT NULL,
  "rawData" JSONB,
  "lastImportedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_source_sourceUrl_key" ON "Team"("source", "sourceUrl");
CREATE INDEX "Team_source_externalId_idx" ON "Team"("source", "externalId");
CREATE UNIQUE INDEX "TeamPlayer_importKey_key" ON "TeamPlayer"("importKey");
CREATE INDEX "TeamPlayer_teamId_idx" ON "TeamPlayer"("teamId");
CREATE INDEX "TeamPlayer_fullName_idx" ON "TeamPlayer"("fullName");
CREATE INDEX "TeamPlayer_nuLigaId_idx" ON "TeamPlayer"("nuLigaId");
CREATE INDEX "TeamPlayer_licenseNumber_idx" ON "TeamPlayer"("licenseNumber");

ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_teamPlayerId_fkey"
  FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
