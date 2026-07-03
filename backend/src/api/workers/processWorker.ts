import { Prisma } from "@prisma/client";
import { Worker } from "bullmq";

import type { ProcessJobData } from "../../queues/process.queue.js";

import prisma from "../../db.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { connection } from "../../queues/sync.queue.js";
import { ingestRag } from "../../services/rag/ingest.js";

const toJson = (val: unknown) => val as Prisma.InputJsonValue;

const processWorker = new Worker(
  processLeetcodeQueue.name,
  async (job) => {
    const { userId, username, syncResult, problems } = job.data as ProcessJobData;
    const { profile, contest, questionProgress, skillStats, languageStats, calendar } = syncResult;

    await job.updateProgress({ stage: "db_save_started", pct: 40, msg: "Saving stats to database..." });
    job.log(`[process] Saving stats for ${username} to Postgres`);

    // ── 1. Upsert LeetCodeStats ──
    const parsedCalendar = calendar.submissionCalendar;
    await prisma.leetCodeStats.upsert({
      where: { userId },
      create: {
        userId,
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
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({
          activeYears: calendar.activeYears,
          totalActiveDays: calendar.totalActiveDays,
          submissionCalendar: parsedCalendar,
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
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({
          activeYears: calendar.activeYears,
          totalActiveDays: calendar.totalActiveDays,
          submissionCalendar: parsedCalendar,
        }),
      },
    });

    // ── 2. Replace LeetCodeProblem rows ──
    if (problems.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "LeetCodeProblem" WHERE "userId" = ${userId}`;
        await tx.leetCodeProblem.createMany({
          data: problems.map(p => ({
            userId,
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
      });
      job.log(`[process] Saved ${problems.length} problems`);
    }

    // ── 3. Replace LeetCodeContestHistory rows ──
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM "LeetCodeContestHistory" WHERE "userId" = ${userId}`;
      if (contest.history.length > 0) {
        await tx.leetCodeContestHistory.createMany({
          data: contest.history.map(e => ({
            userId,
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

    await job.updateProgress({ stage: "db_saved", pct: 60, msg: "Database save complete" });
    job.log(`[process] Postgres save complete`);

    // ── 4. Save history snapshot ──
    await prisma.leetCodeHistory.create({
      data: {
        userId,
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
        problemsSolvedList: problems.length > 0
          ? toJson(problems.map(p => ({
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
    job.log(`[process] History snapshot saved`);

    // ── 5. RAG ingest (non-blocking) ──
    await job.updateProgress({ stage: "rag_started", pct: 62, msg: "Starting AI indexing..." });
    try {
      const ragResult = await ingestRag(userId, username, syncResult, problems, async (stage, pct, msg) => {
        await job.updateProgress({ stage, pct, msg });
      });
      await job.updateProgress({
        stage: "completed",
        pct: 100,
        msg: `Sync complete: ${ragResult.upserted} indexed, ${ragResult.skipped} unchanged`,
      });
      job.log(`[process] RAG ingest: ${ragResult.upserted} upserted, ${ragResult.skipped} skipped`);
    }
    catch (ragErr) {
      const errMsg = ragErr instanceof Error ? ragErr.message : String(ragErr);
      job.log(`[process] WARNING: RAG ingest failed: ${errMsg} — sync data saved successfully`);
      await job.updateProgress({
        stage: "completed",
        pct: 100,
        msg: `Sync complete (AI indexing skipped: ${errMsg})`,
      });
    }
  },
  { connection, concurrency: 2 },
);

processWorker.on("completed", job => job.log(`[process] Job ${job.id} done`));
processWorker.on("failed", (job, err) => {
  job?.log(`[process] Job ${job?.id} failed: ${err.message}`);
});

attachWorkerMetrics(processWorker, "process-leetcode");

export default processWorker;
