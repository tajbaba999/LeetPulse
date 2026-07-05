import { Prisma } from "@prisma/client";
import Express from "express";

import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";

import prisma from "@leetplus/db";
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
import { ingestRag } from "../../services/rag/ingest.js";
import { fetchAllProblems, startSSE, toJson, writeSSE } from "./helpers.js";

const router = Express.Router();

// ── POST /codingprofile/sync ──
// Smart sync: compares DB vs live, picks strategy, streams SSE progress.
router.post("/sync", async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const profile = await prisma.codingProfiles.findUnique({
    where: { userId: user.userId },
  });

  if (!profile) {
    return res.status(404).json({ message: "No coding profile linked. Call POST /codingprofile/initial-sync first." });
  }

  const username = profile.leetcode || env.LEETCODE_USERNAME?.trim();
  if (!username) {
    return res.status(400).json({ message: "No LeetCode username linked." });
  }

  startSSE(res);
  const log = req.log.child({ userId: user.userId, username });

  try {
    writeSSE(res, "progress", { stage: "fetch_profile", pct: 5, msg: "1/9: Fetching LeetCode profile..." });
    const liveProfile = await fetchLeetCodeProfile(username);
    writeSSE(res, "progress", { stage: "fetch_profile_done", pct: 10, msg: `1/9: Profile — ${liveProfile.totalSolved} solved, #${liveProfile.ranking}` });

    let contest: LeetCodeSyncResult["contest"] = { info: { attendedContestsCount: 0, rating: 0, globalRanking: 0, totalParticipants: 0, topPercentage: 0, badge: null }, history: [] };
    let questionProgress: LeetCodeSyncResult["questionProgress"] = { numAcceptedQuestions: [], numFailedQuestions: [], numUntouchedQuestions: [], userSessionBeatsPercentage: [], totalQuestionBeatsPercentage: 0 };
    let sessionProgress: LeetCodeSyncResult["sessionProgress"] = { allQuestionsCount: [], acSubmissionNum: [], totalSubmissionNum: [] };
    let skillStats: LeetCodeSyncResult["skillStats"] = { fundamental: [], intermediate: [], advanced: [] };
    let languageStats: LeetCodeSyncResult["languageStats"] = [];
    let calendar: LeetCodeSyncResult["calendar"] = { activeYears: [], streak: 0, totalActiveDays: 0, dccBadges: [], submissionCalendar: {} };

    const safeFetch = async <T>(label: string, step: number, fn: () => Promise<T>, fallback: T): Promise<T> => {
      writeSSE(res, "progress", { stage: `fetch_${label}`, pct: step * 5, msg: `${step}/9: Fetching ${label}...` });
      try {
        const result = await fn();
        writeSSE(res, "progress", { stage: `fetch_${label}_done`, pct: step * 5 + 2, msg: `${step}/9: ${label} fetched` });
        return result;
      }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        writeSSE(res, "progress", { stage: `fetch_${label}_skip`, pct: step * 5 + 2, msg: `${step}/9: ${label} skipped — ${msg}` });
        return fallback;
      }
    };

    contest = await safeFetch("contest", 2, () => fetchLeetCodeContest(username), contest);
    questionProgress = await safeFetch("question progress", 3, () => fetchLeetCodeQuestionProgress(username), questionProgress);
    sessionProgress = await safeFetch("session progress", 4, () => fetchLeetCodeSessionProgress(username), sessionProgress);
    skillStats = await safeFetch("skill stats", 5, () => fetchLeetCodeSkillStats(username), skillStats);
    languageStats = await safeFetch("language stats", 6, () => fetchLeetCodeLanguageStats(username), languageStats);
    calendar = await safeFetch("calendar", 7, () => fetchLeetCodeCalendar(username), calendar);

    const syncResult: LeetCodeSyncResult = { profile: liveProfile, contest, questionProgress, sessionProgress, skillStats, languageStats, calendar };

    // Fetch questions
    writeSSE(res, "progress", { stage: "fetch_questions", pct: 38, msg: `8/9: Fetching ${liveProfile.totalSolved} solved questions...` });
    let allProblems: Awaited<ReturnType<typeof fetchAllProblems>> = [];
    try {
      allProblems = await fetchAllProblems(username, liveProfile.totalSolved, (event, data) => writeSSE(res, event, data));
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_questions_skip", pct: 45, msg: `8/9: Questions skipped — ${msg}` });
    }

    // DB save
    writeSSE(res, "progress", { stage: "db_save", pct: 46, msg: "9/9: Saving to database..." });
    await prisma.leetCodeStats.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId, username,
        totalSolved: liveProfile.totalSolved, totalQuestions: liveProfile.totalQuestions,
        easySolved: liveProfile.easySolved, mediumSolved: liveProfile.mediumSolved, hardSolved: liveProfile.hardSolved,
        ranking: liveProfile.ranking, acceptanceRate: liveProfile.acceptanceRate, streak: calendar.streak,
        contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress), sessionProgress: toJson(sessionProgress),
        skillStats: toJson(skillStats), languageStats: toJson(languageStats),
        recentSubmissions: toJson(liveProfile.recentSubmissions),
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays, submissionCalendar: calendar.submissionCalendar }),
      },
      update: {
        username,
        totalSolved: liveProfile.totalSolved, totalQuestions: liveProfile.totalQuestions,
        easySolved: liveProfile.easySolved, mediumSolved: liveProfile.mediumSolved, hardSolved: liveProfile.hardSolved,
        ranking: liveProfile.ranking, acceptanceRate: liveProfile.acceptanceRate, streak: calendar.streak,
        contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress), sessionProgress: toJson(sessionProgress),
        skillStats: toJson(skillStats), languageStats: toJson(languageStats),
        recentSubmissions: toJson(liveProfile.recentSubmissions),
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays, submissionCalendar: calendar.submissionCalendar }),
      },
    });
    writeSSE(res, "progress", { stage: "db_stats_done", pct: 52, msg: "Stats saved" });

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
        }
      });
      writeSSE(res, "progress", { stage: "db_problems_done", pct: 58, msg: `${allProblems.length} questions saved` });
    }

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

    await prisma.leetCodeHistory.create({
      data: {
        userId: user.userId, username,
        totalSolved: liveProfile.totalSolved, totalQuestions: liveProfile.totalQuestions,
        easySolved: liveProfile.easySolved, mediumSolved: liveProfile.mediumSolved, hardSolved: liveProfile.hardSolved,
        ranking: liveProfile.ranking, acceptanceRate: liveProfile.acceptanceRate, streak: calendar.streak,
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

    writeSSE(res, "progress", { stage: "rag_started", pct: 64, msg: "Building RAG documents..." });
    try {
      const ragResult = await ingestRag(user.userId, username, syncResult, allProblems, async (_stage, pct, msg) => {
        writeSSE(res, "progress", { stage: "rag_progress", pct: 64 + Math.round((pct / 100) * 36), msg });
      });
      writeSSE(res, "progress", { stage: "completed", pct: 100, msg: `Sync complete! ${liveProfile.totalSolved} solved, ${allProblems.length} questions, ${ragResult.upserted} RAG chunks` });
    }
    catch (ragErr) {
      const errMsg = ragErr instanceof Error ? ragErr.message : String(ragErr);
      writeSSE(res, "progress", { stage: "completed", pct: 100, msg: `DB sync complete! ${liveProfile.totalSolved} solved, ${allProblems.length} questions. RAG skipped: ${errMsg}` });
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
