import { Job, Worker } from "bullmq";
import syncQueue from "../../queues/sync.queue.js";
import { redisConnection } from "../../queue.js";

async function LeetcodeFetcher(userId: string) {
    // Fetching / Scraping logic goes here...
    console.log("Leetcode", userId);
}

const leetcodeWorker = new Worker(
    syncQueue.name,
    async (job: Job) => {
        const { userId } = job.data;
        await LeetcodeFetcher(userId);
    },
    {
        connection: redisConnection,
        concurrency: 5,
        limiter: {
            max: 2,
            duration: 1000
        },
    }
);

export default leetcodeWorker;