-- CreateTable
CREATE TABLE "LeetCodeHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSolved" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "easySolved" INTEGER NOT NULL DEFAULT 0,
    "mediumSolved" INTEGER NOT NULL DEFAULT 0,
    "hardSolved" INTEGER NOT NULL DEFAULT 0,
    "ranking" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "contestRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contestGlobalRanking" INTEGER NOT NULL DEFAULT 0,
    "contestTopPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attendedContestsCount" INTEGER NOT NULL DEFAULT 0,
    "problemsSolvedList" JSONB,
    "contestHistory" JSONB,
    "skillStats" JSONB,
    "languageStats" JSONB,

    CONSTRAINT "LeetCodeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeetCodeHistory_userId_idx" ON "LeetCodeHistory"("userId");

-- CreateIndex
CREATE INDEX "LeetCodeHistory_userId_snapshotAt_idx" ON "LeetCodeHistory"("userId", "snapshotAt");
