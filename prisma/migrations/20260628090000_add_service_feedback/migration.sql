CREATE TABLE "ServiceFeedback" (
    "id" TEXT NOT NULL,
    "rating" VARCHAR(20) NOT NULL,
    "attendedBy" VARCHAR(180),
    "improvement" TEXT,
    "hadProblem" BOOLEAN NOT NULL,
    "problemDetail" TEXT,
    "wouldRecommend" BOOLEAN NOT NULL,
    "customerContact" VARCHAR(180),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceFeedback_createdAt_idx"
ON "ServiceFeedback"("createdAt" DESC);

CREATE INDEX "ServiceFeedback_rating_idx"
ON "ServiceFeedback"("rating");

CREATE INDEX "ServiceFeedback_hadProblem_idx"
ON "ServiceFeedback"("hadProblem");
