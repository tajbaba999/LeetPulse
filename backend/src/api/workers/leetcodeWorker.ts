import { Worker } from "bullmq";
import { connection, leetcodeQueue } from "../../queues/sync.queue.js";
import { fetchLeetCodeProfile } from "../../fetchers/leetcodeFetcher.js";
import type { SyncJobData } from "../../types/coding-profiles.js";
import prisma from "../../db.js";

const leetcodeWorker = new Worker(
    leetcodeQueue.name,
    async (job) => {
        const { userId, username } = job.data as SyncJobData;
        job.log(`Fetching LeetCode profile for ${username} (user: ${userId})`);

        const profile = await fetchLeetCodeProfile(username);
        job.log(`Solved: ${profile.totalSolved} (Easy: ${profile.easySolved}, Medium: ${profile.mediumSolved}, Hard: ${profile.hardSolved})`);

        await prisma.leetCodeStats.upsert({
            where: { userId },
            create: { userId, ...profile },
            update: { ...profile },
        });

        return profile;
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
    console.log(`[leetcode] Job ${job.id} completed for ${job.data.username}`);
});

leetcodeWorker.on("failed", (job, err) => {
    console.error(`[leetcode] Job ${job?.id} failed for ${job?.data.username}:`, err.message);
});

export default leetcodeWorker;
