CREATE TABLE "TemplateGuardrailAcceptance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "templateHandle" TEXT NOT NULL,
    "templateMetaobjectId" TEXT NOT NULL,
    "starterVersion" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL,
    "acceptedByUserId" BIGINT,
    "acceptedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "TemplateGuardrailAcceptance_shop_templateHandle_starterVersion_key"
ON "TemplateGuardrailAcceptance"("shop", "templateHandle", "starterVersion");

CREATE INDEX "TemplateGuardrailAcceptance_shop_idx"
ON "TemplateGuardrailAcceptance"("shop");

CREATE INDEX "TemplateGuardrailAcceptance_templateHandle_idx"
ON "TemplateGuardrailAcceptance"("templateHandle");
