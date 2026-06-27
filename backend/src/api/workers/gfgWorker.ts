import { Worker } from "bullmq";
import { connection, gfgQueue } from "../../queues/sync.queue.js";
import { fetchGfgProfile } from "../../fetchers/gfgFetcher.js";
import type { SyncJobData } from "../../types/coding-profiles.js";

const gfgWorker = new Worker(
    gfgQueue.name,
    async (job) => {
        const { userId, username } = job.data as SyncJobData;
        job.log(`Fetching GFG profile for ${username} (user: ${userId})`);

        const profile = await fetchGfgProfile(username);
        job.log(`Score: ${profile.codingScore}, Problems Solved: ${profile.problemsSolved}`);

        // TODO: store profile data in DB
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

export default gfgWorker;
