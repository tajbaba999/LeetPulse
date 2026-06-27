import type { Prisma } from "@prisma/client";

import { Worker } from "bullmq";

import type { SyncJobData } from "../../types/coding-profiles.js";

import prisma from "../../db.js";
import { fetchLeetCodeFullSync } from "../../fetchers/leetcodeFetcher.js";
import { connection, leetcodeQueue } from "../../queues/sync.queue.js";

const leetcodeWorker = new Worker(
  leetcodeQueue.name,
  async (job) => {
    const { userId, username } = job.data as SyncJobData;
    job.log(`Starting full LeetCode sync for ${username} (user: ${userId})`);

    // Step 1: Fetch all data from LeetCode GraphQL (6 parallel queries)
    const result = await fetchLeetCodeFullSync(username);

    job.log(
      `Fetched: ${result.profile.totalSolved} solved, `
      + `${result.contest.info.attendedContestsCount} contests, `
      + `${result.skillStats.fundamental.length + result.skillStats.intermediate.length + result.skillStats.advanced.length} tags`,
    );

    // Step 2: Upsert LeetCodeStats (flat columns + JSON columns)
    const { profile, contest, questionProgress, skillStats, languageStats, calendar } = result;

    const toJson = (val: unknown) => val as Prisma.InputJsonValue;

    await prisma.leetCodeStats.upsert({
      where: { userId },
      create: {
        userId,
        username,
        // Core stats
        totalSolved: profile.totalSolved,
        totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        ranking: profile.ranking,
        acceptanceRate: profile.acceptanceRate,
        streak: calendar.streak,
        // Contest summary
        contestRating: contest.info.rating,
        contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage,
        attendedContestsCount: contest.info.attendedContestsCount,
        // JSON columns
        questionProgress: toJson(questionProgress),
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({
          activeYears: calendar.activeYears,
          totalActiveDays: calendar.totalActiveDays,
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
        }),
      },
    });

    // Step 3: Delete all existing contest history for this user, then bulk insert
    await prisma.$executeRaw`DELETE FROM "LeetCodeContestHistory" WHERE "userId" = ${userId}`;

    if (contest.history.length > 0) {
      await prisma.leetCodeContestHistory.createMany({
        data: contest.history.map(entry => ({
          userId,
          contestTitle: entry.contest.title,
          startTime: entry.contest.startTime,
          attended: entry.attended,
          rating: entry.rating,
          ranking: entry.ranking,
          trendDirection: entry.trendDirection,
          problemsSolved: entry.problemsSolved,
          totalProblems: entry.totalProblems,
          finishTimeInSeconds: entry.finishTimeInSeconds,
        })),
      });
    }

    job.log(
      `Sync complete: upserted stats, `
      + `${contest.history.length} contest entries`,
    );

    return result;
  },
  {
    connection,
    concurrency: 2,
    limiter: {
      max: 2,
      duration: 1000,
    },
  },
);

leetcodeWorker.on("completed", (job) => {
  const data = job.data as SyncJobData;
  console.log(`[leetcode] Job ${job.id} completed for ${data.username}`);
});

leetcodeWorker.on("failed", (job, err) => {
  const data = job?.data as SyncJobData | undefined;
  console.error(`[leetcode] Job ${job?.id} failed for ${data?.username}:`, err.message);
});

export default leetcodeWorker;
