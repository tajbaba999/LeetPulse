import { GraphQLClient } from "graphql-request";

import type {
  LeetCodeCalendar,
  LeetCodeContestHistoryEntry,
  LeetCodeContestInfo,
  LeetCodeLanguageStats,
  LeetCodeProfile,
  LeetCodeQuestionProgress,
  LeetCodeSessionProgress,
  LeetCodeSkillStats,
  LeetCodeSyncResult,
} from "../types/coding-profiles.js";

import { GET_CALENDAR } from "../api/leetcode/queries/calendar.query.js";
import { GET_CONTEST_RANKING } from "../api/leetcode/queries/contest.query.js";
import { GET_LANGUAGE_STATS } from "../api/leetcode/queries/language-stats.query.js";
import { GET_USER_PROFILE } from "../api/leetcode/queries/profile.query.js";
import { GET_QUESTION_PROGRESS } from "../api/leetcode/queries/question-progress.query.js";
import { GET_SESSION_PROGRESS } from "../api/leetcode/queries/session-progress.query.js";
import { GET_SKILL_STATS } from "../api/leetcode/queries/skill-stats.query.js";
import { GET_USER_PROGRESS_QUESTIONS } from "../api/leetcode/queries/user-progress-questions.query.js";

const client = new GraphQLClient("https://leetcode.com/graphql", {
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://leetcode.com",
  },
});

// ── Response types ──

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

type QuestionProgressResponse = {
  userProfileUserQuestionProgressV2: {
    numAcceptedQuestions: Array<{ count: number; difficulty: string }>;
    numFailedQuestions: Array<{ count: number; difficulty: string }>;
    numUntouchedQuestions: Array<{ count: number; difficulty: string }>;
    userSessionBeatsPercentage: Array<{ difficulty: string; percentage: number }>;
    totalQuestionBeatsPercentage: number;
  } | null;
};

type SessionProgressResponse = {
  allQuestionsCount: Array<{ difficulty: string; count: number }>;
  matchedUser: {
    submitStats: {
      acSubmissionNum: Array<{ difficulty: string; count: number; submissions: number }>;
      totalSubmissionNum: Array<{ difficulty: string; count: number; submissions: number }>;
    };
  } | null;
};

type SkillStatsResponse = {
  matchedUser: {
    tagProblemCounts: {
      advanced: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
      intermediate: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
      fundamental: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
    };
  } | null;
};

type LanguageStatsResponse = {
  matchedUser: {
    languageProblemCount: Array<{ languageName: string; problemsSolved: number }>;
  } | null;
};

type CalendarResponse = {
  matchedUser: {
    userCalendar: {
      activeYears: number[];
      streak: number;
      totalActiveDays: number;
      dccBadges: Array<{
        timestamp: number;
        badge: { name: string; icon: string };
      }>;
      submissionCalendar: string | Record<string, number>;
    } | null;
  } | null;
};

type UserProgressQuestionListResponse = {
  userProgressQuestionList: {
    totalNum: number;
    questions: Array<{
      translatedTitle: string | null;
      frontendId: string;
      title: string;
      titleSlug: string;
      difficulty: string;
      lastSubmittedAt: string | null;
      numSubmitted: number;
      questionStatus: string;
      lastResult: string;
      topicTags: Array<{ name: string; nameTranslated: string | null; slug: string }>;
    }>;
  } | null;
};

// ── Helpers ──

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

// ── Fetch functions ──

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
    userSessionBeatsPercentage: data.userProfileUserQuestionProgressV2.userSessionBeatsPercentage,
    totalQuestionBeatsPercentage: data.userProfileUserQuestionProgressV2.totalQuestionBeatsPercentage,
  };
}

export async function fetchLeetCodeSessionProgress(
  username: string,
): Promise<LeetCodeSessionProgress> {
  const data = await client.request<SessionProgressResponse>(GET_SESSION_PROGRESS, { username });

  if (!data.matchedUser) {
    throw new Error(`Session progress not found for "${username}"`);
  }

  return {
    allQuestionsCount: data.allQuestionsCount,
    acSubmissionNum: data.matchedUser.submitStats.acSubmissionNum,
    totalSubmissionNum: data.matchedUser.submitStats.totalSubmissionNum,
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
  year?: number,
): Promise<LeetCodeCalendar> {
  const data = await client.request<CalendarResponse>(GET_CALENDAR, { username, year: year ?? null });

  const calendar = data.matchedUser?.userCalendar;
  const rawCalendar = calendar?.submissionCalendar;

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
    dccBadges: calendar?.dccBadges ?? [],
    submissionCalendar: parsedCalendar,
  };
}

export async function fetchLeetCodeFullSync(username: string): Promise<LeetCodeSyncResult> {
  const [profile, contest, questionProgress, sessionProgress, skillStats, languageStats, calendar]
    = await Promise.all([
      fetchLeetCodeProfile(username),
      fetchLeetCodeContest(username),
      fetchLeetCodeQuestionProgress(username),
      fetchLeetCodeSessionProgress(username),
      fetchLeetCodeSkillStats(username),
      fetchLeetCodeLanguageStats(username),
      fetchLeetCodeCalendar(username),
    ]);

  return { profile, contest, questionProgress, sessionProgress, skillStats, languageStats, calendar };
}

export type UserQuestion = {
  frontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  lastSubmittedAt: string;
  numSubmitted: number;
  questionStatus: string;
  lastResult: string;
  topicTags: Array<{ name: string; nameTranslated: string; slug: string }>;
};

export async function fetchLeetCodeUserQuestions(
  username: string,
  skip = 0,
  limit = 50,
): Promise<{ totalNum: number; questions: UserQuestion[] }> {
  const data = await client.request<UserProgressQuestionListResponse>(GET_USER_PROGRESS_QUESTIONS, {
    filters: { skip, limit },
  });

  if (!data.userProgressQuestionList) {
    return { totalNum: 0, questions: [] };
  }

  return {
    totalNum: data.userProgressQuestionList.totalNum,
    questions: data.userProgressQuestionList.questions.map(q => ({
      frontendId: q.frontendId,
      title: q.translatedTitle || q.title,
      titleSlug: q.titleSlug,
      difficulty: q.difficulty,
      lastSubmittedAt: q.lastSubmittedAt ?? "",
      numSubmitted: q.numSubmitted,
      questionStatus: q.questionStatus,
      lastResult: q.lastResult,
      topicTags: q.topicTags.map(t => ({
        name: t.name,
        nameTranslated: t.nameTranslated || t.name,
        slug: t.slug,
      })),
    })),
  };
}
