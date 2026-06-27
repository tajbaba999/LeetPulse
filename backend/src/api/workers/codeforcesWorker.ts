import { Job, Worker } from "bullmq";
import syncQueue from "../../queues/sync.queue.js";
import { redisConnection } from "../../queue.js";

async function CodeForcesFetcher(userId: string) {
    console.log("Codeforces", userId);
}

const codeforcesWorker = new Worker(
    syncQueue.name,
    async (job: Job) => {
        const { userId } = job.data;
        await CodeForcesFetcher(userId);
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

export default codeforcesWorker;