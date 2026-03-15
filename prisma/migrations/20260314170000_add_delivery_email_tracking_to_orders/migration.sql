ALTER TABLE "Order" ADD COLUMN "deliveryEmailStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Order" ADD COLUMN "deliveryEmailSentAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "deliveryEmailError" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryEmailRecipient" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryEmailMessageId" TEXT;
