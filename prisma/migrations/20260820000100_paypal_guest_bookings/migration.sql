-- Allow bookings without a user account and retain only the contact details
-- needed to fulfil and manage the booking.
ALTER TABLE "Booking" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "bookingCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);

ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'paypal';
ALTER TABLE "Payment" ADD COLUMN "providerRefundId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Booking_bookingCode_key" ON "Booking"("bookingCode");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE UNIQUE INDEX "Payment_providerSessionId_key" ON "Payment"("providerSessionId");
CREATE UNIQUE INDEX "Payment_providerRefundId_key" ON "Payment"("providerRefundId");

CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paypal',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentEvent_eventId_key" ON "PaymentEvent"("eventId");
