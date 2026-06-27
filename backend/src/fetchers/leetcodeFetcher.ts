import { gql, GraphQLClient } from "graphql-request";

import type {
  LeetCodeCalendar,
  LeetCodeContestHistoryEntry,
  LeetCodeContestInfo,
  LeetCodeLanguageStats,
  LeetCodeProfile,
  LeetCodeQuestionProgress,
  LeetCodeSkillStats,
  LeetCodeSyncResult,
} from "../types/coding-profiles.js";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const client = new GraphQLClient(LEETCODE_GRAPHQL, {
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://leetcode.com",
  },
});

// ── Query 1: getUserProfile — core stats + recent submissions ──

const GET_USER_PROFILE = gql`
  query getUserProfile($username: String!) {
    allQuestionsCount {
      difficulty
      count
    }
    matchedUser(username: $username) {
      contributions {
        points
      }
      profile {
        reputation
        ranking
      }
      submissionCalendar
      submitStats {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
        totalSubmissionNum {
          difficulty
          count
          submissions
        }
      }
    }
    recentSubmissionList(username: $username, limit: 20) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
    matchedUserStats: matchedUser(username: $username) {
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
        totalSubmissionNum {
          difficulty
          count
          submissions
        }
      }
    }
  }
`;

type UserProfileResponse = {
  allQuestionsCount: Array<{ difficulty: string; count: number }>;
  matchedUser: {
    contributions: { points: number };
    profile: { reputation: number; ranking: number };
    submissionCalendar: string;
    submitStats: {
      acSubmissionNum: Array<{ difficulty: string; count: number; submissions: number }>;
      totalSubmissionNum: Array<{ difficulty: string; count: number; submissions: number }>;
    };
  } | null;
  recentSubmissionList: Array<{
    title: string;
    titleSlug: string;
    timestamp: string;
    statusDisplay: string;
    lang: string;
  }>;
  matchedUserStats: {
    submitStats: {
      acSubmissionNum: Array<{ difficulty: string; count: number; submissions: number }>;
      totalSubmissionNum: Array<{ difficulty: string; count: number; submissions: number }>;
    };
  } | null;
};

// ── Query 2: userContestRankingInfo — contest ranking + history ──

const GET_CONTEST_RANKING = gql`
  query userContestRankingInfo($username: String!) {
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
      topPercentage
      badge {
        name
      }
    }
    userContestRankingHistory(username: $username) {
      attended
      trendDirection
      problemsSolved
      totalProblems
      finishTimeInSeconds
      rating
      ranking
      contest {
        title
        startTime
      }
    }
  }
`;

type ContestRankingResponse = {
  userContestRanking: {
    attendedContestsCount: number;
    rating: number;
    globalRanking: number;
    totalParticipants: number;
    topPercentage: number;
    badge: { name: string } | null;
  } | null;
  userContestRankingHistory: Array<{
    attended: boolean;
    trendDirection: string;
    problemsSolved: number;
    totalProblems: number;
    finishTimeInSeconds: number;
    rating: number;
    ranking: number;
    contest: { title: string; startTime: number };
  }>;
};

// ── Query 3: userProfileUserQuestionProgressV2 — accepted/failed/untouched ──

const GET_QUESTION_PROGRESS = gql`
  query userProfileUserQuestionProgressV2($username: String!) {
    userProfileUserQuestionProgressV2(userSlug: $username) {
      numAcceptedQuestions {
        count
        difficulty
      }
      numFailedQuestions {
        count
        difficulty
      }
      numUntouchedQuestions {
        count
        difficulty
      }
      userSessionBeatsPercentage {
        difficulty
        percentage
      }
    }
  }
`;

type QuestionProgressResponse = {
  userProfileUserQuestionProgressV2: {
    numAcceptedQuestions: Array<{ count: number; difficulty: string }>;
    numFailedQuestions: Array<{ count: number; difficulty: string }>;
    numUntouchedQuestions: Array<{ count: number; difficulty: string }>;
    userSessionBeatsPercentage: Array<{ difficulty: string; percentage: number }>;
  } | null;
};

// ── Query 4: skillStats — tag-based problem counts ──

const GET_SKILL_STATS = gql`
  query skillStats($username: String!) {
    matchedUser(username: $username) {
      tagProblemCounts {
        advanced {
          tagName
          tagSlug
          problemsSolved
        }
        intermediate {
          tagName
          tagSlug
          problemsSolved
        }
        fundamental {
          tagName
          tagSlug
          problemsSolved
        }
      }
    }
  }
`;

type SkillStatsResponse = {
  matchedUser: {
    tagProblemCounts: {
      advanced: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
      intermediate: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
      fundamental: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
    };
  } | null;
};

// ── Query 5: languageStats — language-wise solved counts ──

const GET_LANGUAGE_STATS = gql`
  query languageStats($username: String!) {
    matchedUser(username: $username) {
      languageProblemCount {
        languageName
        problemsSolved
      }
    }
  }
`;

type LanguageStatsResponse = {
  matchedUser: {
    languageProblemCount: Array<{ languageName: string; problemsSolved: number }>;
  } | null;
};

// ── Query 6: UserProfileCalendar — streak + active days ──

const GET_CALENDAR = gql`
  query UserProfileCalendar($username: String!, $year: Int!) {
    matchedUser(username: $username) {
      userCalendar(year: $year) {
        activeYears
        streak
        totalActiveDays
        submissionCalendar
      }
    }
  }
`;

type CalendarResponse = {
  matchedUser: {
    userCalendar: {
      activeYears: number[];
      streak: number;
      totalActiveDays: number;
      submissionCalendar: Record<string, number>;
    } | null;
  } | null;
};

// ── Helper: parse submission calendar (API returns JSON string) ──

function parseCalendar(raw: string | Record<string, number> | undefined): Record<string, number> {
  if (!raw)
    return {};
  if (typeof raw === "object")
    return raw;
  try {
    return JSON.parse(raw);
  }
  catch {
    return {};
  }
}

// ── Helper: calculate streak from submission calendar ──

function calculateStreak(submissionCalendar: Record<string, number>): number {
  const todayDay = Math.floor(Date.now() / 1000 / 86400);
  let streak = 0;
  let day = todayDay;
  while ((submissionCalendar[String(day * 86400)] ?? 0) > 0) {
    streak++;
    day--;
  }
  return streak;
}

// ── Individual fetch functions ──

export async function fetchLeetCodeProfile(username: string): Promise<LeetCodeProfile> {
  const data = await client.request<UserProfileResponse>(GET_USER_PROFILE, { username });

  if (!data.matchedUser) {
    throw new Error(`LeetCode user "${username}" not found`);
  }

  const acStats = data.matchedUser.submitStats.acSubmissionNum;
  const totalStats = data.matchedUserStats?.submitStats.totalSubmissionNum;

  const acTotal = acStats.find(s => s.difficulty === "All");
  const acEasy = acStats.find(s => s.difficulty === "Easy");
  const acMedium = acStats.find(s => s.difficulty === "Medium");
  const acHard = acStats.find(s => s.difficulty === "Hard");

  const totalAll = totalStats?.find(s => s.difficulty === "All");

  return {
    username,
    totalSolved: acTotal?.count ?? 0,
    totalQuestions: data.allQuestionsCount.find(q => q.difficulty === "All")?.count ?? 0,
    easySolved: acEasy?.count ?? 0,
    mediumSolved: acMedium?.count ?? 0,
    hardSolved: acHard?.count ?? 0,
    ranking: data.matchedUser.profile.ranking,
    acceptanceRate: acTotal ? (acTotal.count / (acTotal.submissions || 1)) * 100 : 0,
    streak: calculateStreak(parseCalendar(data.matchedUser.submissionCalendar)),
    totalSubmissions: totalAll?.submissions ?? 0,
    recentSubmissions: data.recentSubmissionList ?? [],
  };
}

export async function fetchLeetCodeContest(
  username: string,
): Promise<{ info: LeetCodeContestInfo; history: LeetCodeContestHistoryEntry[] }> {
  const data = await client.request<ContestRankingResponse>(GET_CONTEST_RANKING, { username });

  const info: LeetCodeContestInfo = data.userContestRanking
    ? {
        attendedContestsCount: data.userContestRanking.attendedContestsCount,
        rating: data.userContestRanking.rating,
        globalRanking: data.userContestRanking.globalRanking,
        totalParticipants: data.userContestRanking.totalParticipants,
        topPercentage: data.userContestRanking.topPercentage,
        badge: data.userContestRanking.badge?.name ?? null,
      }
    : {
        attendedContestsCount: 0,
        rating: 0,
        globalRanking: 0,
        totalParticipants: 0,
        topPercentage: 0,
        badge: null,
      };

  const history: LeetCodeContestHistoryEntry[] = (data.userContestRankingHistory ?? []).map(
    entry => ({
      attended: entry.attended,
      rating: entry.rating,
      ranking: entry.ranking,
      trendDirection: entry.trendDirection,
      problemsSolved: entry.problemsSolved,
      totalProblems: entry.totalProblems,
      finishTimeInSeconds: entry.finishTimeInSeconds,
      contest: {
        title: entry.contest.title,
        startTime: entry.contest.startTime,
      },
    }),
  );

  return { info, history };
}

export async function fetchLeetCodeQuestionProgress(
  username: string,
): Promise<LeetCodeQuestionProgress> {
  const data = await client.request<QuestionProgressResponse>(GET_QUESTION_PROGRESS, { username });

  if (!data.userProfileUserQuestionProgressV2) {
    throw new Error(`Question progress not found for "${username}"`);
  }

  return {
    numAcceptedQuestions: data.userProfileUserQuestionProgressV2.numAcceptedQuestions,
    numFailedQuestions: data.userProfileUserQuestionProgressV2.numFailedQuestions,
    numUntouchedQuestions: data.userProfileUserQuestionProgressV2.numUntouchedQuestions,
    userSessionBeatsPercentage:
      data.userProfileUserQuestionProgressV2.userSessionBeatsPercentage,
  };
}

export async function fetchLeetCodeSkillStats(username: string): Promise<LeetCodeSkillStats> {
  const data = await client.request<SkillStatsResponse>(GET_SKILL_STATS, { username });

  if (!data.matchedUser) {
    throw new Error(`Skill stats not found for "${username}"`);
  }

  return {
    fundamental: data.matchedUser.tagProblemCounts.fundamental,
    intermediate: data.matchedUser.tagProblemCounts.intermediate,
    advanced: data.matchedUser.tagProblemCounts.advanced,
  };
}

export async function fetchLeetCodeLanguageStats(
  username: string,
): Promise<LeetCodeLanguageStats[]> {
  const data = await client.request<LanguageStatsResponse>(GET_LANGUAGE_STATS, { username });

  return data.matchedUser?.languageProblemCount ?? [];
}

export async function fetchLeetCodeCalendar(
  username: string,
  year: number,
): Promise<LeetCodeCalendar> {
  const data = await client.request<CalendarResponse>(GET_CALENDAR, { username, year });

  const calendar = data.matchedUser?.userCalendar;
  const rawCalendar = calendar?.submissionCalendar;

  // submissionCalendar comes as a JSON string from the API
  let parsedCalendar: Record<string, number> = {};
  if (typeof rawCalendar === "string") {
    try {
      parsedCalendar = JSON.parse(rawCalendar);
    }
    catch { /* ignore */ }
  }
  else if (rawCalendar && typeof rawCalendar === "object") {
    parsedCalendar = rawCalendar as Record<string, number>;
  }

  return {
    activeYears: calendar?.activeYears ?? [],
    streak: calendar?.streak ?? 0,
    totalActiveDays: calendar?.totalActiveDays ?? 0,
    submissionCalendar: parsedCalendar,
  };
}

// ── Combined sync function ──

export async function fetchLeetCodeFullSync(username: string): Promise<LeetCodeSyncResult> {
  const currentYear = new Date().getFullYear();

  const [profile, contest, questionProgress, skillStats, languageStats, calendar]
    = await Promise.all([
      fetchLeetCodeProfile(username),
      fetchLeetCodeContest(username),
      fetchLeetCodeQuestionProgress(username),
      fetchLeetCodeSkillStats(username),
      fetchLeetCodeLanguageStats(username),
      fetchLeetCodeCalendar(username, currentYear),
    ]);

  return { profile, contest, questionProgress, skillStats, languageStats, calendar };
}
