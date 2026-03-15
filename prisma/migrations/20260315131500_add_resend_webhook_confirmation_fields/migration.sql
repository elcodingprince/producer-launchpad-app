ALTER TABLE "DeliveryAccess" ADD COLUMN "deliveryEmailConfirmedStatus" TEXT;
ALTER TABLE "DeliveryAccess" ADD COLUMN "deliveryEmailConfirmedAt" DATETIME;
ALTER TABLE "DeliveryAccess" ADD COLUMN "deliveryEmailConfirmedError" TEXT;
ALTER TABLE "DeliveryAccess" ADD COLUMN "deliveryEmailLastEvent" TEXT;
ALTER TABLE "DeliveryAccess" ADD COLUMN "deliveryEmailLastEventAt" DATETIME;
