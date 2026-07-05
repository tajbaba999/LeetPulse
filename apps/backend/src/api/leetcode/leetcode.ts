import Express from "express";
import { Credential, LeetCode } from "leetcode-query";

import { env } from "../../env.js";
import {
  fetchLeetCodeCalendar,
  fetchLeetCodeContest,
  fetchLeetCodeLanguageStats,
  fetchLeetCodeProfile,
  fetchLeetCodeQuestionProgress,
  fetchLeetCodeSessionProgress,
  fetchLeetCodeSkillStats,
} from "../../fetchers/leetcodeFetcher.js";

const lc = new LeetCode();

function getAuthClient() {
  const session = env.LEETCODE_SESSION;
  const csrf = env.LEETCODE_CSRF;
  if (!session || !csrf)
    return null;
  const credential = new Credential();
  credential.session = session;
  credential.csrf = csrf;
  return new LeetCode(credential);
}

// Falls back to LEETCODE_USERNAME in .env if ?username= is not provided
function resolveUsername(query: Express.Request["query"]): string | null {
  const fromQuery = query.username;
  if (typeof fromQuery === "string" && fromQuery.trim())
    return fromQuery.trim();
  const fromEnv = env.LEETCODE_USERNAME;
  return fromEnv?.trim() ?? null;
}

const router = Express.Router();

// ── GET /api/v1/leetcode/progress ──
// Needs LEETCODE_SESSION + LEETCODE_CSRF in .env
// Supports ?skip=0&limit=50 for pagination

router.get("/progress", async (req, res) => {
  try {
    const authLc = getAuthClient();
    if (!authLc) {
      return res.status(500).json({ message: "LEETCODE_SESSION and LEETCODE_CSRF must be set in .env" });
    }

    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    const batch = await authLc.user_progress_questions({ skip, limit });

    res.status(200).json({
      totalNum: batch.totalNum,
      skip,
      limit,
      hasMore: skip + batch.questions.length < batch.totalNum,
      questions: batch.questions,
    });
  }
  catch (ex) {
    console.error("userProgressQuestionList error:", ex);
    res.status(500).json({ message: "Failed to fetch question progress" });
  }
});

// ── GET /api/v1/leetcode/my-contests?username= ──

router.get("/my-contests", async (req, res) => {
  const username = resolveUsername(req.query);
  if (!username) {
    return res.status(400).json({ message: "username query param is required (or set LEETCODE_USERNAME in .env)" });
  }
  try {
    const { info, history } = await fetchLeetCodeContest(username);
    res.status(200).json({
      attendedContestsCount: info.attendedContestsCount,
      rating: info.rating,
      globalRanking: info.globalRanking,
      totalParticipants: info.totalParticipants,
      topPercentage: info.topPercentage,
      badge: info.badge,
      history,
    });
  }
  catch (ex) {
    console.error("userContestRankingInfo error:", ex);
    res.status(500).json({ message: "Failed to fetch contest history" });
  }
});

// ── GET /api/v1/leetcode/language-stats?username= ──

router.get("/language-stats", async (req, res) => {
  const username = resolveUsername(req.query);
  if (!username) {
    return res.status(400).json({ message: "username query param is required (or set LEETCODE_USERNAME in .env)" });
  }
  try {
    const stats = await fetchLeetCodeLanguageStats(username);
    res.status(200).json({ username, languageStats: stats });
  }
  catch (ex) {
    console.error("languageStats error:", ex);
    res.status(500).json({ message: "Failed to fetch language stats" });
  }
});

// ── GET /api/v1/leetcode/skill-stats?username= ──

router.get("/skill-stats", async (req, res) => {
  const username = resolveUsername(req.query);
  if (!username) {
    return res.status(400).json({ message: "username query param is required (or set LEETCODE_USERNAME in .env)" });
  }
  try {
    const stats = await fetchLeetCodeSkillStats(username);
    res.status(200).json({ username, skillStats: stats });
  }
  catch (ex) {
    console.error("skillStats error:", ex);
    res.status(500).json({ message: "Failed to fetch skill stats" });
  }
});

// ── GET /api/v1/leetcode/question-progress?username= ──

router.get("/question-progress", async (req, res) => {
  const username = resolveUsername(req.query);
  if (!username) {
    return res.status(400).json({ message: "username query param is required (or set LEETCODE_USERNAME in .env)" });
  }
  try {
    const progress = await fetchLeetCodeQuestionProgress(username);
    res.status(200).json({ username, ...progress });
  }
  catch (ex) {
    console.error("questionProgress error:", ex);
    res.status(500).json({ message: "Failed to fetch question progress" });
  }
});

// ── GET /api/v1/leetcode/session-progress?username= ──

router.get("/session-progress", async (req, res) => {
  const username = resolveUsername(req.query);
  if (!username) {
    return res.status(400).json({ message: "username query param is required (or set LEETCODE_USERNAME in .env)" });
  }
  try {
    const progress = await fetchLeetCodeSessionProgress(username);
    res.status(200).json({ username, ...progress });
  }
  catch (ex) {
    console.error("sessionProgress error:", ex);
    res.status(500).json({ message: "Failed to fetch session progress" });
  }
});

// ── GET /api/v1/leetcode/calendar?username=&year= ──
// year is optional — omit to get the current year from LeetCode

router.get("/calendar", async (req, res) => {
  const username = resolveUsername(req.query);
  if (!username) {
    return res.status(400).json({ message: "username query param is required (or set LEETCODE_USERNAME in .env)" });
  }
  const year = req.query.year ? Number(req.query.year) : undefined;
  try {
    const calendar = await fetchLeetCodeCalendar(username, year);
    res.status(200).json({ username, ...calendar });
  }
  catch (ex) {
    console.error("calendar error:", ex);
    res.status(500).json({ message: "Failed to fetch calendar" });
  }
});

// ── GET /api/v1/leetcode/profile?username= ──

router.get("/profile", async (req, res) => {
  const username = resolveUsername(req.query);
  if (!username) {
    return res.status(400).json({ message: "username query param is required (or set LEETCODE_USERNAME in .env)" });
  }
  try {
    const profile = await fetchLeetCodeProfile(username);
    res.status(200).json(profile);
  }
  catch (ex) {
    console.error("getUserProfile error:", ex);
    res.status(500).json({ message: "Failed to fetch LeetCode profile" });
  }
});

// ── GET /api/v1/leetcode/:username ──
// Public — fetches user badge profile via leetcode-query (keep last — catch-all)

router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const data = await lc.user(username);
    res.status(200).json(data);
  }
  catch (ex) {
    console.error("getUserProfile error:", ex);
    res.status(500).json({ message: "Failed to fetch LeetCode profile" });
  }
});

export default router;
