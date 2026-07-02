-- CreateTable LeetCodeProblem
CREATE TABLE "LeetCodeProblem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questionStatus" TEXT NOT NULL,
    "lastResult" TEXT NOT NULL,
    "lastSubmittedAt" TEXT NOT NULL,
    "numSubmitted" INTEGER NOT NULL DEFAULT 0,
    "topicTags" JSONB NOT NULL,

    CONSTRAINT "LeetCodeProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for LeetCodeProblem
CREATE UNIQUE INDEX "LeetCodeProblem_userId_titleSlug_key" ON "LeetCodeProblem"("userId", "titleSlug");
CREATE INDEX "LeetCodeProblem_userId_idx" ON "LeetCodeProblem"("userId");

-- CreateTable RagChunkHash
CREATE TABLE "RagChunkHash" (
    "userId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagChunkHash_pkey" PRIMARY KEY ("userId", "chunkId")
);
