-- CreateTable
CREATE TABLE "ProductResearchRun" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestId" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "provider" VARCHAR(40) NOT NULL DEFAULT 'openai',
    "model" VARCHAR(80),
    "confidence" DOUBLE PRECISION,
    "identifiedBrand" VARCHAR(120),
    "identifiedModel" VARCHAR(180),
    "result" JSONB,
    "errorCode" VARCHAR(80),
    "errorMessage" TEXT,
    "requestedByName" VARCHAR(120),
    "requestedByEmail" VARCHAR(190),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProductResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductResearchSource" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "domain" VARCHAR(255),
    "sourceType" VARCHAR(40) NOT NULL DEFAULT 'WEB',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductResearchRun_requestId_key" ON "ProductResearchRun"("requestId");

-- CreateIndex
CREATE INDEX "ProductResearchRun_productId_createdAt_idx" ON "ProductResearchRun"("productId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProductResearchRun_status_createdAt_idx" ON "ProductResearchRun"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProductResearchSource_runId_idx" ON "ProductResearchSource"("runId");

-- CreateIndex
CREATE INDEX "ProductResearchSource_domain_idx" ON "ProductResearchSource"("domain");

-- AddForeignKey
ALTER TABLE "ProductResearchRun" ADD CONSTRAINT "ProductResearchRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductResearchSource" ADD CONSTRAINT "ProductResearchSource_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
