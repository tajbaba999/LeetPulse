import { Queue } from "bullmq";

import { connection } from "./sync.queue.js";

export const fetchLeetcodeQueue = new Queue("fetch-leetcode", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: { age: 600 },
    removeOnFail: false,
  },
});
