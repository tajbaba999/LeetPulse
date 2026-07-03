import type { Worker } from "bullmq";

import { syncJobDuration, syncJobsInFlight, syncJobTotal } from "../lib/metrics.js";

export function attachWorkerMetrics(worker: Worker, platform: string): void {
  worker.on("active", () => {
    syncJobsInFlight.inc({ platform });
  });

  worker.on("completed", (job) => {
    const duration = (job.finishedOn && job.processedOn)
      ? (job.finishedOn - job.processedOn) / 1000
      : 0;

    syncJobDuration.observe({ platform, status: "completed" }, duration);
    syncJobTotal.inc({ platform, status: "completed" });
    syncJobsInFlight.dec({ platform });
  });

  worker.on("failed", (job, err) => {
    const duration = (job?.finishedOn && job?.processedOn)
      ? (job.finishedOn - job.processedOn) / 1000
      : 0;

    syncJobDuration.observe({ platform, status: "failed" }, duration);
    syncJobTotal.inc({ platform, status: "failed" });
    syncJobsInFlight.dec({ platform });
  });
}
