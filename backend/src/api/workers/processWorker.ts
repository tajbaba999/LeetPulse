import type { Prisma } from "@prisma/client";
import { Worker } from "bullmq";

import type { ProcessJobData } from "../../queues/process.queue.js";

import prisma from "../../db.js";
import { ingestRag } from "../../services/rag/ingest.js";
import { connection } from "../../queues/sync.queue.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";

const toJson = (val: unknown) => val as Prisma.InputJsonValue;

const processWorker = new Worker(
  processLeetcodeQueue.name,
  async (job) => {
    const { userId, username, syncResult, problems } = job.data as ProcessJobData;
    const { profile, contest, questionProgress, sessionProgress, skillStats, languageStats, calendar } = syncResult;

    job.log(`[process] Saving stats for ${username} to Postgres`);

    // ── 1. Upsert LeetCodeStats ──
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
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays }),
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
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays }),
      },
    });

    // ── 2. Replace LeetCodeProblem rows ──
    if (problems.length > 0) {
      await prisma.$executeRaw`DELETE FROM "LeetCodeProblem" WHERE "userId" = ${userId}`;
      await prisma.leetCodeProblem.createMany({
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
      job.log(`[process] Saved ${problems.length} problems`);
    }

    // ── 3. Replace LeetCodeContestHistory rows ──
    await prisma.$executeRaw`DELETE FROM "LeetCodeContestHistory" WHERE "userId" = ${userId}`;
    if (contest.history.length > 0) {
      await prisma.leetCodeContestHistory.createMany({
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

    job.log(`[process] Postgres save complete`);

    // ── 4. RAG ingest ──
    const ragResult = await ingestRag(userId, username, syncResult, problems);
    job.log(`[process] RAG ingest: ${ragResult.upserted} upserted, ${ragResult.skipped} skipped`);
  },
  { connection, concurrency: 2 },
);

processWorker.on("completed", job => job.log(`[process] Job ${job.id} done`));
processWorker.on("failed", (job, err) => {
  job?.log(`[process] Job ${job?.id} failed: ${err.message}`);
});

attachWorkerMetrics(processWorker, "process-leetcode");

export default processWorker;
