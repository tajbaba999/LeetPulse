import { GraphQLClient, gql } from "graphql-request";
import type { LeetCodeProfile } from "../types/coding-profiles.js";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const client = new GraphQLClient(LEETCODE_GRAPHQL, {
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    Referer: "https://leetcode.com",
  },
});

const USER_PROFILE_QUERY = gql`
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      username
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      profile {
        ranking
        acceptanceRate
      }
      submissionCalendar
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
    }
  }
`;

type LeetCodeGraphQLResponse = {
  matchedUser: {
    username: string;
    submitStats: {
      acSubmissionNum: Array<{
        difficulty: string;
        count: number;
        submissions: number;
      }>;
    };
    profile: {
      ranking: number;
      acceptanceRate: number;
    };
    submissionCalendar: string;
  } | null;
  userContestRanking: {
    attendedContestsCount: number;
    rating: number;
    globalRanking: number;
    totalParticipants: number;
  } | null;
};

// submissionCalendar is a JSON string: { "<unix-ts-seconds>": count, ... }
function calculateStreak(submissionCalendar: string): number {
  try {
    const calendar: Record<string, number> = JSON.parse(submissionCalendar);
    const todayDay = Math.floor(Date.now() / 1000 / 86400);
    let streak = 0;
    let day = todayDay;
    while ((calendar[String(day * 86400)] ?? 0) > 0) {
      streak++;
      day--;
    }
    return streak;
  } catch {
    return 0;
  }
}

export async function fetchLeetCodeProfile(username: string): Promise<LeetCodeProfile> {
  const data = await client.request<LeetCodeGraphQLResponse>(USER_PROFILE_QUERY, { username });

  if (!data.matchedUser) {
    throw new Error(`LeetCode user "${username}" not found`);
  }

  const stats = data.matchedUser.submitStats.acSubmissionNum;
  const total = stats.find(s => s.difficulty === "All");
  const easy = stats.find(s => s.difficulty === "Easy");
  const medium = stats.find(s => s.difficulty === "Medium");
  const hard = stats.find(s => s.difficulty === "Hard");

  return {
    username: data.matchedUser.username,
    totalSolved: total?.count ?? 0,
    totalQuestions: 0,
    easySolved: easy?.count ?? 0,
    mediumSolved: medium?.count ?? 0,
    hardSolved: hard?.count ?? 0,
    ranking: data.matchedUser.profile.ranking,
    acceptanceRate: data.matchedUser.profile.acceptanceRate,
    streak: calculateStreak(data.matchedUser.submissionCalendar),
  };
}
