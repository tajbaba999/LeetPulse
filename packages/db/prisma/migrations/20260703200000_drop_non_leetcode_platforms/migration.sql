-- Drop non-LeetCode platform stats tables (never used, LeetCode-only scope)
DROP TABLE IF EXISTS "CodeforcesStats";
DROP TABLE IF EXISTS "CodechefStats";
DROP TABLE IF EXISTS "GeeksforgeeksStats";

-- Remove non-LeetCode columns from CodingProfiles
ALTER TABLE "CodingProfiles" DROP COLUMN IF EXISTS "codeforces";
ALTER TABLE "CodingProfiles" DROP COLUMN IF EXISTS "codechef";
ALTER TABLE "CodingProfiles" DROP COLUMN IF EXISTS "hackerrank";
ALTER TABLE "CodingProfiles" DROP COLUMN IF EXISTS "geeksforgeeks";
