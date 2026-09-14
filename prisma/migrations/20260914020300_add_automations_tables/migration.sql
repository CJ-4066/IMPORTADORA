CREATE TABLE IF NOT EXISTS "Automation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "currentPublishedVersionId" TEXT,

  CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationVersion" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "flowData" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutomationVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationExecution" (
  "id" TEXT NOT NULL,
  "correlationId" TEXT,
  "messageId" TEXT,
  "conversationId" TEXT,
  "automationId" TEXT NOT NULL,
  "automationVersionId" TEXT NOT NULL,
  "providerExecutionId" TEXT,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AutomationVersion_automationId_fkey'
  ) THEN
    ALTER TABLE "AutomationVersion"
      ADD CONSTRAINT "AutomationVersion_automationId_fkey"
      FOREIGN KEY ("automationId") REFERENCES "Automation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AutomationExecution_automationId_fkey'
  ) THEN
    ALTER TABLE "AutomationExecution"
      ADD CONSTRAINT "AutomationExecution_automationId_fkey"
      FOREIGN KEY ("automationId") REFERENCES "Automation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AutomationExecution_automationVersionId_fkey'
  ) THEN
    ALTER TABLE "AutomationExecution"
      ADD CONSTRAINT "AutomationExecution_automationVersionId_fkey"
      FOREIGN KEY ("automationVersionId") REFERENCES "AutomationVersion"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AutomationExecution_conversationId_fkey'
  ) THEN
    ALTER TABLE "AutomationExecution"
      ADD CONSTRAINT "AutomationExecution_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
