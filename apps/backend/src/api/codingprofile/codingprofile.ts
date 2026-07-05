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
  fetchLeetCodeUserQuestions,
} from "../../fetchers/leetcodeFetcher.js";
import { ingestRag } from "../../services/rag/ingest.js";

const toJson = (val: unknown) => val as Prisma.InputJsonValue;

function writeSSE(res: Express.Response, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function extractUsername(value: string | undefined): string | undefined {
  if (!value)
    return undefined;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || value;
  }
  catch {
    return value;
  }
}

function resolveUsername(body: string | undefined): string | undefined {
  const fromBody = extractUsername(body);
  if (fromBody)
    return fromBody;
  return env.LEETCODE_USERNAME?.trim() || undefined;
}

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

  // Create profile if not exists
  const existingProfile = await prisma.codingProfiles.findUnique({
    where: { userId: user.userId },
  });

  if (!existingProfile) {
    await prisma.codingProfiles.create({
      data: { userId: user.userId, leetcode: username },
    });
  }

  // ── Start SSE stream ──
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

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

    // ── 8. Fetch all solved questions using totalSolved from profile ──
    writeSSE(res, "progress", { stage: "fetch_questions", pct: 38, msg: `8/9: Fetching ${profile.totalSolved} solved questions (paginated)...` });
    let allProblems: Array<{ titleSlug: string; title: string; difficulty: string; questionStatus: string; lastResult: string; lastSubmittedAt: string; numSubmitted: number; topicTags: Array<{ name: string; nameTranslated: string; slug: string }> }> = [];

    try {
      const PAGE_SIZE = 50;
      let skip = 0;
      const totalToFetch = profile.totalSolved;

      while (skip < totalToFetch) {
        writeSSE(res, "progress", {
          stage: "fetch_questions",
          pct: 38 + Math.round((skip / totalToFetch) * 7),
          msg: `8/9: Fetching questions ${skip + 1}–${Math.min(skip + PAGE_SIZE, totalToFetch)} of ${totalToFetch}...`,
        });

        const page = await fetchLeetCodeUserQuestions(username, skip, PAGE_SIZE);
        if (page.questions.length === 0)
          break;

        allProblems = [...allProblems, ...page.questions.map(q => ({
          titleSlug: q.titleSlug,
          title: q.title,
          difficulty: q.difficulty,
          questionStatus: q.questionStatus,
          lastResult: q.lastResult,
          lastSubmittedAt: q.lastSubmittedAt,
          numSubmitted: q.numSubmitted,
          topicTags: q.topicTags,
        }))];
        skip += PAGE_SIZE;

        if (skip < totalToFetch) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      writeSSE(res, "progress", { stage: "fetch_questions_done", pct: 45, msg: `8/9: Fetched ${allProblems.length} solved questions` });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_questions_skip", pct: 45, msg: `8/9: Question fetch skipped (need LEETCODE_SESSION cookie) — ${msg}` });
    }

    // ── 9. Save to database ──
    writeSSE(res, "progress", { stage: "db_save", pct: 46, msg: "9/9: Saving to database..." });

    // Save stats
    await prisma.leetCodeStats.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        username,
        totalSolved: profile.totalSolved,
        totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        ranking: profile.ranking,
        acceptanceRate: profile.acceptanceRate,
        streak: calendar.streak,
        contestRating: contest.info.rating,
        contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage,
        attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress),
        sessionProgress: toJson(sessionProgress),
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({
          activeYears: calendar.activeYears,
          totalActiveDays: calendar.totalActiveDays,
          submissionCalendar: calendar.submissionCalendar,
        }),
      },
      update: {
        username,
        totalSolved: profile.totalSolved,
        totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        ranking: profile.ranking,
        acceptanceRate: profile.acceptanceRate,
        streak: calendar.streak,
        contestRating: contest.info.rating,
        contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage,
        attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress),
        sessionProgress: toJson(sessionProgress),
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({
          activeYears: calendar.activeYears,
          totalActiveDays: calendar.totalActiveDays,
          submissionCalendar: calendar.submissionCalendar,
        }),
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
              userId: user.userId,
              titleSlug: p.titleSlug,
              title: p.title,
              difficulty: p.difficulty,
              questionStatus: p.questionStatus,
              lastResult: p.lastResult,
              lastSubmittedAt: p.lastSubmittedAt,
              numSubmitted: p.numSubmitted,
              topicTags: toJson(p.topicTags),
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
            userId: user.userId,
            contestTitle: e.contest.title,
            startTime: e.contest.startTime,
            attended: e.attended,
            rating: e.rating,
            ranking: e.ranking,
            trendDirection: e.trendDirection,
            problemsSolved: e.problemsSolved,
            totalProblems: e.totalProblems,
            finishTimeInSeconds: e.finishTimeInSeconds,
          })),
        });
      }
    });
    writeSSE(res, "progress", { stage: "db_contests_done", pct: 60, msg: `${contest.history.length} contest entries saved` });

    // Save history snapshot
    await prisma.leetCodeHistory.create({
      data: {
        userId: user.userId,
        username,
        totalSolved: profile.totalSolved,
        totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        ranking: profile.ranking,
        acceptanceRate: profile.acceptanceRate,
        streak: calendar.streak,
        contestRating: contest.info.rating,
        contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage,
        attendedContestsCount: contest.info.attendedContestsCount,
        problemsSolvedList: allProblems.length > 0
          ? toJson(allProblems.map(p => ({
              titleSlug: p.titleSlug,
              title: p.title,
              difficulty: p.difficulty,
              lastResult: p.lastResult,
              lastSubmittedAt: p.lastSubmittedAt,
              topicTags: p.topicTags,
            })))
          : Prisma.JsonNull,
        contestHistory: contest.history.length > 0
          ? toJson(contest.history.map(e => ({
              title: e.contest.title,
              startTime: e.contest.startTime,
              rating: e.rating,
              ranking: e.ranking,
              problemsSolved: e.problemsSolved,
              totalProblems: e.totalProblems,
            })))
          : Prisma.JsonNull,
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
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
        stage: "completed",
        pct: 100,
        msg: `Sync complete! ${profile.totalSolved} solved, ${allProblems.length} questions saved, ${ragResult.upserted} RAG chunks indexed`,
      });
    }
    catch (ragErr) {
      const errMsg = ragErr instanceof Error ? ragErr.message : String(ragErr);
      log.warn({ err: errMsg }, "RAG ingest failed");
      writeSSE(res, "progress", {
        stage: "completed",
        pct: 100,
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

  // Same flow as initial-sync — set body and run
  req.body = { leetcode: username };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

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
    let allProblems: Array<{ titleSlug: string; title: string; difficulty: string; questionStatus: string; lastResult: string; lastSubmittedAt: string; numSubmitted: number; topicTags: Array<{ name: string; nameTranslated: string; slug: string }> }> = [];

    try {
      const PAGE_SIZE = 50;
      let skip = 0;
      while (skip < liveProfile.totalSolved) {
        writeSSE(res, "progress", { stage: "fetch_questions", pct: 38 + Math.round((skip / liveProfile.totalSolved) * 7), msg: `8/9: Questions ${skip + 1}–${Math.min(skip + PAGE_SIZE, liveProfile.totalSolved)} of ${liveProfile.totalSolved}...` });
        const page = await fetchLeetCodeUserQuestions(username, skip, PAGE_SIZE);
        if (page.questions.length === 0)
          break;
        allProblems = [...allProblems, ...page.questions.map(q => ({ titleSlug: q.titleSlug, title: q.title, difficulty: q.difficulty, questionStatus: q.questionStatus, lastResult: q.lastResult, lastSubmittedAt: q.lastSubmittedAt, numSubmitted: q.numSubmitted, topicTags: q.topicTags }))];
        skip += PAGE_SIZE;
        if (skip < liveProfile.totalSolved)
          await new Promise(r => setTimeout(r, 300));
      }
      writeSSE(res, "progress", { stage: "fetch_questions_done", pct: 45, msg: `8/9: Fetched ${allProblems.length} questions` });
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeSSE(res, "progress", { stage: "fetch_questions_skip", pct: 45, msg: `8/9: Questions skipped — ${msg}` });
    }

    // DB save
    writeSSE(res, "progress", { stage: "db_save", pct: 46, msg: "9/9: Saving to database..." });
    await prisma.leetCodeStats.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, username, totalSolved: liveProfile.totalSolved, totalQuestions: liveProfile.totalQuestions, easySolved: liveProfile.easySolved, mediumSolved: liveProfile.mediumSolved, hardSolved: liveProfile.hardSolved, ranking: liveProfile.ranking, acceptanceRate: liveProfile.acceptanceRate, streak: calendar.streak, contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking, contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount, questionProgress: toJson(questionProgress), sessionProgress: toJson(sessionProgress), skillStats: toJson(skillStats), languageStats: toJson(languageStats), recentSubmissions: toJson(liveProfile.recentSubmissions), calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays, submissionCalendar: calendar.submissionCalendar }) },
      update: { username, totalSolved: liveProfile.totalSolved, totalQuestions: liveProfile.totalQuestions, easySolved: liveProfile.easySolved, mediumSolved: liveProfile.mediumSolved, hardSolved: liveProfile.hardSolved, ranking: liveProfile.ranking, acceptanceRate: liveProfile.acceptanceRate, streak: calendar.streak, contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking, contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount, questionProgress: toJson(questionProgress), sessionProgress: toJson(sessionProgress), skillStats: toJson(skillStats), languageStats: toJson(languageStats), recentSubmissions: toJson(liveProfile.recentSubmissions), calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays, submissionCalendar: calendar.submissionCalendar }) },
    });
    writeSSE(res, "progress", { stage: "db_stats_done", pct: 52, msg: "Stats saved" });

    if (allProblems.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "LeetCodeProblem" WHERE "userId" = ${user.userId}`;
        const batchSize = 100;
        for (let i = 0; i < allProblems.length; i += batchSize) {
          const batch = allProblems.slice(i, i + batchSize);
          await tx.leetCodeProblem.createMany({ data: batch.map(p => ({ userId: user.userId, titleSlug: p.titleSlug, title: p.title, difficulty: p.difficulty, questionStatus: p.questionStatus, lastResult: p.lastResult, lastSubmittedAt: p.lastSubmittedAt, numSubmitted: p.numSubmitted, topicTags: toJson(p.topicTags) })) });
        }
      });
      writeSSE(res, "progress", { stage: "db_problems_done", pct: 58, msg: `${allProblems.length} questions saved` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM "LeetCodeContestHistory" WHERE "userId" = ${user.userId}`;
      if (contest.history.length > 0) {
        await tx.leetCodeContestHistory.createMany({ data: contest.history.map(e => ({ userId: user.userId, contestTitle: e.contest.title, startTime: e.contest.startTime, attended: e.attended, rating: e.rating, ranking: e.ranking, trendDirection: e.trendDirection, problemsSolved: e.problemsSolved, totalProblems: e.totalProblems, finishTimeInSeconds: e.finishTimeInSeconds })) });
      }
    });

    await prisma.leetCodeHistory.create({
      data: { userId: user.userId, username, totalSolved: liveProfile.totalSolved, totalQuestions: liveProfile.totalQuestions, easySolved: liveProfile.easySolved, mediumSolved: liveProfile.mediumSolved, hardSolved: liveProfile.hardSolved, ranking: liveProfile.ranking, acceptanceRate: liveProfile.acceptanceRate, streak: calendar.streak, contestRating: contest.info.rating, contestGlobalRanking: contest.info.globalRanking, contestTopPercentage: contest.info.topPercentage, attendedContestsCount: contest.info.attendedContestsCount, problemsSolvedList: allProblems.length > 0 ? toJson(allProblems.map(p => ({ titleSlug: p.titleSlug, title: p.title, difficulty: p.difficulty, lastResult: p.lastResult, lastSubmittedAt: p.lastSubmittedAt, topicTags: p.topicTags }))) : Prisma.JsonNull, contestHistory: contest.history.length > 0 ? toJson(contest.history.map(e => ({ title: e.contest.title, startTime: e.contest.startTime, rating: e.rating, ranking: e.ranking, problemsSolved: e.problemsSolved, totalProblems: e.totalProblems }))) : Prisma.JsonNull, skillStats: toJson(skillStats), languageStats: toJson(languageStats) },
    });
    writeSSE(res, "progress", { stage: "history_done", pct: 62, msg: "History snapshot saved" });

    writeSSE(res, "progress", { stage: "rag_started", pct: 64, msg: `Building RAG documents...` });
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

// ── GET /codingprofile ──
router.get("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [profiles, leetCodeStats, problemCount, contestCount] = await Promise.all([
      prisma.codingProfiles.findUnique({ where: { userId: user.userId } }),
      prisma.leetCodeStats.findUnique({ where: { userId: user.userId } }),
      prisma.leetCodeProblem.count({ where: { userId: user.userId } }),
      prisma.leetCodeContestHistory.count({ where: { userId: user.userId } }),
    ]);

    if (!profiles) {
      return res.status(404).json({ message: "Coding profiles not found. Create them first." });
    }

    res.status(200).json({
      profiles,
      stats: { leetcode: leetCodeStats },
      counts: { problems: problemCount, contests: contestCount },
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch coding profiles");
    return res.status(500).json({ message: "Server Error!" });
  }
});

// ── GET /codingprofile/history ──
router.get("/history", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

    const snapshots = await prisma.leetCodeHistory.findMany({
      where: { userId: user.userId },
      orderBy: { snapshotAt: "desc" },
      take: limit,
      select: {
        id: true,
        snapshotAt: true,
        totalSolved: true,
        totalQuestions: true,
        easySolved: true,
        mediumSolved: true,
        hardSolved: true,
        ranking: true,
        acceptanceRate: true,
        streak: true,
        contestRating: true,
        contestGlobalRanking: true,
        contestTopPercentage: true,
        attendedContestsCount: true,
        problemsSolvedList: true,
        contestHistory: true,
        skillStats: true,
        languageStats: true,
      },
    });

    res.status(200).json({ snapshots, total: snapshots.length });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch history");
    res.status(500).json({ message: "Server Error!" });
  }
});

// ── GET /codingprofile/history/diff ──
router.get("/history/diff", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const fromId = req.query.from as string | undefined;
    const toId = req.query.to as string | undefined;

    let older: Record<string, unknown> | null = null;
    let newer: Record<string, unknown> | null = null;

    if (fromId && toId) {
      [older, newer] = await Promise.all([
        prisma.leetCodeHistory.findFirst({ where: { userId: user.userId, id: fromId } }),
        prisma.leetCodeHistory.findFirst({ where: { userId: user.userId, id: toId } }),
      ]);
    }
    else {
      const snapshots = await prisma.leetCodeHistory.findMany({
        where: { userId: user.userId },
        orderBy: { snapshotAt: "desc" },
        take: 2,
      });
      newer = snapshots[0] ?? null;
      older = snapshots[1] ?? null;
    }

    if (!older || !newer) {
      return res.status(404).json({ message: "Need at least 2 snapshots to compute diff" });
    }

    const oldProblems = new Set(
      Array.isArray(older.problemsSolvedList)
        ? (older.problemsSolvedList as Array<{ titleSlug: string }>).map(p => p.titleSlug)
        : [],
    );
    const newProblems = Array.isArray(newer.problemsSolvedList)
      ? (newer.problemsSolvedList as Array<{ titleSlug: string; title: string; difficulty: string }>)
      : [];
    const newlySolved = newProblems.filter(p => !oldProblems.has(p.titleSlug));

    res.status(200).json({
      from: { snapshotAt: older.snapshotAt, totalSolved: older.totalSolved },
      to: { snapshotAt: newer.snapshotAt, totalSolved: newer.totalSolved },
      diff: {
        totalSolved: (newer.totalSolved as number) - (older.totalSolved as number),
        easy: (newer.easySolved as number) - (older.easySolved as number),
        medium: (newer.mediumSolved as number) - (older.mediumSolved as number),
        hard: (newer.hardSolved as number) - (older.hardSolved as number),
        contestRating: Math.round(((newer.contestRating as number) - (older.contestRating as number)) * 100) / 100,
        ranking: (newer.ranking as number) - (older.ranking as number),
        newlySolvedCount: newlySolved.length,
        newlySolved,
      },
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to compute diff");
    res.status(500).json({ message: "Server Error!" });
  }
});

// ── GET /codingprofile/activity ──
// Returns all submission calendar data.
router.get("/activity", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const stats = await prisma.leetCodeStats.findUnique({
      where: { userId: user.userId },
      select: { calendarData: true, streak: true, username: true },
    });

    if (!stats?.calendarData) {
      return res.status(404).json({ message: "No calendar data yet. Run a sync first." });
    }

    const cal = stats.calendarData as Record<string, unknown>;
    const rawCalendar = (cal.submissionCalendar ?? {}) as Record<string, number>;

    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    const days: Array<{ date: string; dayOfWeek: number; submissions: number; timestamp: number }> = [];
    for (const [ts, count] of Object.entries(rawCalendar)) {
      const timestamp = Number(ts);
      const d = new Date(timestamp * 1000);
      const dateStr = d.toISOString().split("T")[0];

      if (year && !dateStr.startsWith(String(year)))
        continue;
      if (month && !dateStr.startsWith(`${year ?? new Date().getFullYear()}-${String(month).padStart(2, "0")}`))
        continue;

      days.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        submissions: count,
        timestamp,
      });
    }
    days.sort((a, b) => a.timestamp - b.timestamp);

    const totalSubmissions = days.reduce((sum, d) => sum + d.submissions, 0);

    res.status(200).json({
      username: stats.username,
      activeYears: cal.activeYears,
      totalActiveDays: cal.totalActiveDays,
      streak: stats.streak,
      query: { year: year ?? "all", month: month ?? "all" },
      totalDaysActive: days.length,
      totalSubmissions,
      submissions: days,
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch activity");
    res.status(500).json({ message: "Server Error!" });
  }
});

// ── GET /codingprofile/questions ──
// Returns all solved problems with topic tags from DB.
// Falls back to problemsSolvedList JSON from latest history snapshot
// when the LeetCodeProblem table is empty (e.g. sync skipped question fetch).
router.get("/questions", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const difficulty = req.query.difficulty as string | undefined;
    const tag = req.query.tag as string | undefined;

    let problems = await prisma.leetCodeProblem.findMany({
      where: { userId: user.userId },
      orderBy: { lastSubmittedAt: "desc" },
    });

    // Fallback: if LeetCodeProblem table is empty, read from latest history snapshot
    if (problems.length === 0) {
      const latest = await prisma.leetCodeHistory.findFirst({
        where: { userId: user.userId },
        orderBy: { snapshotAt: "desc" },
        select: { problemsSolvedList: true },
      });
      if (Array.isArray(latest?.problemsSolvedList)) {
        const list = latest.problemsSolvedList as Array<{
          title: string; titleSlug: string; difficulty: string;
          lastResult?: string; questionStatus?: string;
          lastSubmittedAt?: string; numSubmitted?: number;
          topicTags?: Array<{ name: string; nameTranslated?: string; slug: string }>;
        }>;
        problems = list.map(p => ({
          id: "", userId: user.userId,
          titleSlug: p.titleSlug, title: p.title, difficulty: p.difficulty,
          questionStatus: p.questionStatus ?? "",
          lastResult: p.lastResult ?? "",
          lastSubmittedAt: p.lastSubmittedAt ?? "",
          numSubmitted: p.numSubmitted ?? 0,
          topicTags: p.topicTags ?? [],
        }));
      }
    }

    let filtered = problems;

    if (difficulty) {
      const d = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
      filtered = filtered.filter(p => p.difficulty === d);
    }

    if (tag) {
      const tagLower = tag.toLowerCase();
      filtered = filtered.filter((p) => {
        const tags = p.topicTags as Array<{ name: string; slug: string }>;
        return Array.isArray(tags) && tags.some(t =>
          t.name.toLowerCase().includes(tagLower) || t.slug.toLowerCase().includes(tagLower),
        );
      });
    }

    const sliced = filtered.slice(0, limit);

    res.status(200).json({
      total: filtered.length,
      limit,
      difficulty: difficulty ?? "all",
      tag: tag ?? "all",
      questions: sliced.map(p => ({
        title: p.title,
        titleSlug: p.titleSlug,
        difficulty: p.difficulty,
        lastResult: p.lastResult,
        questionStatus: p.questionStatus,
        lastSubmittedAt: p.lastSubmittedAt,
        numSubmitted: p.numSubmitted,
        topicTags: p.topicTags,
      })),
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch questions");
    res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
