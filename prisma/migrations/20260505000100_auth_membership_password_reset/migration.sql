-- Add password auth and explicit membership review fields.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "membershipType" TEXT NOT NULL DEFAULT 'EXTERNAL';
ALTER TABLE "User" ADD COLUMN "memberNumber" TEXT;

-- Existing users from the previous model are treated as verified guest players
-- until an admin explicitly confirms membership.
UPDATE "User" SET "membershipType" = 'EXTERNAL';
UPDATE "User" SET "membershipStatus" = 'VERIFIED';
ALTER TABLE "User" ALTER COLUMN "membershipStatus" SET DEFAULT 'VERIFIED';

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
