// ── LeetCode Types (matching alfa-leetcode-api GraphQL queries) ──

/** getUserProfile query — core stats + recent submissions */
export type LeetCodeProfile = {
  username: string;
  totalSolved: number;
  totalQuestions: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number;
  acceptanceRate: number;
  streak: number;
  totalSubmissions: number;
  recentSubmissions: Array<{
    title: string;
    titleSlug: string;
    timestamp: string;
    statusDisplay: string;
    lang: string;
  }>;
};

/** userContestRankingInfo query — contest summary */
export type LeetCodeContestInfo = {
  attendedContestsCount: number;
  rating: number;
  globalRanking: number;
  totalParticipants: number;
  topPercentage: number;
  badge: string | null;
};

/** userContestRankingHistory — per-contest entry */
export type LeetCodeContestHistoryEntry = {
  attended: boolean;
  rating: number;
  ranking: number;
  trendDirection: string;
  problemsSolved: number;
  totalProblems: number;
  finishTimeInSeconds: number;
  contest: {
    title: string;
    startTime: number;
  };
};

/** userProfileUserQuestionProgressV2 — accepted/failed/untouched by difficulty */
export type LeetCodeQuestionProgress = {
  numAcceptedQuestions: Array<{ difficulty: string; count: number }>;
  numFailedQuestions: Array<{ difficulty: string; count: number }>;
  numUntouchedQuestions: Array<{ difficulty: string; count: number }>;
  userSessionBeatsPercentage: Array<{ difficulty: string; percentage: number }>;
};

/** skillStats query — tag-based problem counts by level */
export type LeetCodeSkillStats = {
  fundamental: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
  intermediate: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
  advanced: Array<{ tagName: string; tagSlug: string; problemsSolved: number }>;
};

/** languageStats query — language-wise solved counts */
export type LeetCodeLanguageStats = {
  languageName: string;
  problemsSolved: number;
};

/** UserProfileCalendar query — streak + active days */
export type LeetCodeCalendar = {
  activeYears: number[];
  streak: number;
  totalActiveDays: number;
  submissionCalendar: Record<string, number>;
};

/** Combined result from fetchLeetCodeFullSync() */
export type LeetCodeSyncResult = {
  profile: LeetCodeProfile;
  contest: {
    info: LeetCodeContestInfo;
    history: LeetCodeContestHistoryEntry[];
  };
  questionProgress: LeetCodeQuestionProgress;
  skillStats: LeetCodeSkillStats;
  languageStats: LeetCodeLanguageStats[];
  calendar: LeetCodeCalendar;
};

export type Platform = "leetcode";

export type SyncJobData = {
  userId: string;
  platform: Platform;
  username: string;
};
