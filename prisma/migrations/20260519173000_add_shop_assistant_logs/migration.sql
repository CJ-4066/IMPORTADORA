-- CreateTable
CREATE TABLE "ShopAssistantLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "userMessage" TEXT NOT NULL,
    "baseReply" TEXT,
    "finalReply" TEXT,
    "intent" TEXT,
    "usedOllama" BOOLEAN NOT NULL DEFAULT false,
    "ollamaModel" TEXT,
    "ollamaLatencyMs" INTEGER,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "productIds" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopAssistantLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopAssistantLog_sessionId_idx" ON "ShopAssistantLog"("sessionId");

-- CreateIndex
CREATE INDEX "ShopAssistantLog_createdAt_idx" ON "ShopAssistantLog"("createdAt");
