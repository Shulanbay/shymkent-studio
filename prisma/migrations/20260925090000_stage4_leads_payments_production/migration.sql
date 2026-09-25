-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('PAYMENT', 'REFUND', 'REVERSAL');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentLinkUrl" TEXT;

-- AlterTable
ALTER TABLE "IntegrationJob" ADD COLUMN     "providerRef" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "closedAt" TIMESTAMPTZ(3),
ADD COLUMN     "expectedAmount" INTEGER,
ADD COLUMN     "nextContactAt" TIMESTAMPTZ(3),
ADD COLUMN     "title" TEXT,
ADD COLUMN     "tourRequestId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'PAYMENT',
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "reversesId" TEXT,
ADD COLUMN     "signedAmount" INTEGER;

-- AlterTable
ALTER TABLE "ProductionTask" ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "materialsUrl" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "templateKey" TEXT;

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_tourRequestId_key" ON "Lead"("tourRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_bookingId_key" ON "Lead"("bookingId");

-- CreateIndex
CREATE INDEX "Lead_nextContactAt_idx" ON "Lead"("nextContactAt");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reversesId_key" ON "Payment"("reversesId");

-- CreateIndex
CREATE INDEX "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");

-- CreateIndex
CREATE INDEX "ProductionTask_status_dueAt_idx" ON "ProductionTask"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionTask_bookingId_templateKey_key" ON "ProductionTask"("bookingId", "templateKey");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tourRequestId_fkey" FOREIGN KEY ("tourRequestId") REFERENCES "TourRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProductionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing rows (if any) were plain incoming payments.
UPDATE "Payment" SET "signedAmount" = CASE WHEN "status" = 'REFUNDED' THEN -"amount" ELSE "amount" END WHERE "signedAmount" IS NULL;
UPDATE "Payment" SET "kind" = 'REFUND', "status" = 'PAID' WHERE "status" = 'REFUNDED';
ALTER TABLE "Payment" ALTER COLUMN "signedAmount" SET NOT NULL;

-- ─── Ledger integrity ────────────────────────────────────────────────────────

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_signed_amount_check"
  CHECK ("signedAmount" = "amount" OR "signedAmount" = -"amount");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_kind_direction_check"
  CHECK (
    ("kind" = 'PAYMENT' AND "signedAmount" > 0 AND "reversesId" IS NULL) OR
    ("kind" = 'REFUND' AND "signedAmount" < 0 AND "reversesId" IS NULL) OR
    ("kind" = 'REVERSAL' AND "reversesId" IS NOT NULL)
  );
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_expected_amount_check" CHECK ("expectedAmount" IS NULL OR "expectedAmount" >= 0);

-- Settled ledger rows are immutable: no deletes, no edits of money fields, no
-- status change away from PAID. Corrections are made with REVERSAL entries.
CREATE OR REPLACE FUNCTION payment_ledger_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'PAID' THEN
      RAISE EXCEPTION 'Settled payment % cannot be deleted; create a reversal instead', OLD."id" USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'PAID' AND (
       NEW."status" <> OLD."status" OR NEW."amount" <> OLD."amount" OR NEW."signedAmount" <> OLD."signedAmount"
       OR NEW."kind" <> OLD."kind" OR NEW."bookingId" <> OLD."bookingId" OR NEW."method" <> OLD."method"
       OR NEW."paidAt" IS DISTINCT FROM OLD."paidAt" OR NEW."reversesId" IS DISTINCT FROM OLD."reversesId") THEN
    RAISE EXCEPTION 'Settled payment % is immutable; create a reversal instead', OLD."id" USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_ledger_guard
  BEFORE UPDATE OR DELETE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION payment_ledger_guard();
