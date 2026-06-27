-- CreateTable
CREATE TABLE "LeetCodeStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalSolved" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "easySolved" INTEGER NOT NULL DEFAULT 0,
    "mediumSolved" INTEGER NOT NULL DEFAULT 0,
    "hardSolved" INTEGER NOT NULL DEFAULT 0,
    "ranking" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeetCodeStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeforcesStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "rank" TEXT NOT NULL DEFAULT '',
    "maxRating" INTEGER NOT NULL DEFAULT 0,
    "maxRank" TEXT NOT NULL DEFAULT '',
    "contribution" INTEGER NOT NULL DEFAULT 0,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeforcesStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodechefStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "rating" TEXT NOT NULL DEFAULT '0',
    "globalRank" TEXT NOT NULL DEFAULT 'N/A',
    "countryRank" TEXT NOT NULL DEFAULT 'N/A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodechefStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeeksforgeeksStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "codingScore" TEXT NOT NULL DEFAULT '0',
    "problemsSolved" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeeksforgeeksStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeetCodeStats_userId_key" ON "LeetCodeStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeforcesStats_userId_key" ON "CodeforcesStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CodechefStats_userId_key" ON "CodechefStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GeeksforgeeksStats_userId_key" ON "GeeksforgeeksStats"("userId");

-- AddForeignKey
ALTER TABLE "LeetCodeStats" ADD CONSTRAINT "LeetCodeStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeforcesStats" ADD CONSTRAINT "CodeforcesStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodechefStats" ADD CONSTRAINT "CodechefStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeeksforgeeksStats" ADD CONSTRAINT "GeeksforgeeksStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
