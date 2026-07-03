import type { Job } from "bullmq";

import { Worker } from "bullmq";

import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";

import {
  fetchLeetCodeCalendar,
  fetchLeetCodeContest,
  fetchLeetCodeLanguageStats,
  fetchLeetCodeProfile,
  fetchLeetCodeQuestionProgress,
  fetchLeetCodeSessionProgress,
  fetchLeetCodeSkillStats,
} from "../../fetchers/leetcodeFetcher.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { connection } from "../../queues/sync.queue.js";

type FetchJobData = { userId: string; username: string };

const STEP_LABELS = [
  "Fetching profile",
  "Fetching contest info",
  "Fetching question progress",
  "Fetching session progress",
  "Fetching skill stats",
  "Fetching language stats",
  "Fetching calendar",
  "Saving to process queue",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

async function reportStep(
  job: Job,
  step: number,
  msg: string,
): Promise<void> {
  await job.updateProgress({ step, total: TOTAL_STEPS, msg });
}

const fetchWorker = new Worker(
  "fetch-leetcode",
  async (job) => {
    const { userId, username } = job.data as FetchJobData;
    job.log(`[fetch] Starting fetch for ${username} (${userId})`);

    const syncResult: LeetCodeSyncResult = {} as LeetCodeSyncResult;
    const fetchers = [
      { label: STEP_LABELS[0], fn: () => fetchLeetCodeProfile(username), key: "profile" as const },
      { label: STEP_LABELS[1], fn: () => fetchLeetCodeContest(username), key: "contest" as const },
      { label: STEP_LABELS[2], fn: () => fetchLeetCodeQuestionProgress(username), key: "questionProgress" as const },
      { label: STEP_LABELS[3], fn: () => fetchLeetCodeSessionProgress(username), key: "sessionProgress" as const },
      { label: STEP_LABELS[4], fn: () => fetchLeetCodeSkillStats(username), key: "skillStats" as const },
      { label: STEP_LABELS[5], fn: () => fetchLeetCodeLanguageStats(username), key: "languageStats" as const },
      { label: STEP_LABELS[6], fn: () => fetchLeetCodeCalendar(username), key: "calendar" as const },
    ];

    for (let i = 0; i < fetchers.length; i++) {
      const { label, fn, key } = fetchers[i];
      await reportStep(job, i + 1, `${i + 1}/${TOTAL_STEPS}: ${label}...`);
      job.log(`[fetch] ${i + 1}/${TOTAL_STEPS}: ${label}`);
      try {
        (syncResult as Record<string, unknown>)[key] = await fn();
      }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        job.log(`[fetch] WARNING: ${label} failed: ${msg}`);
        await reportStep(job, i + 1, `${i + 1}/${TOTAL_STEPS}: ${label} failed — ${msg}`);
      }
    }

    await reportStep(job, TOTAL_STEPS, `${TOTAL_STEPS}/${TOTAL_STEPS}: Adding to process queue...`);
    job.log(`[fetch] All fetches done, enqueueing process job`);

    await processLeetcodeQueue.add(
      "process-leetcode",
      { userId, username, syncResult, problems: [] },
      { priority: 2, jobId: `process-leetcode-${userId}` },
    );

    return { username, syncResult };
  },
  {
    connection,
    concurrency: 2,
    lockDuration: 300_000,
  },
);

fetchWorker.on("completed", job => job.log(`[fetch] Job ${job.id} done`));
fetchWorker.on("failed", (job, err) => job?.log(`[fetch] Job ${job?.id} failed: ${err.message}`));

export default fetchWorker;
