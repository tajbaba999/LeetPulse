import { Prisma } from "@prisma/client";
import Express from "express";

import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";

import prisma from "@leetplus/db";
import {
  fetchLeetCodeCalendar,
  fetchLeetCodeContest,
  fetchLeetCodeLanguageStats,
  fetchLeetCodeProfile,
  fetchLeetCodeQuestionProgress,
  fetchLeetCodeSessionProgress,
  fetchLeetCodeSkillStats,
} from "../../fetchers/leetcodeFetcher.js";
import { ingestRag } from "../../services/rag/ingest.js";
import { fetchAllProblems, resolveUsername, startSSE, toJson, writeSSE } from "./helpers.js";

const router = Express.Router();

// ── POST /codingprofile/initial-sync ──
// After signup: creates profile + syncs everything inline, streams SSE progress.
router.post("/initial-sync", async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const raw = req.body as Record<string, string | undefined>;
  const username = resolveUsername(raw?.leetcode);

  if (!username) {
    return res.status(400).json({
      message: "LeetCode username is required. Provide in body or set LEETCODE_USERNAME in .env",
    });
  }

  const existingProfile = await prisma.codingProfiles.findUnique({
    where: { userId: user.userId },
  });

  if (!existingProfile) {
    await prisma.codingProfiles.create({
      data: { userId: user.userId, leetcode: username },
    });
  }

  startSSE(res);
  const log = req.log.child({ userId: user.userId, username });

  try {
    // ── 1. Fetch profile ──
    writeSSE(res, "progress", { stage: "fetch_profile", pct: 5, msg: "1/9: Fetching LeetCode profile..." });
    const profile = await fetchLeetCodeProfile(username);
    writeSSE(res, "progress", { stage: "fetch_profile_done", pct: 10, msg: `1/9: Profile fetched — ${profile.totalSolved} solved, ranking #${profile.ranking}` });

    // ── 2. Fetch contest ──
    writeSSE(res, "progress", { stage: "fetch_contest", pct: 12, msg: "2/9: Fetching contest info..." });
    let contest: LeetCodeSyncResult["contest"] = { info: { attendedContestsCount: 0, rating: 0, globalRanking: 0, totalParticipants: 0, topPercentage: 0, badge: null }, history: [] };
    try {
      contest = await fetchLeetCodeContest(username);
      writeSSE(res, "progress", { stage: "fetch_contest_done", pct: 15, msg: `2/9: Contest info fetched — rating ${contest.info.rating.toFixed(0)}, ${contest.history.length} contests` });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_contest_skip", pct: 15, msg: `2/9: Contest fetch skipped — ${msg}` });
    }

    // ── 3. Fetch question progress ──
    writeSSE(res, "progress", { stage: "fetch_question_progress", pct: 17, msg: "3/9: Fetching question progress..." });
    let questionProgress: LeetCodeSyncResult["questionProgress"] = { numAcceptedQuestions: [], numFailedQuestions: [], numUntouchedQuestions: [], userSessionBeatsPercentage: [], totalQuestionBeatsPercentage: 0 };
    try {
      questionProgress = await fetchLeetCodeQuestionProgress(username);
      writeSSE(res, "progress", { stage: "fetch_question_progress_done", pct: 20, msg: "3/9: Question progress fetched" });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_question_progress_skip", pct: 20, msg: `3/9: Question progress skipped — ${msg}` });
    }

    // ── 4. Fetch session progress ──
    writeSSE(res, "progress", { stage: "fetch_session_progress", pct: 22, msg: "4/9: Fetching session progress..." });
    let sessionProgress: LeetCodeSyncResult["sessionProgress"] = { allQuestionsCount: [], acSubmissionNum: [], totalSubmissionNum: [] };
    try {
      sessionProgress = await fetchLeetCodeSessionProgress(username);
      writeSSE(res, "progress", { stage: "fetch_session_progress_done", pct: 24, msg: "4/9: Session progress fetched" });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_session_progress_skip", pct: 24, msg: `4/9: Session progress skipped — ${msg}` });
    }

    // ── 5. Fetch skill stats ──
    writeSSE(res, "progress", { stage: "fetch_skill_stats", pct: 26, msg: "5/9: Fetching skill stats..." });
    let skillStats: LeetCodeSyncResult["skillStats"] = { fundamental: [], intermediate: [], advanced: [] };
    try {
      skillStats = await fetchLeetCodeSkillStats(username);
      const totalTags = skillStats.fundamental.length + skillStats.intermediate.length + skillStats.advanced.length;
      writeSSE(res, "progress", { stage: "fetch_skill_stats_done", pct: 28, msg: `5/9: Skill stats fetched — ${totalTags} topics` });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_skill_stats_skip", pct: 28, msg: `5/9: Skill stats skipped — ${msg}` });
    }

    // ── 6. Fetch language stats ──
    writeSSE(res, "progress", { stage: "fetch_language_stats", pct: 30, msg: "6/9: Fetching language stats..." });
    let languageStats: LeetCodeSyncResult["languageStats"] = [];
    try {
      languageStats = await fetchLeetCodeLanguageStats(username);
      writeSSE(res, "progress", { stage: "fetch_language_stats_done", pct: 32, msg: `6/9: Language stats fetched — ${languageStats.length} languages` });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_language_stats_skip", pct: 32, msg: `6/9: Language stats skipped — ${msg}` });
    }

    // ── 7. Fetch calendar ──
    writeSSE(res, "progress", { stage: "fetch_calendar", pct: 34, msg: "7/9: Fetching activity calendar..." });
    let calendar: LeetCodeSyncResult["calendar"] = { activeYears: [], streak: 0, totalActiveDays: 0, dccBadges: [], submissionCalendar: {} };
    try {
      calendar = await fetchLeetCodeCalendar(username);
      writeSSE(res, "progress", { stage: "fetch_calendar_done", pct: 36, msg: `7/9: Calendar fetched — ${calendar.totalActiveDays} active days, streak ${calendar.streak}` });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_calendar_skip", pct: 36, msg: `7/9: Calendar skipped — ${msg}` });
    }

    const syncResult: LeetCodeSyncResult = { profile, contest, questionProgress, sessionProgress, skillStats, languageStats, calendar };

    // ── 8. Fetch all solved questions ──
    writeSSE(res, "progress", { stage: "fetch_questions", pct: 38, msg: `8/9: Fetching ${profile.totalSolved} solved questions (paginated)...` });
    let allProblems: Awaited<ReturnType<typeof fetchAllProblems>> = [];
    try {
      allProblems = await fetchAllProblems(username, profile.totalSolved, (event, data) => writeSSE(res, event, data));
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_questions_skip", pct: 45, msg: `8/9: Question fetch skipped (need LEETCODE_SESSION cookie) — ${msg}` });
    }

    // ── 9. Save to database ──
    writeSSE(res, "progress", { stage: "db_save", pct: 46, msg: "9/9: Saving to database..." });

    await prisma.leetCodeStats.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId, username,
        totalSolved: profile.totalSolved, totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved, mediumSolved: profile.mediumSolved, hardSolved: profile.hardSolved,
        ranking: profile.ranking, acceptanceRate: profile.acceptanceRate, streak: calendar.streak,
        contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress), sessionProgress: toJson(sessionProgress),
        skillStats: toJson(skillStats), languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays, submissionCalendar: calendar.submissionCalendar }),
      },
      update: {
        username,
        totalSolved: profile.totalSolved, totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved, mediumSolved: profile.mediumSolved, hardSolved: profile.hardSolved,
        ranking: profile.ranking, acceptanceRate: profile.acceptanceRate, streak: calendar.streak,
        contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress), sessionProgress: toJson(sessionProgress),
        skillStats: toJson(skillStats), languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays, submissionCalendar: calendar.submissionCalendar }),
      },
    });
    writeSSE(res, "progress", { stage: "db_stats_done", pct: 52, msg: "Stats saved to LeetCodeStats" });

    // Save problems
    if (allProblems.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "LeetCodeProblem" WHERE "userId" = ${user.userId}`;
        const batchSize = 100;
        for (let i = 0; i < allProblems.length; i += batchSize) {
          const batch = allProblems.slice(i, i + batchSize);
          await tx.leetCodeProblem.createMany({
            data: batch.map(p => ({
              userId: user.userId, titleSlug: p.titleSlug, title: p.title, difficulty: p.difficulty,
              questionStatus: p.questionStatus, lastResult: p.lastResult, lastSubmittedAt: p.lastSubmittedAt,
              numSubmitted: p.numSubmitted, topicTags: toJson(p.topicTags),
            })),
          });
          writeSSE(res, "progress", {
            stage: "db_problems",
            pct: 52 + Math.round((i + batch.length) / allProblems.length * 6),
            msg: `Saved ${Math.min(i + batchSize, allProblems.length)}/${allProblems.length} questions to database...`,
          });
        }
      });
      writeSSE(res, "progress", { stage: "db_problems_done", pct: 58, msg: `${allProblems.length} questions saved with topic tags` });
    }

    // Save contest history
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM "LeetCodeContestHistory" WHERE "userId" = ${user.userId}`;
      if (contest.history.length > 0) {
        await tx.leetCodeContestHistory.createMany({
          data: contest.history.map(e => ({
            userId: user.userId, contestTitle: e.contest.title, startTime: e.contest.startTime,
            attended: e.attended, rating: e.rating, ranking: e.ranking, trendDirection: e.trendDirection,
            problemsSolved: e.problemsSolved, totalProblems: e.totalProblems, finishTimeInSeconds: e.finishTimeInSeconds,
          })),
        });
      }
    });
    writeSSE(res, "progress", { stage: "db_contests_done", pct: 60, msg: `${contest.history.length} contest entries saved` });

    // Save history snapshot
    await prisma.leetCodeHistory.create({
      data: {
        userId: user.userId, username,
        totalSolved: profile.totalSolved, totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved, mediumSolved: profile.mediumSolved, hardSolved: profile.hardSolved,
        ranking: profile.ranking, acceptanceRate: profile.acceptanceRate, streak: calendar.streak,
        contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount,
        problemsSolvedList: allProblems.length > 0
          ? toJson(allProblems.map(p => ({ titleSlug: p.titleSlug, title: p.title, difficulty: p.difficulty, lastResult: p.lastResult, lastSubmittedAt: p.lastSubmittedAt, topicTags: p.topicTags })))
          : Prisma.JsonNull,
        contestHistory: contest.history.length > 0
          ? toJson(contest.history.map(e => ({ title: e.contest.title, startTime: e.contest.startTime, rating: e.rating, ranking: e.ranking, problemsSolved: e.problemsSolved, totalProblems: e.totalProblems })))
          : Prisma.JsonNull,
        skillStats: toJson(skillStats), languageStats: toJson(languageStats),
      },
    });
    writeSSE(res, "progress", { stage: "history_done", pct: 62, msg: "History snapshot saved" });

    // ── RAG ingest ──
    writeSSE(res, "progress", { stage: "rag_started", pct: 64, msg: `Building RAG documents from ${allProblems.length + 10} data chunks...` });
    try {
      const ragResult = await ingestRag(user.userId, username, syncResult, allProblems, async (_stage, pct, msg) => {
        writeSSE(res, "progress", { stage: "rag_progress", pct: 64 + Math.round((pct / 100) * 36), msg });
      });
      writeSSE(res, "progress", {
        stage: "completed", pct: 100,
        msg: `Sync complete! ${profile.totalSolved} solved, ${allProblems.length} questions saved, ${ragResult.upserted} RAG chunks indexed`,
      });
    }
    catch (ragErr) {
      const errMsg = ragErr instanceof Error ? ragErr.message : String(ragErr);
      log.warn({ err: errMsg }, "RAG ingest failed");
      writeSSE(res, "progress", {
        stage: "completed", pct: 100,
        msg: `DB sync complete! ${profile.totalSolved} solved, ${allProblems.length} questions saved. AI indexing skipped: ${errMsg}`,
      });
    }

    writeSSE(res, "done", { stage: "done", pct: 100, msg: "Sync finished" });
    res.end();
  }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, "Sync failed");
    writeSSE(res, "error", { stage: "error", pct: 0, msg: `Sync failed: ${msg}` });
    res.end();
  }
});

export default router;
