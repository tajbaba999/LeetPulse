import { Worker } from "bullmq";

import type { SyncJobData } from "../../types/coding-profiles.js";

import prisma from "../../db.js";
import { fetchCodeforcesProfile } from "../../fetchers/codeforcesFetcher.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";
import { codeforcesQueue, connection } from "../../queues/sync.queue.js";

const codeforcesWorker = new Worker(
  codeforcesQueue.name,
  async (job) => {
    const { userId, username } = job.data as SyncJobData;
    job.log(`Fetching Codeforces profile for ${username} (user: ${userId})`);

    const profile = await fetchCodeforcesProfile(username);
    job.log(`Rating: ${profile.rating} (${profile.rank}), Solved: ${profile.solvedCount}`);

    await prisma.codeforcesStats.upsert({
      where: { userId },
      create: { userId, ...profile },
      update: { ...profile },
    });

    return profile;
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 5,
      duration: 1000,
    },
  },
);

codeforcesWorker.on("completed", (job) => {
  console.log(`[codeforces] Job ${job.id} completed for ${job.data.username}`);
});

codeforcesWorker.on("failed", (job, err) => {
  console.error(`[codeforces] Job ${job?.id} failed for ${job?.data.username}:`, err.message);
});

attachWorkerMetrics(codeforcesWorker, "codeforces");

export default codeforcesWorker;
