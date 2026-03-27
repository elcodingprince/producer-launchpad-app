-- AlterTable
ALTER TABLE "ExecutedAgreement" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "ExecutedAgreement" ADD COLUMN "acceptedTemplateVersion" TEXT;
ALTER TABLE "ExecutedAgreement" ADD COLUMN "acceptedTemplateHash" TEXT;
ALTER TABLE "ExecutedAgreement" ADD COLUMN "acceptedLicenseName" TEXT;
ALTER TABLE "ExecutedAgreement" ADD COLUMN "acceptedDeliveryPackage" TEXT;
ALTER TABLE "ExecutedAgreement" ADD COLUMN "acceptedProofJson" TEXT;
ALTER TABLE "ExecutedAgreement" ADD COLUMN "acceptedSnapshotMatch" BOOLEAN;
