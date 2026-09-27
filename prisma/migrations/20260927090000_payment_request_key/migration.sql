-- Idempotency key of the CRM form that recorded a payment or refund. A repeated
-- submission (double click, network retry) with the same key returns the entry
-- that was already recorded instead of adding the money twice.
ALTER TABLE "Payment" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "Payment_requestKey_key" ON "Payment"("requestKey");
