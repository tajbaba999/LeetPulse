import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

const REDIS_URI = process.env.REDIS_URL ?? "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
    const { hostname, port, password } = new URL(url);
    return {
        host: hostname,
        port: Number(port) || 6379,
        ...(password && { password }),
    };
}

export const connection = parseRedisUrl(REDIS_URI);

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
};

// Platform queues with rate limits matching the architecture:
//   LeetCode: 2/s  (GraphQL)
//   Codeforces: 5/s (REST API)
//   CodeChef: 1/s  (API + scrape)
//   GFG: 1/s       (Profile scrape)

export const leetcodeQueue = new Queue("sync:leetcode", {
    connection,
    defaultJobOptions,
});

export const codeforcesQueue = new Queue("sync:codeforces", {
    connection,
    defaultJobOptions,
});

export const codechefQueue = new Queue("sync:codechef", {
    connection,
    defaultJobOptions,
});

export const gfgQueue = new Queue("sync:geeksforgeeks", {
    connection,
    defaultJobOptions,
});

const platformQueues = {
    leetcode: leetcodeQueue,
    codeforces: codeforcesQueue,
    codechef: codechefQueue,
    geeksforgeeks: gfgQueue,
} as const;

export function getQueueForPlatform(platform: keyof typeof platformQueues) {
    return platformQueues[platform];
}

export default platformQueues;
