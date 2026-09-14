-- Create Enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsappIntegrationStatus') THEN
        CREATE TYPE "WhatsappIntegrationStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'REVOKED');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "WhatsappIntegration" (
    "id" TEXT NOT NULL,
    "businessId" VARCHAR(120) NOT NULL,
    "wabaId" VARCHAR(120) NOT NULL,
    "phoneNumberId" VARCHAR(120) NOT NULL,
    "displayPhoneNumber" VARCHAR(40),
    "verifiedName" VARCHAR(180),
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenType" VARCHAR(40) NOT NULL DEFAULT 'Bearer',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WhatsappIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedByUserId" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappIntegration_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WhatsappIntegration_businessId_wabaId_phoneNumberId_key') THEN
        CREATE UNIQUE INDEX "WhatsappIntegration_businessId_wabaId_phoneNumberId_key" ON "WhatsappIntegration"("businessId", "wabaId", "phoneNumberId");
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WhatsappIntegration_businessId_idx') THEN
        CREATE INDEX "WhatsappIntegration_businessId_idx" ON "WhatsappIntegration"("businessId");
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WhatsappIntegration_wabaId_idx') THEN
        CREATE INDEX "WhatsappIntegration_wabaId_idx" ON "WhatsappIntegration"("wabaId");
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WhatsappIntegration_phoneNumberId_idx') THEN
        CREATE INDEX "WhatsappIntegration_phoneNumberId_idx" ON "WhatsappIntegration"("phoneNumberId");
    END IF;
END$$;
