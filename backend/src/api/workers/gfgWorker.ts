import { Worker } from "bullmq";

import type { SyncJobData } from "../../types/coding-profiles.js";

import prisma from "../../db.js";
import { fetchGfgProfile } from "../../fetchers/gfgFetcher.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";
import { connection, gfgQueue } from "../../queues/sync.queue.js";

const gfgWorker = new Worker(
  gfgQueue.name,
  async (job) => {
    const { userId, username } = job.data as SyncJobData;
    job.log(`Fetching GFG profile for ${username} (user: ${userId})`);

    const profile = await fetchGfgProfile(username);
    job.log(`Score: ${profile.codingScore}, Problems Solved: ${profile.problemsSolved}`);

    await prisma.geeksforgeeksStats.upsert({
      where: { userId },
      create: { userId, ...profile },
      update: { ...profile },
    });

    return profile;
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 1000,
    },
  },
);

gfgWorker.on("completed", (job) => {
  console.log(`[gfg] Job ${job.id} completed for ${job.data.username}`);
});

gfgWorker.on("failed", (job, err) => {
  console.error(`[gfg] Job ${job?.id} failed for ${job?.data.username}:`, err.message);
});

attachWorkerMetrics(gfgWorker, "geeksforgeeks");

export default gfgWorker;
