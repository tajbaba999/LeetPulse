-- AlterTable: Add contest summary and JSON columns to LeetCodeStats
ALTER TABLE "LeetCodeStats" ADD COLUMN "contestRating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeetCodeStats" ADD COLUMN "contestGlobalRanking" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeetCodeStats" ADD COLUMN "contestTopPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeetCodeStats" ADD COLUMN "attendedContestsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeetCodeStats" ADD COLUMN "questionProgress" JSONB;
ALTER TABLE "LeetCodeStats" ADD COLUMN "skillStats" JSONB;
ALTER TABLE "LeetCodeStats" ADD COLUMN "languageStats" JSONB;
ALTER TABLE "LeetCodeStats" ADD COLUMN "recentSubmissions" JSONB;
ALTER TABLE "LeetCodeStats" ADD COLUMN "calendarData" JSONB;

-- CreateTable: LeetCodeContestHistory
CREATE TABLE "LeetCodeContestHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestTitle" TEXT NOT NULL,
    "startTime" INTEGER NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "ranking" INTEGER NOT NULL,
    "trendDirection" TEXT NOT NULL DEFAULT '',
    "problemsSolved" INTEGER NOT NULL DEFAULT 0,
    "totalProblems" INTEGER NOT NULL DEFAULT 0,
    "finishTimeInSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeetCodeContestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on userId + contestTitle
CREATE UNIQUE INDEX "LeetCodeContestHistory_userId_contestTitle_key" ON "LeetCodeContestHistory"("userId", "contestTitle");

-- CreateIndex: Index on userId for fast lookups
CREATE INDEX "LeetCodeContestHistory_userId_idx" ON "LeetCodeContestHistory"("userId");
