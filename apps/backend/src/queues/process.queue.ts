import { Queue } from "bullmq";

import type {
  LeetCodeSyncResult,
} from "../types/coding-profiles.js";

import { connection } from "./sync.queue.js";

export type RawProblem = {
  titleSlug: string;
  title: string;
  difficulty: string;
  questionStatus: string;
  lastResult: string;
  lastSubmittedAt: string;
  numSubmitted: number;
  topicTags: Array<{ name: string; nameTranslated: string; slug: string }>;
};

export type ProcessJobData = {
  userId: string;
  username: string;
  syncResult: LeetCodeSyncResult;
  problems: RawProblem[];
};

export const processLeetcodeQueue = new Queue("process-leetcode", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: { age: 600 },
    removeOnFail: false,
  },
});
