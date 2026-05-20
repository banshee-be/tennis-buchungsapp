ALTER TABLE "TeamPlayer"
  ADD COLUMN "teamPosition" TEXT,
  ADD COLUMN "nation" TEXT,
  ADD COLUMN "info" TEXT,
  ADD COLUMN "msg" TEXT;

UPDATE "TeamPlayer"
SET "teamPosition" = "position"
WHERE "teamPosition" IS NULL AND "position" IS NOT NULL;

CREATE TABLE "UserTeamPlayer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamPlayerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserTeamPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTeamPlayer_userId_teamPlayerId_key" ON "UserTeamPlayer"("userId", "teamPlayerId");
CREATE INDEX "UserTeamPlayer_userId_idx" ON "UserTeamPlayer"("userId");
CREATE INDEX "UserTeamPlayer_teamPlayerId_idx" ON "UserTeamPlayer"("teamPlayerId");

ALTER TABLE "UserTeamPlayer" ADD CONSTRAINT "UserTeamPlayer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTeamPlayer" ADD CONSTRAINT "UserTeamPlayer_teamPlayerId_fkey"
  FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserTeamPlayer" ("id", "userId", "teamPlayerId", "updatedAt")
SELECT concat('utp_', md5("id" || "teamPlayerId")), "id", "teamPlayerId", CURRENT_TIMESTAMP
FROM "User"
WHERE "teamPlayerId" IS NOT NULL
ON CONFLICT ("userId", "teamPlayerId") DO NOTHING;
