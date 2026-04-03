-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopStorageConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'disconnected',
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "accountId" TEXT,
    "bucketName" TEXT,
    "publicBaseUrl" TEXT,
    "accessKeyIdEnc" TEXT,
    "secretAccessKeyEnc" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "errorType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopStorageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCatalogConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "stemsAddonProductId" TEXT,
    "stemsAddonVariantId" TEXT,
    "stemsAddonHandle" TEXT,
    "stemsAddonTitle" TEXT,
    "stemsAddonPrice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCatalogConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatFile" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT '',
    "beatId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileType" TEXT NOT NULL,
    "filePurpose" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeatFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatDraft" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bpm" INTEGER,
    "key" TEXT,
    "producerAlias" TEXT,
    "genreGidsJson" TEXT NOT NULL DEFAULT '[]',
    "producerGidsJson" TEXT NOT NULL DEFAULT '[]',
    "licenseFilesJson" TEXT NOT NULL DEFAULT '{}',
    "licensePricesJson" TEXT NOT NULL DEFAULT '{}',
    "stemsAddonSelectionsJson" TEXT NOT NULL DEFAULT '{}',
    "uploadedFilesJson" TEXT NOT NULL DEFAULT '[]',
    "previewFileJson" TEXT,
    "coverArtFileJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeatDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseFileMapping" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseFileMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "browserIp" TEXT,
    "userAgent" TEXT,
    "acceptLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shopifyLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "beatTitle" TEXT NOT NULL,
    "licenseName" TEXT NOT NULL,
    "stemsIncludedInOrder" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutedAgreement" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "templateMetaobjectId" TEXT,
    "templateHandle" TEXT NOT NULL,
    "offerArchetype" TEXT NOT NULL,
    "templateVersion" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedTemplateVersion" TEXT,
    "acceptedTemplateHash" TEXT,
    "acceptedLicenseName" TEXT,
    "acceptedDeliveryPackage" TEXT,
    "acceptedProofJson" TEXT,
    "acceptedSnapshotMatch" BOOLEAN,
    "resolvedLicenseJson" TEXT NOT NULL,
    "beatOfferSnapshotJson" TEXT NOT NULL,
    "stemsIncludedInOrder" BOOLEAN NOT NULL DEFAULT false,
    "licensorSnapshotJson" TEXT NOT NULL,
    "renderedHtml" TEXT NOT NULL,
    "htmlHash" TEXT NOT NULL,
    "pdfData" BYTEA,
    "pdfHash" TEXT,
    "pdfStatus" TEXT NOT NULL DEFAULT 'pending',
    "pdfError" TEXT,
    "buyerEmail" TEXT,
    "buyerIp" TEXT,
    "userAgent" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutedAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAccess" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "downloadToken" TEXT NOT NULL,
    "deliveryEmailStatus" TEXT NOT NULL DEFAULT 'pending',
    "deliveryEmailSentAt" TIMESTAMP(3),
    "deliveryEmailError" TEXT,
    "deliveryEmailRecipient" TEXT,
    "deliveryEmailMessageId" TEXT,
    "deliveryEmailConfirmedStatus" TEXT,
    "deliveryEmailConfirmedAt" TIMESTAMP(3),
    "deliveryEmailConfirmedError" TEXT,
    "deliveryEmailLastEvent" TEXT,
    "deliveryEmailLastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyDataRequest" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyDataRequestId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT,
    "customerEmail" TEXT,
    "ordersRequestedJson" TEXT NOT NULL DEFAULT '[]',
    "requestPayloadJson" TEXT NOT NULL,
    "exportJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyDataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateGuardrailAcceptance" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "templateHandle" TEXT NOT NULL,
    "templateMetaobjectId" TEXT NOT NULL,
    "starterVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "acceptedByUserId" BIGINT,
    "acceptedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateGuardrailAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE INDEX "Session_shop_expires_idx" ON "Session"("shop", "expires");

-- CreateIndex
CREATE UNIQUE INDEX "ShopStorageConfig_shop_key" ON "ShopStorageConfig"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCatalogConfig_shop_key" ON "ShopCatalogConfig"("shop");

-- CreateIndex
CREATE INDEX "BeatFile_beatId_idx" ON "BeatFile"("beatId");

-- CreateIndex
CREATE INDEX "BeatFile_beatId_filePurpose_idx" ON "BeatFile"("beatId", "filePurpose");

-- CreateIndex
CREATE INDEX "BeatFile_shop_idx" ON "BeatFile"("shop");

-- CreateIndex
CREATE INDEX "BeatFile_shop_beatId_filePurpose_idx" ON "BeatFile"("shop", "beatId", "filePurpose");

-- CreateIndex
CREATE INDEX "BeatDraft_shop_idx" ON "BeatDraft"("shop");

-- CreateIndex
CREATE INDEX "BeatDraft_shop_updatedAt_idx" ON "BeatDraft"("shop", "updatedAt");

-- CreateIndex
CREATE INDEX "LicenseFileMapping_variantId_idx" ON "LicenseFileMapping"("variantId");

-- CreateIndex
CREATE INDEX "LicenseFileMapping_fileId_idx" ON "LicenseFileMapping"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "Order_shop_shopifyOrderId_idx" ON "Order"("shop", "shopifyOrderId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutedAgreement_orderItemId_key" ON "ExecutedAgreement"("orderItemId");

-- CreateIndex
CREATE INDEX "ExecutedAgreement_shop_idx" ON "ExecutedAgreement"("shop");

-- CreateIndex
CREATE INDEX "ExecutedAgreement_orderId_idx" ON "ExecutedAgreement"("orderId");

-- CreateIndex
CREATE INDEX "ExecutedAgreement_templateHandle_idx" ON "ExecutedAgreement"("templateHandle");

-- CreateIndex
CREATE INDEX "ExecutedAgreement_purchasedAt_idx" ON "ExecutedAgreement"("purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAccess_orderId_key" ON "DeliveryAccess"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAccess_downloadToken_key" ON "DeliveryAccess"("downloadToken");

-- CreateIndex
CREATE INDEX "DeliveryAccess_shop_idx" ON "DeliveryAccess"("shop");

-- CreateIndex
CREATE INDEX "DeliveryAccess_downloadToken_idx" ON "DeliveryAccess"("downloadToken");

-- CreateIndex
CREATE INDEX "PrivacyDataRequest_shop_status_idx" ON "PrivacyDataRequest"("shop", "status");

-- CreateIndex
CREATE INDEX "PrivacyDataRequest_shop_customerEmail_idx" ON "PrivacyDataRequest"("shop", "customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyDataRequest_shop_shopifyDataRequestId_key" ON "PrivacyDataRequest"("shop", "shopifyDataRequestId");

-- CreateIndex
CREATE INDEX "TemplateGuardrailAcceptance_shop_idx" ON "TemplateGuardrailAcceptance"("shop");

-- CreateIndex
CREATE INDEX "TemplateGuardrailAcceptance_templateHandle_idx" ON "TemplateGuardrailAcceptance"("templateHandle");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateGuardrailAcceptance_shop_templateHandle_starterVers_key" ON "TemplateGuardrailAcceptance"("shop", "templateHandle", "starterVersion");

-- AddForeignKey
ALTER TABLE "LicenseFileMapping" ADD CONSTRAINT "LicenseFileMapping_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "BeatFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutedAgreement" ADD CONSTRAINT "ExecutedAgreement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutedAgreement" ADD CONSTRAINT "ExecutedAgreement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAccess" ADD CONSTRAINT "DeliveryAccess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
