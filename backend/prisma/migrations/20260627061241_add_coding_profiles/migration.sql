-- CreateTable
CREATE TABLE "CodingProfiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leetcode" TEXT,
    "codeforces" TEXT,
    "codechef" TEXT,
    "hackerrank" TEXT,
    "geeksforgeeks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingProfiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodingProfiles_userId_key" ON "CodingProfiles"("userId");

-- AddForeignKey
ALTER TABLE "CodingProfiles" ADD CONSTRAINT "CodingProfiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
