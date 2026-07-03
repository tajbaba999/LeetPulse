import type { Job } from "bullmq";

import { Worker } from "bullmq";

import type { RawProblem } from "../../queues/process.queue.js";
import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";

import {
  fetchLeetCodeCalendar,
  fetchLeetCodeContest,
  fetchLeetCodeLanguageStats,
  fetchLeetCodeProfile,
  fetchLeetCodeQuestionProgress,
  fetchLeetCodeSessionProgress,
  fetchLeetCodeSkillStats,
  fetchLeetCodeUserQuestions,
} from "../../fetchers/leetcodeFetcher.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { connection } from "../../queues/sync.queue.js";

type FetchJobData = { userId: string; username: string };

const STEP_LABELS = [
  "Profile",
  "Contest info",
  "Question progress",
  "Session progress",
  "Skill stats",
  "Language stats",
  "Calendar",
  "All solved questions (paginated)",
  "Enqueueing process job",
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

    // Steps 1-7: Fetch profile stats
    const statFetchers = [
      { label: STEP_LABELS[0], fn: () => fetchLeetCodeProfile(username), key: "profile" as const },
      { label: STEP_LABELS[1], fn: () => fetchLeetCodeContest(username), key: "contest" as const },
      { label: STEP_LABELS[2], fn: () => fetchLeetCodeQuestionProgress(username), key: "questionProgress" as const },
      { label: STEP_LABELS[3], fn: () => fetchLeetCodeSessionProgress(username), key: "sessionProgress" as const },
      { label: STEP_LABELS[4], fn: () => fetchLeetCodeSkillStats(username), key: "skillStats" as const },
      { label: STEP_LABELS[5], fn: () => fetchLeetCodeLanguageStats(username), key: "languageStats" as const },
      { label: STEP_LABELS[6], fn: () => fetchLeetCodeCalendar(username), key: "calendar" as const },
    ];

    for (let i = 0; i < statFetchers.length; i++) {
      const { label, fn, key } = statFetchers[i];
      await reportStep(job, i + 1, `${i + 1}/${TOTAL_STEPS}: Fetching ${label}...`);
      job.log(`[fetch] ${i + 1}/${TOTAL_STEPS}: Fetching ${label}`);
      try {
        (syncResult as Record<string, unknown>)[key] = await fn();
      }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        job.log(`[fetch] WARNING: ${label} failed: ${msg}`);
        await reportStep(job, i + 1, `${i + 1}/${TOTAL_STEPS}: ${label} failed — ${msg}`);
      }
    }

    // Step 8: Fetch all solved questions (paginated)
    let allProblems: RawProblem[] = [];
    await reportStep(job, 8, `${8}/${TOTAL_STEPS}: Fetching solved questions (page 1)...`);
    job.log(`[fetch] 8/${TOTAL_STEPS}: Fetching solved questions (paginated)`);

    try {
      const PAGE_SIZE = 50;
      let skip = 0;
      let totalNum = 0;

      // First request to get totalNum
      const firstPage = await fetchLeetCodeUserQuestions(username, 0, PAGE_SIZE);
      totalNum = firstPage.totalNum;
      allProblems = firstPage.questions.map(q => ({
        titleSlug: q.titleSlug,
        title: q.title,
        difficulty: q.difficulty,
        questionStatus: q.questionStatus,
        lastResult: q.lastResult,
        lastSubmittedAt: q.lastSubmittedAt,
        numSubmitted: q.numSubmitted,
        topicTags: q.topicTags,
      }));

      await reportStep(job, 8, `${8}/${TOTAL_STEPS}: Fetched ${allProblems.length}/${totalNum} questions...`);

      // Fetch remaining pages
      skip = PAGE_SIZE;
      while (skip < totalNum) {
        await reportStep(job, 8, `${8}/${TOTAL_STEPS}: Fetching questions ${skip + 1}-${Math.min(skip + PAGE_SIZE, totalNum)} of ${totalNum}...`);
        job.log(`[fetch] Fetching questions ${skip}-${skip + PAGE_SIZE} of ${totalNum}`);
        const page = await fetchLeetCodeUserQuestions(username, skip, PAGE_SIZE);
        const mapped = page.questions.map(q => ({
          titleSlug: q.titleSlug,
          title: q.title,
          difficulty: q.difficulty,
          questionStatus: q.questionStatus,
          lastResult: q.lastResult,
          lastSubmittedAt: q.lastSubmittedAt,
          numSubmitted: q.numSubmitted,
          topicTags: q.topicTags,
        }));
        allProblems = [...allProblems, ...mapped];
        skip += PAGE_SIZE;

        // Small delay to avoid rate limiting
        if (skip < totalNum) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      await reportStep(job, 8, `${8}/${TOTAL_STEPS}: Fetched ${allProblems.length} solved questions`);
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job.log(`[fetch] WARNING: Question fetch failed: ${msg}`);
      await reportStep(job, 8, `${8}/${TOTAL_STEPS}: Question fetch failed — ${msg}. Continuing with ${allProblems.length} questions.`);
    }

    // Step 9: Enqueue process job
    await reportStep(job, 9, `${9}/${TOTAL_STEPS}: Saving ${allProblems.length} questions + stats to process queue...`);
    job.log(`[fetch] All fetches done, enqueueing process job with ${allProblems.length} questions`);

    await processLeetcodeQueue.add(
      "process-leetcode",
      { userId, username, syncResult, problems: allProblems },
      { priority: 2, jobId: `process-leetcode-${userId}` },
    );

    return { username, syncResult, problemCount: allProblems.length };
  },
  {
    connection,
    concurrency: 2,
    lockDuration: 600_000,
  },
);

fetchWorker.on("completed", job => job.log(`[fetch] Job ${job.id} done`));
fetchWorker.on("failed", (job, err) => job?.log(`[fetch] Job ${job?.id} failed: ${err.message}`));

export default fetchWorker;
