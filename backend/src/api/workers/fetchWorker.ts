import { Credential, LeetCode } from "leetcode-query";
import { Worker } from "bullmq";

import type { SyncJobData } from "../../types/coding-profiles.js";
import type { RawProblem } from "../../queues/process.queue.js";

import { fetchLeetCodeFullSync } from "../../fetchers/leetcodeFetcher.js";
import { connection } from "../../queues/sync.queue.js";
import { fetchLeetcodeQueue } from "../../queues/fetch.queue.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fetchWorker = new Worker(
  fetchLeetcodeQueue.name,
  async (job) => {
    const { userId, username } = job.data as SyncJobData;

    await job.updateProgress({ stage: "fetch_started", pct: 0, msg: `Starting sync for ${username}...` });
    job.log(`[fetch] Starting LeetCode fetch for ${username}`);

    // Step 1: Fetch all summary stats (7 parallel GraphQL queries)
    const syncResult = await fetchLeetCodeFullSync(username);
    await job.updateProgress({
      stage: "profile_fetched",
      pct: 10,
      msg: `Profile fetched: ${syncResult.profile.totalSolved} problems solved`,
    });
    job.log(`[fetch] Summary sync complete: ${syncResult.profile.totalSolved} solved`);

    // Step 2: Fetch solved problem list (sequential, 1s gap per page)
    const problems: RawProblem[] = [];
    const session = process.env.LEETCODE_SESSION;
    const csrf = process.env.LEETCODE_CSRF;

    if (session && csrf) {
      const credential = new Credential();
      credential.session = session;
      credential.csrf = csrf;
      const lc = new LeetCode(credential);

      let skip = 0;
      const limit = 50;
      let hasMore = true;
      let pageNum = 0;

      while (hasMore) {
        const batch = await lc.user_progress_questions({ skip, limit });
        problems.push(...(batch.questions as RawProblem[]));
        hasMore = batch.questions.length === limit;
        skip += limit;
        pageNum++;

        const pct = Math.min(10 + pageNum * 5, 35);
        await job.updateProgress({
          stage: "page_fetched",
          pct,
          msg: `Fetched page ${pageNum} — ${problems.length} problems so far`,
        });

        if (hasMore) {
          await sleep(1000);
        }
      }
      await job.updateProgress({
        stage: "all_fetched",
        pct: 38,
        msg: `All ${problems.length} problems fetched (${pageNum} pages)`,
      });
      job.log(`[fetch] Fetched ${problems.length} problems (${pageNum} pages)`);
    }
    else {
      job.log(`[fetch] LEETCODE_SESSION/CSRF not set — skipping problem fetch`);
    }

    // Step 3: Hand off to process queue
    await processLeetcodeQueue.add(
      "process-leetcode",
      { userId, username, syncResult, problems },
      { jobId: `process-leetcode-${userId}` },
    );
    job.log(`[fetch] Enqueued process job for ${username}`);
  },
  {
    connection,
    concurrency: 2,
    limiter: { max: 2, duration: 1000 },
  },
);

fetchWorker.on("completed", job => job.log(`[fetch] Job ${job.id} completed`));
fetchWorker.on("failed", (job, err) => {
  job?.log(`[fetch] Job ${job?.id} failed: ${err.message}`);
});

attachWorkerMetrics(fetchWorker, "fetch-leetcode");

export default fetchWorker;
