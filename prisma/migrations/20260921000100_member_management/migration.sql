ALTER TABLE "User"
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "street" TEXT,
  ADD COLUMN "addressAdditional" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Deutschland',
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "joinedAt" TIMESTAMP(3),
  ADD COLUMN "leftAt" TIMESTAMP(3),
  ADD COLUMN "resignationAt" TIMESTAMP(3),
  ADD COLUMN "resignationReason" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3);

CREATE TABLE "MemberContribution" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "amountDueCents" INTEGER NOT NULL,
  "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "paymentMethod" TEXT,
  "isExempt" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberContribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemberWorkHour" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "activity" TEXT NOT NULL,
  "performedAt" TIMESTAMP(3) NOT NULL,
  "correctionReason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberWorkHour_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemberKeyAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "keyType" "KeyType" NOT NULL,
  "keyNumber" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "returnedAt" TIMESTAMP(3),
  "depositCents" INTEGER,
  "depositStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberKeyAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemberEmail" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "providerId" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_membershipType_membershipStatus_lifecycleStatus_idx" ON "User"("membershipType", "membershipStatus", "lifecycleStatus");
CREATE INDEX "User_memberNumber_idx" ON "User"("memberNumber");
CREATE INDEX "User_archivedAt_idx" ON "User"("archivedAt");
CREATE UNIQUE INDEX "MemberContribution_userId_year_key" ON "MemberContribution"("userId", "year");
CREATE INDEX "MemberContribution_year_status_idx" ON "MemberContribution"("year", "status");
CREATE INDEX "MemberWorkHour_userId_performedAt_idx" ON "MemberWorkHour"("userId", "performedAt");
CREATE INDEX "MemberKeyAssignment_userId_returnedAt_idx" ON "MemberKeyAssignment"("userId", "returnedAt");
CREATE INDEX "MemberKeyAssignment_keyNumber_idx" ON "MemberKeyAssignment"("keyNumber");
CREATE UNIQUE INDEX "MemberEmail_idempotencyKey_key" ON "MemberEmail"("idempotencyKey");
CREATE INDEX "MemberEmail_userId_createdAt_idx" ON "MemberEmail"("userId", "createdAt");
CREATE INDEX "MemberEmail_status_createdAt_idx" ON "MemberEmail"("status", "createdAt");

ALTER TABLE "MemberContribution" ADD CONSTRAINT "MemberContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberWorkHour" ADD CONSTRAINT "MemberWorkHour_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberWorkHour" ADD CONSTRAINT "MemberWorkHour_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberKeyAssignment" ADD CONSTRAINT "MemberKeyAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberKeyAssignment" ADD CONSTRAINT "MemberKeyAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberEmail" ADD CONSTRAINT "MemberEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
