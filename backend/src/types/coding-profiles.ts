export interface LeetCodeProfile {
  username: string;
  totalSolved: number;
  totalQuestions: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number;
  acceptanceRate: number;
  streak: number;
}

export interface CodeforcesProfile {
  username: string;
  rating: number;
  rank: string;
  maxRating: number;
  maxRank: string;
  contribution: number;
  solvedCount: number;
}

export interface CodechefProfile {
  username: string;
  name: string;
  rating: string;
  globalRank: string;
  countryRank: string;
}

export interface GfgProfile {
  username: string;
  name: string;
  codingScore: string;
  problemsSolved: string;
}

export type Platform = "leetcode" | "codeforces" | "codechef" | "geeksforgeeks";

export type SyncJobData = {
  userId: string;
  platform: Platform;
  username: string;
};
