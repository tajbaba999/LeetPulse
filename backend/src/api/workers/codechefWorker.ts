import { Worker } from "bullmq";

import type { SyncJobData } from "../../types/coding-profiles.js";

import prisma from "../../db.js";
import { fetchCodechefProfile } from "../../fetchers/codechefFetcher.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";
import { codechefQueue, connection } from "../../queues/sync.queue.js";

const codechefWorker = new Worker(
  codechefQueue.name,
  async (job) => {
    const { userId, username } = job.data as SyncJobData;
    job.log(`Fetching CodeChef profile for ${username} (user: ${userId})`);

    const profile = await fetchCodechefProfile(username);
    job.log(`Rating: ${profile.rating}, Global Rank: ${profile.globalRank}`);

    await prisma.codechefStats.upsert({
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

codechefWorker.on("completed", (job) => {
  console.log(`[codechef] Job ${job.id} completed for ${job.data.username}`);
});

codechefWorker.on("failed", (job, err) => {
  console.error(`[codechef] Job ${job?.id} failed for ${job?.data.username}:`, err.message);
});

attachWorkerMetrics(codechefWorker, "codechef");

export default codechefWorker;
