ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AutomationVersion" RENAME COLUMN "flowData" TO "flowDefinition";
ALTER TABLE "AutomationVersion" ADD COLUMN IF NOT EXISTS "compiledHash" TEXT;
ALTER TABLE "AutomationVersion" ADD COLUMN IF NOT EXISTS "providerWorkflowId" TEXT;

CREATE INDEX IF NOT EXISTS "AutomationExecution_startedAt_idx" ON "AutomationExecution"("startedAt" DESC);
CREATE INDEX IF NOT EXISTS "AutomationExecution_automationId_idx" ON "AutomationExecution"("automationId");
