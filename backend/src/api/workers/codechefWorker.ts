import { Job, Worker } from "bullmq";
import syncQueue from "../../queues/sync.queue.js";
import { redisConnection } from "../../queue.js";

async function CodechefFetcher(userId: string) {
    console.log("Codechef", userId);
}

const codechefWorker = new Worker(
    syncQueue.name,
    async (job: Job) => {
        const { userId } = job.data;
        await CodechefFetcher(userId);
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

export default codechefWorker;