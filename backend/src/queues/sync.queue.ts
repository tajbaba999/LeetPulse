import type { ConnectionOptions } from "bullmq";

import { Queue } from "bullmq";

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

export const leetcodeQueue = new Queue("sync-leetcode", {
  connection,
  defaultJobOptions,
});

export function getQueueForPlatform(platform: "leetcode") {
  return leetcodeQueue;
}
