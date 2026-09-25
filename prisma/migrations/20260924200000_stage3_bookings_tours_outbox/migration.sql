-- CreateEnum
CREATE TYPE "IntegrationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "TourRequest" DROP CONSTRAINT "TourRequest_clientId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMPTZ(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "TourRequest" ADD COLUMN     "consentAt" TIMESTAMPTZ(3),
ADD COLUMN     "googleCalendarEventId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "requestNumber" SERIAL NOT NULL,
ADD COLUMN     "scheduledEnd" TIMESTAMPTZ(3),
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "status" "IntegrationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationJob_idempotencyKey_key" ON "IntegrationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "IntegrationJob_status_nextAttemptAt_idx" ON "IntegrationJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IntegrationJob_entityType_entityId_idx" ON "IntegrationJob"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TourRequest_requestNumber_key" ON "TourRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TourRequest_idempotencyKey_key" ON "TourRequest"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "TourRequest" ADD CONSTRAINT "TourRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill for any existing tour requests (15-minute tours), then enforce NOT NULL.
UPDATE "TourRequest" SET "scheduledEnd" = "scheduledAt" + interval '15 minutes' WHERE "scheduledEnd" IS NULL;
ALTER TABLE "TourRequest" ALTER COLUMN "scheduledEnd" SET NOT NULL;

-- ─── Integrity constraints not expressible in Prisma schema ─────────────────

-- Tours are hosted by one person: two non-cancelled tours may not overlap.
ALTER TABLE "TourRequest" ADD CONSTRAINT "TourRequest_no_overlap"
  EXCLUDE USING gist (tstzrange("scheduledAt", "scheduledEnd", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED');
ALTER TABLE "TourRequest" ADD CONSTRAINT "TourRequest_time_order_check" CHECK ("scheduledEnd" > "scheduledAt");

ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_attempts_check"
  CHECK ("attempts" >= 0 AND "maxAttempts" > 0);

-- ─── Data ───────────────────────────────────────────────────────────────────

-- Kazakh name of the small room chosen by the owner (only if not edited in the CRM).
UPDATE "Room" SET "nameKk" = 'Кіші бөлме' WHERE "slug" = 'small' AND "nameKk" IN ('Кішкентай бөлме', 'Кішкентай қоршағын');
