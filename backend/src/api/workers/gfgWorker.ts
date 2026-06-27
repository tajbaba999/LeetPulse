import { Job, Worker } from "bullmq";
import syncQueue from "../../queues/sync.queue.js";
import { redisConnection } from "../../queue.js";

async function GFGFetcher(userId: string) {
    console.log("GFG", userId);
}

const gfgWorker = new Worker(
    syncQueue.name,
    async (job: Job) => {
        const { userId } = job.data;
        await GFGFetcher(userId);
    },
    {
        connection: redisConnection,
        concurrency: 5,
        limiter: {
            max: 2,
            duration: 1000
        },
    },
);

export default gfgWorker;