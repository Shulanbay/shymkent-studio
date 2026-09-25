-- Required for the room-overlap exclusion constraint below (trusted extension, PG13+).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'EDITOR');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('RU', 'KK');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'OFFER_SENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'CONTACTED', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('KASPI', 'CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ProductionTaskType" AS ENUM ('PREPARATION', 'RECORDING', 'EDITING', 'THUMBNAIL', 'SHORTS', 'REVIEW', 'DELIVERY', 'PUBLISHING');

-- CreateEnum
CREATE TYPE "ProductionTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('NEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'RU',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "assignedToId" TEXT,
    "lostReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "googleColorId" TEXT,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT NOT NULL,
    "descriptionRu" TEXT NOT NULL,
    "descriptionKk" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "defaultDuration" INTEGER NOT NULL,
    "maxDuration" INTEGER NOT NULL,
    "extraStepMinutes" INTEGER,
    "extraStepPrice" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "blockedFrom" TIMESTAMPTZ(3) NOT NULL,
    "blockedUntil" TIMESTAMPTZ(3) NOT NULL,
    "participants" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "source" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'RU',
    "totalAmount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "assignedToId" TEXT,
    "googleCalendarEventId" TEXT,
    "internalNotes" TEXT,
    "materialsUrl" TEXT,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "refundAmount" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "paymentUrl" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "ProductionTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProductionTaskStatus" NOT NULL DEFAULT 'TODO',
    "assignedToId" TEXT,
    "dueAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "format" TEXT,
    "status" "TourStatus" NOT NULL DEFAULT 'NEW',
    "locale" "Locale" NOT NULL DEFAULT 'RU',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TourRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_normalizedPhone_key" ON "Client"("normalizedPhone");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_roomId_startAt_idx" ON "Booking"("roomId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_startAt_idx" ON "Booking"("startAt");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "ProductionTask_bookingId_idx" ON "ProductionTask"("bookingId");

-- CreateIndex
CREATE INDEX "ProductionTask_assignedToId_status_idx" ON "ProductionTask"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "TourRequest_scheduledAt_idx" ON "TourRequest"("scheduledAt");

-- CreateIndex
CREATE INDEX "TourRequest_status_idx" ON "TourRequest"("status");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourRequest" ADD CONSTRAINT "TourRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Integrity constraints not expressible in Prisma schema ─────────────────

-- A room can never hold two non-cancelled bookings whose blocked ranges
-- (booking time + room buffers) overlap. Ranges are half-open, so back-to-back
-- bookings are allowed. This is the last line of defence against double
-- booking, independent of application-level checks and race conditions.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_room_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("blockedFrom", "blockedUntil", '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED');

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_time_order_check"
  CHECK ("endAt" > "startAt" AND "blockedFrom" <= "startAt" AND "blockedUntil" >= "endAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_participants_check" CHECK ("participants" > 0);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_amounts_check"
  CHECK ("totalAmount" >= 0 AND "paidAmount" >= 0 AND ("refundAmount" IS NULL OR "refundAmount" >= 0));
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Room" ADD CONSTRAINT "Room_values_check"
  CHECK ("capacity" > 0 AND "bufferBeforeMinutes" >= 0 AND "bufferAfterMinutes" >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_values_check"
  CHECK ("basePrice" >= 0 AND "defaultDuration" > 0 AND "maxDuration" >= "defaultDuration");
