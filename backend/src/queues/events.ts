import { QueueEvents } from "bullmq";

import { connection } from "./sync.queue.js";

// One QueueEvents instance per queue
// connection shared by all SSE clients.
export const fetchQueueEvents = new QueueEvents("fetch-leetcode", { connection });
export const processQueueEvents = new QueueEvents("process-leetcode", { connection });
