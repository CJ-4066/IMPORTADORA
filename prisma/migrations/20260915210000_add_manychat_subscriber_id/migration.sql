ALTER TABLE "ChatContact"
ADD COLUMN "manychatSubscriberId" VARCHAR(120);

CREATE UNIQUE INDEX "ChatContact_manychatSubscriberId_key"
ON "ChatContact"("manychatSubscriberId");
